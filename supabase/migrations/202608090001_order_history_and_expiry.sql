begin;

alter table public.payment_orders
  add column if not exists completed_at timestamptz,
  add column if not exists duration_months integer,
  add column if not exists service_expires_on date,
  add column if not exists expiry_notification_on date,
  add column if not exists contacted_at timestamptz,
  add column if not exists method_name_snapshot text,
  add column if not exists method_last4_snapshot text;

alter table public.payment_orders drop constraint if exists payment_orders_duration_months_check;
alter table public.payment_orders add constraint payment_orders_duration_months_check
  check (duration_months is null or duration_months between 1 and 120);
alter table public.payment_orders drop constraint if exists payment_orders_method_last4_snapshot_check;
alter table public.payment_orders add constraint payment_orders_method_last4_snapshot_check
  check (method_last4_snapshot is null or method_last4_snapshot ~ '^[0-9]{4}$');

alter table public.payment_methods
  add column if not exists deactivated_at timestamptz,
  add column if not exists deleted_at timestamptz;

update public.payment_orders set completed_at = approved_at
 where completed_at is null and status = 'approved' and approved_at is not null;

update public.payment_orders o
   set method_name_snapshot = coalesce(nullif(m.provider_name, ''), m.display_name),
       method_last4_snapshot = m.last4
  from public.payment_methods m
 where o.method_id = m.id
   and (o.method_name_snapshot is null or o.method_last4_snapshot is null);

create index if not exists payment_orders_completed_idx on public.payment_orders(completed_at desc) where status = 'approved';
create index if not exists payment_orders_expiry_idx on public.payment_orders(expiry_notification_on, contacted_at) where status = 'approved';

create or replace function public.snapshot_payment_order_method()
returns trigger language plpgsql set search_path = public as $$
declare v_method payment_methods%rowtype;
begin
  select * into v_method from payment_methods where id = new.method_id;
  if found then
    new.method_name_snapshot := coalesce(nullif(v_method.provider_name, ''), v_method.display_name);
    new.method_last4_snapshot := v_method.last4;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_orders_method_snapshot_trigger on public.payment_orders;
create trigger payment_orders_method_snapshot_trigger before insert on public.payment_orders
for each row execute function public.snapshot_payment_order_method();

create or replace function public.set_payment_order_duration(
  p_order_id uuid,
  p_duration_months integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order payment_orders%rowtype;
begin
  if p_duration_months is null or p_duration_months < 1 or p_duration_months > 120 then
    return jsonb_build_object('id', p_order_id, 'durationMonths', null, 'stored', false);
  end if;
  select * into v_order from payment_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in ('reviewing', 'new_receipt_requested') then raise exception 'ORDER_NOT_REVIEWABLE'; end if;
  update payment_orders set duration_months = p_duration_months, updated_at = now() where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'durationMonths', p_duration_months, 'stored', true);
end;
$$;

create or replace function public.approve_payment_order_v2(
  p_order_id uuid,
  p_duration_months integer default null,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order payment_orders%rowtype;
  v_method payment_methods%rowtype;
  v_count integer;
  v_completed_at timestamptz := now();
  v_completed_on date := payment_baku_date(v_completed_at);
  v_duration integer;
  v_expires_on date;
begin
  select * into v_order from payment_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'approved' then
    return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved', 'idempotent', true,
      'completedAt', coalesce(v_order.completed_at, v_order.approved_at), 'expiresOn', v_order.service_expires_on);
  end if;
  if v_order.status not in ('reviewing', 'new_receipt_requested') then raise exception 'ORDER_NOT_REVIEWABLE'; end if;

  v_duration := coalesce(v_order.duration_months, p_duration_months);
  if v_duration is not null and (v_duration < 1 or v_duration > 120) then raise exception 'INVALID_PLAN_DURATION'; end if;
  if v_duration is not null then
    v_expires_on := ((v_completed_on + make_interval(months => v_duration))::date - 1);
  end if;

  select * into v_method from payment_methods where id = v_order.method_id for update;
  insert into payment_method_daily_counters(method_id, counter_date, confirmed_count)
  values (v_method.id, payment_baku_date(), 0) on conflict (method_id, counter_date) do nothing;
  select confirmed_count into v_count from payment_method_daily_counters
   where method_id = v_method.id and counter_date = payment_baku_date() for update;
  if v_method.limit_mode = 'limited' and v_count >= v_method.daily_limit then raise exception 'PAYMENT_METHOD_LIMIT_REACHED'; end if;

  update payment_method_daily_counters set confirmed_count = confirmed_count + 1, updated_at = now()
   where method_id = v_method.id and counter_date = payment_baku_date();
  update payment_orders set status = 'approved', approved_at = v_completed_at, completed_at = v_completed_at,
    duration_months = v_duration, service_expires_on = v_expires_on,
    expiry_notification_on = case when v_expires_on is null then null else v_expires_on - 1 end,
    rejected_at = null, updated_at = now() where id = v_order.id;
  update payment_reservations set status = 'completed', updated_at = now() where id = v_order.reservation_id;
  update payment_review_tokens set used_at = coalesce(used_at, now()) where order_id = v_order.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'order.approved', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'durationMonths', v_duration, 'expiresOn', v_expires_on));
  return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved', 'idempotent', false,
    'confirmedCount', v_count + 1, 'completedAt', v_completed_at, 'expiresOn', v_expires_on);
end;
$$;

create or replace function public.mark_payment_order_contacted(p_order_id uuid, p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order payment_orders%rowtype;
begin
  select * into v_order from payment_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'approved' then raise exception 'ORDER_NOT_COMPLETED'; end if;
  if v_order.contacted_at is not null then
    return jsonb_build_object('orderCode', v_order.order_code, 'contactedAt', v_order.contacted_at, 'idempotent', true);
  end if;
  update payment_orders set contacted_at = now(), updated_at = now() where id = v_order.id returning * into v_order;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'order.customer_contacted', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'contactedAt', v_order.contacted_at));
  return jsonb_build_object('orderCode', v_order.order_code, 'contactedAt', v_order.contacted_at, 'idempotent', false);
end;
$$;

create or replace function public.delete_payment_method_safely(p_method_id uuid, p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_method payment_methods%rowtype; v_active integer;
begin
  select * into v_method from payment_methods where id = p_method_id for update;
  if not found then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  if v_method.deleted_at is not null or v_method.archived then
    return jsonb_build_object('id', v_method.id, 'deleted', true, 'idempotent', true);
  end if;
  perform expire_payment_reservations();
  select count(*) into v_active from payment_reservations
   where method_id = p_method_id and status in ('reserved', 'reviewing')
     and (status = 'reviewing' or expires_at > now());
  if v_active > 0 then raise exception 'PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS'; end if;
  update payment_methods set active = false, archived = true, deactivated_at = coalesce(deactivated_at, now()),
    deleted_at = now(), updated_at = now() where id = p_method_id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'method.deleted', 'payment_method', p_method_id::text,
    jsonb_build_object('last4', v_method.last4));
  return jsonb_build_object('id', p_method_id, 'deleted', true, 'idempotent', false);
end;
$$;

create or replace function public.payment_order_statistics(
  p_tab text default 'all',
  p_search text default null,
  p_product_id text default null,
  p_plan_name text default null,
  p_method_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_today date default null
) returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select product_title, amount
      from payment_orders
     where status = 'approved'
       and completed_at is not null
       and (p_search is null or p_search = '' or order_code ilike ('%' || p_search || '%'))
       and (p_product_id is null or p_product_id = '' or product_id = p_product_id)
       and (p_plan_name is null or p_plan_name = '' or plan_name = p_plan_name)
       and (p_method_id is null or method_id = p_method_id)
       and (p_date_from is null or (completed_at at time zone 'Asia/Baku')::date >= p_date_from)
       and (p_date_to is null or (completed_at at time zone 'Asia/Baku')::date <= p_date_to)
       and (p_tab <> 'today' or (completed_at at time zone 'Asia/Baku')::date = coalesce(p_today, payment_baku_date()))
       and (p_tab <> 'expiring' or (contacted_at is null and expiry_notification_on is not null and expiry_notification_on <= coalesce(p_today, payment_baku_date())))
  ), grouped as (
    select product_title as title, count(*)::integer as count
      from filtered group by product_title order by count desc, product_title asc
  )
  select jsonb_build_object(
    'count', (select count(*) from filtered),
    'revenue', coalesce((select round(sum(amount), 2) from filtered), 0),
    'topProduct', coalesce((select title from grouped limit 1), '—'),
    'products', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'count', count) order by count desc, title asc) from grouped), '[]'::jsonb)
  );
$$;

revoke execute on function public.set_payment_order_duration(uuid, integer) from public, anon, authenticated;
revoke execute on function public.approve_payment_order_v2(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.mark_payment_order_contacted(uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_payment_method_safely(uuid, text) from public, anon, authenticated;
revoke execute on function public.payment_order_statistics(text, text, text, text, uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.set_payment_order_duration(uuid, integer) to service_role;
grant execute on function public.approve_payment_order_v2(uuid, integer, text) to service_role;
grant execute on function public.mark_payment_order_contacted(uuid, text) to service_role;
grant execute on function public.delete_payment_method_safely(uuid, text) to service_role;
grant execute on function public.payment_order_statistics(text, text, text, text, uuid, date, date, date) to service_role;

commit;
