begin;

-- This migration only adds activation-policy metadata. It never deletes
-- methods, reservations, orders, counters, or encrypted card numbers.
alter table public.payment_methods
  add column if not exists manual_disabled boolean not null default false,
  add column if not exists auto_priority integer not null default 1000;

create table if not exists public.payment_method_activation_days (
  usage_day date primary key,
  initialized_at timestamptz not null default now()
);

create table if not exists public.payment_method_auto_promotions (
  usage_day date not null,
  source_method_id uuid not null references public.payment_methods(id) on delete restrict,
  promoted_method_id uuid references public.payment_methods(id) on delete restrict,
  promoted_at timestamptz not null default now(),
  primary key (usage_day, source_method_id)
);

alter table public.payment_method_activation_days enable row level security;
alter table public.payment_method_auto_promotions enable row level security;
revoke all on public.payment_method_activation_days, public.payment_method_auto_promotions from public, anon, authenticated;
grant select, insert, update on public.payment_method_activation_days, public.payment_method_auto_promotions to service_role;

-- Preserve existing explicit deactivations. New methods default to eligible
-- standby status unless an administrator explicitly turns them off.
update public.payment_methods set manual_disabled = true
 where active = false and deactivated_at is not null and manual_disabled = false;

with named as (
  select id, sort_order, created_at,
    case
      when lower(provider_name || ' ' || display_name) like '%m10%' then 'm10'
      when lower(provider_name || ' ' || display_name) like '%kapital%' then 'kapital'
      when lower(provider_name || ' ' || display_name) like '%abb%' then 'abb'
      when lower(provider_name || ' ' || display_name) like '%leo%' then 'leo'
      else 'other'
    end as provider_group
  from public.payment_methods
), ranked as (
  select *,
    row_number() over (partition by provider_group order by sort_order, created_at, id) as provider_rank,
    row_number() over (order by sort_order, created_at, id) as fallback_rank
  from named
)
update public.payment_methods m set auto_priority = case
  when r.provider_group = 'm10' and r.provider_rank = 1 then 1
  when r.provider_group = 'kapital' and r.provider_rank = 1 then 2
  when r.provider_group = 'abb' and r.provider_rank = 1 then 3
  when r.provider_group = 'leo' and r.provider_rank = 1 then 4
  else 100 + r.fallback_rank
end
from ranked r where r.id = m.id;

create index if not exists payment_methods_activation_policy_idx
  on public.payment_methods(auto_priority, sort_order, created_at)
  where archived = false and deleted_at is null and manual_disabled = false;

create or replace function public.refresh_payment_method_automation()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.payment_baku_date();
  v_seeded boolean := false;
  v_source public.payment_methods%rowtype;
  v_next public.payment_methods%rowtype;
  v_confirmed integer;
  v_pending integer;
  v_promoted boolean;
  v_promotions integer := 0;
begin
  perform public.expire_payment_reservations();
  insert into public.payment_method_activation_days(usage_day)
    values (v_day) on conflict do nothing returning true into v_seeded;

  if coalesce(v_seeded, false) then
    update public.payment_methods
       set active = case
         when manual_disabled then false
         when auto_priority between 1 and 4 and encrypted_number is not null then true
         else false
       end,
       deactivated_at = case
         when manual_disabled or auto_priority > 4 or encrypted_number is null then coalesce(deactivated_at, now())
         else null
       end,
       updated_at = now()
     where archived = false and deleted_at is null;
    insert into public.payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
      values ('system', 'activation-policy', 'method.daily_seed', 'payment_method', v_day::text,
        jsonb_build_object('usageDay', v_day, 'priorityProviders', jsonb_build_array('M10','Kapital','ABB','Leobank')));
  end if;

  for v_source in
    select * from public.payment_methods
     where active = true and archived = false and deleted_at is null and manual_disabled = false
       and encrypted_number is not null and limit_mode = 'limited'
     order by auto_priority, sort_order, created_at, id for update
  loop
    select coalesce(confirmed_count, 0) into v_confirmed
      from public.payment_method_daily_counters
     where method_id = v_source.id and counter_date = v_day;
    select count(*) into v_pending from public.payment_reservations
     where method_id = v_source.id and usage_day = v_day
       and status in ('reserved', 'reviewing')
       and (status = 'reviewing' or expires_at > now());
    if coalesce(v_confirmed, 0) + coalesce(v_pending, 0) < v_source.daily_limit then continue; end if;

    update public.payment_methods set active = false, deactivated_at = now(), updated_at = now()
     where id = v_source.id;
    v_promoted := false;
    insert into public.payment_method_auto_promotions(usage_day, source_method_id)
      values (v_day, v_source.id) on conflict do nothing returning true into v_promoted;
    if not coalesce(v_promoted, false) then continue; end if;

    select m.* into v_next from public.payment_methods m
     where m.archived = false and m.deleted_at is null and m.manual_disabled = false
       and m.active = false and m.encrypted_number is not null
       and m.auto_priority > v_source.auto_priority
       and (m.limit_mode = 'unlimited' or m.daily_limit >
          coalesce((select c.confirmed_count from public.payment_method_daily_counters c where c.method_id = m.id and c.counter_date = v_day), 0) +
          (select count(*) from public.payment_reservations r where r.method_id = m.id and r.usage_day = v_day
             and r.status in ('reserved', 'reviewing') and (r.status = 'reviewing' or r.expires_at > now())))
     order by m.auto_priority, m.sort_order, m.created_at, m.id
     limit 1 for update skip locked;
    if found then
      update public.payment_methods set active = true, deactivated_at = null, updated_at = now() where id = v_next.id;
      update public.payment_method_auto_promotions set promoted_method_id = v_next.id where usage_day = v_day and source_method_id = v_source.id;
      v_promotions := v_promotions + 1;
      insert into public.payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
        values ('system', 'activation-policy', 'method.auto_promoted', 'payment_method', v_next.id::text,
          jsonb_build_object('usageDay', v_day, 'sourceMethodId', v_source.id));
    end if;
  end loop;
  return jsonb_build_object('usageDay', v_day, 'seeded', coalesce(v_seeded, false), 'promotions', v_promotions);
end;
$$;

create or replace function public.set_payment_method_active_admin(
  p_method_id uuid, p_active boolean, p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_method public.payment_methods%rowtype;
begin
  select * into v_method from public.payment_methods where id = p_method_id for update;
  if not found or v_method.deleted_at is not null or v_method.archived then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  if p_active and v_method.encrypted_number is null then raise exception 'PAYMENT_METHOD_NUMBER_REQUIRED'; end if;
  update public.payment_methods set active = p_active, manual_disabled = not p_active,
    deactivated_at = case when p_active then null else now() end, updated_at = now()
   where id = p_method_id returning * into v_method;
  insert into public.payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
    values ('admin', left(coalesce(p_actor, 'admin'), 120),
      case when p_active then 'method.manually_activated' else 'method.manually_deactivated' end,
      'payment_method', p_method_id::text, jsonb_build_object('active', p_active));
  return jsonb_build_object('id', v_method.id, 'active', v_method.active, 'manualDisabled', v_method.manual_disabled);
end;
$$;

create or replace function public.restore_payment_method_safely(
  p_method_id uuid, p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_method public.payment_methods%rowtype;
begin
  select * into v_method from public.payment_methods where id = p_method_id for update;
  if not found then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  if v_method.deleted_at is null and not v_method.archived then
    return jsonb_build_object('id', v_method.id, 'restored', true, 'idempotent', true);
  end if;
  update public.payment_methods set archived = false, deleted_at = null, active = false,
    manual_disabled = true, deactivated_at = now(), updated_at = now()
   where id = p_method_id;
  insert into public.payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
    values ('admin', left(coalesce(p_actor, 'admin'), 120), 'method.restored', 'payment_method', p_method_id::text,
      jsonb_build_object('restoredAsManualInactive', true));
  return jsonb_build_object('id', p_method_id, 'restored', true, 'idempotent', false);
end;
$$;

-- Keep the existing editor route consistent with the direct Aktiv et /
-- Deaktiv et buttons. Deactivation stops new checkout selection, but it does
-- not abandon already-created reservations or reviewing orders.
create or replace function public.update_payment_method_admin(
  p_method_id uuid, p_display_name text, p_method_type text, p_provider_name text,
  p_holder_name text, p_encrypted_number text, p_last4 text, p_color text,
  p_icon text, p_theme text, p_active boolean, p_sort_order integer,
  p_daily_limit integer, p_limit_mode text, p_admin_note text, p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_method public.payment_methods%rowtype;
begin
  select * into v_method from public.payment_methods where id = p_method_id for update;
  if not found or v_method.deleted_at is not null or v_method.archived then
    raise exception 'PAYMENT_METHOD_NOT_FOUND';
  end if;
  if p_active and coalesce(p_encrypted_number, v_method.encrypted_number) is null then
    raise exception 'PAYMENT_METHOD_NUMBER_REQUIRED';
  end if;
  update public.payment_methods set
    display_name = p_display_name, method_type = p_method_type, provider_name = p_provider_name,
    holder_name = p_holder_name, encrypted_number = coalesce(p_encrypted_number, encrypted_number),
    last4 = coalesce(p_last4, last4), color = p_color, icon = p_icon, theme = p_theme,
    active = p_active, manual_disabled = not p_active, sort_order = p_sort_order,
    daily_limit = p_daily_limit, limit_mode = p_limit_mode, admin_note = p_admin_note,
    deactivated_at = case when p_active then null else now() end, updated_at = now()
  where id = p_method_id returning * into v_method;
  insert into public.payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
    values ('admin', left(coalesce(p_actor, 'admin'), 120), 'method.updated', 'payment_method',
      p_method_id::text, jsonb_build_object('numberChanged', p_encrypted_number is not null, 'active', p_active));
  return jsonb_build_object('id', v_method.id, 'active', v_method.active, 'updatedAt', v_method.updated_at);
end;
$$;

create or replace function public.reserve_payment_method_v3(
  p_method_id uuid, p_product_id text, p_plan_id text, p_amount numeric, p_currency text,
  p_idempotency_key uuid, p_checkout_key uuid, p_previous_reservation_id uuid default null, p_minutes integer default 10
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  perform public.refresh_payment_method_automation();
  v_result := public.reserve_payment_method_v2(p_method_id, p_product_id, p_plan_id, p_amount, p_currency,
    p_idempotency_key, p_checkout_key, p_previous_reservation_id, p_minutes);
  perform public.refresh_payment_method_automation();
  return v_result;
end;
$$;

create or replace function public.approve_payment_order_v6(
  p_order_id uuid, p_duration_months integer default null, p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  v_result := public.approve_payment_order_v5(p_order_id, p_duration_months, p_actor);
  perform public.refresh_payment_method_automation();
  return v_result;
end;
$$;

revoke execute on function public.refresh_payment_method_automation(), public.set_payment_method_active_admin(uuid,boolean,text), public.restore_payment_method_safely(uuid,text), public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text), public.reserve_payment_method_v3(uuid,text,text,numeric,text,uuid,uuid,uuid,integer), public.approve_payment_order_v6(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.refresh_payment_method_automation(), public.set_payment_method_active_admin(uuid,boolean,text), public.restore_payment_method_safely(uuid,text), public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text), public.reserve_payment_method_v3(uuid,text,text,numeric,text,uuid,uuid,uuid,integer), public.approve_payment_order_v6(uuid,integer,text) to service_role;

commit;
