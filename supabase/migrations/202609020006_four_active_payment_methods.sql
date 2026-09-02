begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Queue membership is per method ID and Baku day, never per bank name.
-- Existing orders, reservations, counters, limits and encrypted numbers are untouched.
create table if not exists public.payment_method_daily_activations (
  usage_day date not null,
  method_id uuid not null references public.payment_methods(id) on delete restrict,
  activated_at timestamptz not null default now(),
  primary key (usage_day, method_id)
);
alter table public.payment_method_daily_activations enable row level security;
revoke all on public.payment_method_daily_activations from public, anon, authenticated;
grant select, insert on public.payment_method_daily_activations to service_role;

-- Preserve today's observed membership when upgrading the previous policy.
insert into public.payment_method_daily_activations(usage_day, method_id)
select public.payment_baku_date(), id from public.payment_methods where active
union
select usage_day, source_method_id from public.payment_method_auto_promotions
 where usage_day = public.payment_baku_date()
union
select usage_day, promoted_method_id from public.payment_method_auto_promotions
 where usage_day = public.payment_baku_date() and promoted_method_id is not null
on conflict do nothing;

create or replace function public.refresh_payment_method_automation()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.payment_baku_date();
  v_ids uuid[];
  v_added integer;
begin
  -- All queue/reserve/approval writers take this lock before any row locks.
  perform pg_advisory_xact_lock(714025001);
  perform public.expire_payment_reservations();
  perform id from public.payment_methods order by id for update;
  insert into public.payment_method_activation_days(usage_day) values(v_day) on conflict do nothing;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from (
    select m.id from public.payment_methods m
    left join public.payment_method_daily_counters c on c.method_id=m.id and c.counter_date=v_day
    where not m.archived and m.deleted_at is null and not m.manual_disabled
      and m.encrypted_number is not null
      and (m.limit_mode='unlimited' or coalesce(c.confirmed_count,0) < m.daily_limit)
    order by m.sort_order, m.created_at, m.id limit 4
  ) eligible;
  -- Reservations consume capacity, NOT queue slots. A busy slot never promotes a reserve card.
  update public.payment_methods set active=false, updated_at=now()
    where active and not (id=any(v_ids));
  update public.payment_methods set active=true, deactivated_at=null, updated_at=now()
    where not active and id=any(v_ids);
  with added as (
    insert into public.payment_method_daily_activations(usage_day,method_id)
      select v_day, unnest(v_ids) on conflict do nothing returning method_id
  )
  insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
    select 'system','four-slot-queue','method.queue_activated','payment_method',method_id::text,
      jsonb_build_object('usageDay',v_day) from added;
  get diagnostics v_added = row_count;
  return jsonb_build_object('usageDay',v_day,'activeCount',cardinality(v_ids),'promotions',v_added);
end;
$$;

-- One transaction returns membership, current-day capacity and visibility together.
create or replace function public.payment_method_queue_snapshot(
  p_include_archived boolean default false, p_include_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_day date := public.payment_baku_date(); v_result jsonb;
begin
  perform public.refresh_payment_method_automation();
  select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object(
    'activated_today', exists(select 1 from public.payment_method_daily_activations a where a.usage_day=v_day and a.method_id=m.id),
    'queue_stats', jsonb_build_object(
      'confirmed',coalesce(c.confirmed_count,0),
      'activeReservations',(select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=v_day and r.status='reserved' and r.expires_at>now()),
      'reviewingReceipts',(select count(*) from public.payment_reservations r where r.method_id=m.id and r.usage_day=v_day and r.status='reviewing'),
      'lastResetAt',v_day::timestamp at time zone 'Asia/Baku',
      'nextResetAt',(v_day+1)::timestamp at time zone 'Asia/Baku'
    )) order by m.sort_order,m.created_at,m.id),'[]'::jsonb) into v_result
  from public.payment_methods m
  left join public.payment_method_daily_counters c on c.method_id=m.id and c.counter_date=v_day
  where (p_include_archived or not m.archived) and (p_include_deleted or m.deleted_at is null);
  return v_result;
end;
$$;

create or replace function public.approve_payment_order_v6(
  p_order_id uuid, p_duration_months integer default null, p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  perform pg_advisory_xact_lock(714025001);
  v_result := public.approve_payment_order_v5(p_order_id,p_duration_months,p_actor);
  perform public.refresh_payment_method_automation();
  return v_result;
end;
$$;

-- Keep reservation idempotency/checkout constraints, including overnight reservation identity.
-- The old v2 SELECT INTO could produce NULL for a missing counter row and skip its limit check.
create or replace function public.reserve_payment_method_v3(
  p_method_id uuid, p_product_id text, p_plan_id text, p_amount numeric, p_currency text,
  p_idempotency_key uuid, p_checkout_key uuid, p_previous_reservation_id uuid default null, p_minutes integer default 10
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_method public.payment_methods%rowtype; v_confirmed integer; v_pending integer;
begin
  perform public.refresh_payment_method_automation();
  -- Replays return their original reservation even if that card is no longer in today's queue.
  if not exists(select 1 from public.payment_reservations where idempotency_key=p_idempotency_key) then
    select * into v_method from public.payment_methods where id=p_method_id for update;
    if not found or not v_method.active or v_method.manual_disabled or v_method.archived or v_method.deleted_at is not null then
      raise exception 'PAYMENT_METHOD_UNAVAILABLE';
    end if;
    select coalesce((select confirmed_count from public.payment_method_daily_counters
      where method_id=p_method_id and counter_date=public.payment_baku_date()),0) into v_confirmed;
    select count(*) into v_pending from public.payment_reservations
      where method_id=p_method_id and usage_day=public.payment_baku_date()
      and status in ('reserved','reviewing') and (status='reviewing' or expires_at>now())
      and not (id is not distinct from p_previous_reservation_id and checkout_key is not distinct from p_checkout_key and status='reserved');
    if v_method.limit_mode='limited' and v_confirmed>=v_method.daily_limit then raise exception 'PAYMENT_METHOD_LIMIT_REACHED'; end if;
    if v_method.limit_mode='limited' and v_confirmed+v_pending>=v_method.daily_limit then raise exception 'PAYMENT_METHOD_TEMPORARILY_BUSY'; end if;
  end if;
  v_result := public.reserve_payment_method_v2(p_method_id,p_product_id,p_plan_id,p_amount,p_currency,
    p_idempotency_key,p_checkout_key,p_previous_reservation_id,p_minutes);
  return v_result;
end;
$$;

-- Serialize admin changes before their row locks; preserve existing audit/soft-delete semantics.
do $$ begin
  if to_regprocedure('public.set_payment_method_active_before_four(uuid,boolean,text)') is null then
    alter function public.set_payment_method_active_admin(uuid,boolean,text) rename to set_payment_method_active_before_four;
  end if;
  if to_regprocedure('public.delete_payment_method_before_four(uuid,text)') is null then
    alter function public.delete_payment_method_safely(uuid,text) rename to delete_payment_method_before_four;
  end if;
  if to_regprocedure('public.update_payment_method_before_four(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text)') is null then
    alter function public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text) rename to update_payment_method_before_four;
  end if;
end $$;

create or replace function public.set_payment_method_active_admin(p_method_id uuid,p_active boolean,p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  perform pg_advisory_xact_lock(714025001);
  v_result:=public.set_payment_method_active_before_four(p_method_id,p_active,p_actor);
  perform public.refresh_payment_method_automation();
  return v_result || jsonb_build_object('active',(select active from public.payment_methods where id=p_method_id));
end;
$$;
create or replace function public.delete_payment_method_safely(p_method_id uuid,p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  perform pg_advisory_xact_lock(714025001);
  v_result:=public.delete_payment_method_before_four(p_method_id,p_actor);
  perform public.refresh_payment_method_automation();
  return v_result;
end;
$$;
create or replace function public.update_payment_method_admin(
  p_method_id uuid,p_display_name text,p_method_type text,p_provider_name text,p_holder_name text,
  p_encrypted_number text,p_last4 text,p_color text,p_icon text,p_theme text,p_active boolean,
  p_sort_order integer,p_daily_limit integer,p_limit_mode text,p_admin_note text,p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_manual boolean; v_active boolean;
begin
  perform pg_advisory_xact_lock(714025001);
  select manual_disabled,active into v_manual,v_active from public.payment_methods where id=p_method_id for update;
  v_result:=public.update_payment_method_before_four(p_method_id,p_display_name,p_method_type,p_provider_name,p_holder_name,
    p_encrypted_number,p_last4,p_color,p_icon,p_theme,p_active,p_sort_order,p_daily_limit,p_limit_mode,p_admin_note,p_actor);
  -- Saving a standby card's unchanged checkbox must not turn it into a manual deactivation.
  if p_active=v_active then update public.payment_methods set manual_disabled=v_manual where id=p_method_id; end if;
  perform public.refresh_payment_method_automation();
  return v_result || jsonb_build_object('active',(select active from public.payment_methods where id=p_method_id));
end;
$$;

revoke execute on function public.set_payment_method_active_before_four(uuid,boolean,text),public.delete_payment_method_before_four(uuid,text),public.update_payment_method_before_four(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text) from public,anon,authenticated,service_role;
revoke execute on function public.payment_method_queue_snapshot(boolean,boolean),public.refresh_payment_method_automation(),public.reserve_payment_method_v3(uuid,text,text,numeric,text,uuid,uuid,uuid,integer),public.approve_payment_order_v6(uuid,integer,text),public.set_payment_method_active_admin(uuid,boolean,text),public.delete_payment_method_safely(uuid,text),public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.payment_method_queue_snapshot(boolean,boolean),public.refresh_payment_method_automation(),public.reserve_payment_method_v3(uuid,text,text,numeric,text,uuid,uuid,uuid,integer),public.approve_payment_order_v6(uuid,integer,text),public.set_payment_method_active_admin(uuid,boolean,text),public.delete_payment_method_safely(uuid,text),public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text) to service_role;
commit;
