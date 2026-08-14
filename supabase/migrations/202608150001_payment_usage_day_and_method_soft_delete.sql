begin;

alter table public.payment_reservations
  add column if not exists usage_day date;

update public.payment_reservations
   set usage_day = public.payment_baku_date(created_at)
 where usage_day is null;

alter table public.payment_reservations
  alter column usage_day set default public.payment_baku_date(),
  alter column usage_day set not null;

create index if not exists payment_reservations_usage_capacity_idx
  on public.payment_reservations(method_id, usage_day, status, expires_at);

create table if not exists public.payment_daily_counter_migration_backups (
  migration_key text not null,
  method_id uuid not null references public.payment_methods(id) on delete restrict,
  counter_date date not null,
  confirmed_count integer not null,
  backed_up_at timestamptz not null default now(),
  primary key (migration_key, method_id, counter_date)
);

alter table public.payment_daily_counter_migration_backups enable row level security;
revoke all on table public.payment_daily_counter_migration_backups from public, anon, authenticated;
grant select, insert on table public.payment_daily_counter_migration_backups to service_role;

insert into public.payment_daily_counter_migration_backups(
  migration_key, method_id, counter_date, confirmed_count
)
select '202608150001_usage_day', method_id, counter_date, confirmed_count
  from public.payment_method_daily_counters
on conflict (migration_key, method_id, counter_date) do nothing;

with expected as (
  select o.method_id, r.usage_day as counter_date, count(distinct o.id)::integer as confirmed_count
    from public.payment_orders o
    join public.payment_reservations r on r.id = o.reservation_id
   where o.status in ('approved', 'completed')
   group by o.method_id, r.usage_day
)
update public.payment_method_daily_counters c
   set confirmed_count = coalesce((
         select e.confirmed_count from expected e
          where e.method_id = c.method_id and e.counter_date = c.counter_date
       ), 0),
       updated_at = now();

insert into public.payment_method_daily_counters(method_id, counter_date, confirmed_count)
select o.method_id, r.usage_day, count(distinct o.id)::integer
  from public.payment_orders o
  join public.payment_reservations r on r.id = o.reservation_id
 where o.status in ('approved', 'completed')
 group by o.method_id, r.usage_day
on conflict (method_id, counter_date) do update
  set confirmed_count = excluded.confirmed_count,
      updated_at = now();

create or replace function public.reserve_payment_method_v2(
  p_method_id uuid,
  p_product_id text,
  p_plan_id text,
  p_amount numeric,
  p_currency text,
  p_idempotency_key uuid,
  p_checkout_key uuid,
  p_previous_reservation_id uuid default null,
  p_minutes integer default 10
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_method payment_methods%rowtype;
  v_existing payment_reservations%rowtype;
  v_active payment_reservations%rowtype;
  v_confirmed integer := 0;
  v_pending integer := 0;
  v_reservation payment_reservations%rowtype;
  v_usage_day date := payment_baku_date();
begin
  if p_checkout_key is null then raise exception 'CHECKOUT_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_checkout_key::text, 0));
  perform expire_payment_reservations();

  select * into v_existing from payment_reservations where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.method_id <> p_method_id or v_existing.product_id <> p_product_id or
       v_existing.plan_id <> p_plan_id or v_existing.checkout_key is distinct from p_checkout_key then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
      'expiresAt', v_existing.expires_at, 'idempotent', true,
      'checkoutKey', v_existing.checkout_key, 'usageDay', v_existing.usage_day);
  end if;

  select * into v_active from payment_reservations
   where checkout_key = p_checkout_key and status in ('reserved', 'reviewing')
   order by created_at desc limit 1 for update;
  if found then
    if v_active.status = 'reviewing' then raise exception 'RESERVATION_ALREADY_SUBMITTED'; end if;
    if p_previous_reservation_id is null or v_active.id <> p_previous_reservation_id then
      raise exception 'ACTIVE_RESERVATION_EXISTS';
    end if;
    update payment_reservations set status = 'cancelled', updated_at = now() where id = v_active.id;
    insert into payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
    values ('customer', 'reservation.replaced', 'reservation', v_active.id::text,
      jsonb_build_object('newMethodId', p_method_id, 'checkoutKey', p_checkout_key,
        'usageDay', v_active.usage_day));
  elsif p_previous_reservation_id is not null then
    select * into v_existing from payment_reservations where id = p_previous_reservation_id for update;
    if found and v_existing.checkout_key is distinct from p_checkout_key then
      raise exception 'RESERVATION_CHECKOUT_MISMATCH';
    end if;
  end if;

  select * into v_method from payment_methods where id = p_method_id for update;
  if not found or not v_method.active or v_method.archived or v_method.deleted_at is not null or
     v_method.encrypted_number is null then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;
  select coalesce(confirmed_count, 0) into v_confirmed
    from payment_method_daily_counters
   where method_id = p_method_id and counter_date = v_usage_day;
  select count(*) into v_pending from payment_reservations
   where method_id = p_method_id and usage_day = v_usage_day
     and status in ('reserved', 'reviewing')
     and (status = 'reviewing' or expires_at > now());
  if v_method.limit_mode = 'limited' and v_confirmed + v_pending >= v_method.daily_limit then
    raise exception 'PAYMENT_METHOD_LIMIT_REACHED';
  end if;

  insert into payment_reservations(
    method_id, product_id, plan_id, amount, currency, idempotency_key,
    checkout_key, usage_day, expires_at
  ) values (
    p_method_id, p_product_id, p_plan_id, p_amount, p_currency, p_idempotency_key,
    p_checkout_key, v_usage_day,
    now() + make_interval(mins => greatest(1, least(p_minutes, 30)))
  ) returning * into v_reservation;
  insert into payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
  values ('customer', 'reservation.created', 'reservation', v_reservation.id::text,
    jsonb_build_object('methodId', p_method_id, 'expiresAt', v_reservation.expires_at,
      'checkoutKey', p_checkout_key, 'usageDay', v_reservation.usage_day));
  return jsonb_build_object('id', v_reservation.id, 'status', v_reservation.status,
    'expiresAt', v_reservation.expires_at, 'idempotent', false,
    'checkoutKey', v_reservation.checkout_key, 'usageDay', v_reservation.usage_day);
end;
$$;

create or replace function public.approve_payment_order_v5(
  p_order_id uuid,
  p_duration_months integer default null,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order payment_orders%rowtype;
  v_reservation payment_reservations%rowtype;
  v_method payment_methods%rowtype;
  v_usage_day date;
  v_count integer;
  v_completed_at timestamptz := now();
  v_completed_on date := payment_baku_date(v_completed_at);
  v_duration integer;
  v_expires_on date;
  v_cost numeric(12,2);
  v_profit numeric(12,2);
  v_margin numeric(7,2);
begin
  select * into v_order from payment_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'approved' then
    select usage_day into v_usage_day from payment_reservations where id = v_order.reservation_id;
    return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved',
      'idempotent', true, 'completedAt', coalesce(v_order.completed_at, v_order.approved_at),
      'expiresOn', v_order.service_expires_on, 'usageDay', v_usage_day,
      'costSource', v_order.cost_source);
  end if;
  if v_order.status not in ('reviewing', 'new_receipt_requested') then
    raise exception 'ORDER_NOT_REVIEWABLE';
  end if;

  select * into v_reservation from payment_reservations
   where id = v_order.reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  v_usage_day := coalesce(v_reservation.usage_day, payment_baku_date(v_reservation.created_at));
  v_duration := coalesce(v_order.duration_months, p_duration_months);
  if v_duration is not null and (v_duration < 1 or v_duration > 120) then
    raise exception 'INVALID_PLAN_DURATION';
  end if;
  if v_duration is not null then
    v_expires_on := ((v_completed_on + make_interval(months => v_duration))::date - 1);
  end if;
  select cost_amount into v_cost from payment_plan_costs
   where product_id = v_order.product_id and plan_id = v_order.plan_id;
  if v_cost is not null then
    v_profit := round(v_order.amount - v_cost, 2);
    if v_order.amount <> 0 then v_margin := round((v_profit / v_order.amount) * 100, 2); end if;
  end if;

  select * into v_method from payment_methods where id = v_order.method_id for update;
  if not found then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  insert into payment_method_daily_counters(method_id, counter_date, confirmed_count)
  values (v_method.id, v_usage_day, 0) on conflict (method_id, counter_date) do nothing;
  select confirmed_count into v_count from payment_method_daily_counters
   where method_id = v_method.id and counter_date = v_usage_day for update;
  if v_method.limit_mode = 'limited' and v_count >= v_method.daily_limit then
    raise exception 'PAYMENT_METHOD_LIMIT_REACHED';
  end if;
  update payment_method_daily_counters
     set confirmed_count = confirmed_count + 1, updated_at = now()
   where method_id = v_method.id and counter_date = v_usage_day;
  update payment_orders set
    status = 'approved', approved_at = v_completed_at, completed_at = v_completed_at,
    duration_months = v_duration, service_expires_on = v_expires_on,
    expiry_notification_on = case when v_expires_on is null then null else v_expires_on - 1 end,
    sale_price_snapshot = amount, cost_price_snapshot = v_cost, profit_snapshot = v_profit,
    profit_margin_snapshot = v_margin,
    cost_source = case when v_cost is null then null else 'approval_snapshot' end,
    rejected_at = null, updated_at = now()
   where id = v_order.id;
  update payment_reservations set status = 'completed', updated_at = now()
   where id = v_order.reservation_id;
  update payment_review_tokens set used_at = coalesce(used_at, now()) where order_id = v_order.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', left(coalesce(p_actor, 'admin'), 120), 'order.approved', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'durationMonths', v_duration,
      'expiresOn', v_expires_on, 'costSnapshotPresent', v_cost is not null,
      'usageDay', v_usage_day));
  return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved',
    'idempotent', false, 'confirmedCount', v_count + 1, 'completedAt', v_completed_at,
    'expiresOn', v_expires_on, 'costSnapshotPresent', v_cost is not null,
    'costSource', case when v_cost is null then null else 'approval_snapshot' end,
    'usageDay', v_usage_day);
end;
$$;

create or replace function public.delete_payment_method_safely(
  p_method_id uuid,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_method payment_methods%rowtype;
  v_active integer := 0;
begin
  select * into v_method from payment_methods where id = p_method_id for update;
  if not found then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;
  if v_method.deleted_at is not null or v_method.archived then
    return jsonb_build_object('id', v_method.id, 'deleted', true,
      'idempotent', true, 'activeProcesses', 0);
  end if;
  perform expire_payment_reservations();
  select count(*) into v_active from payment_reservations
   where method_id = p_method_id
     and (status = 'reviewing' or (status = 'reserved' and expires_at > now()));
  update payment_methods set
    active = false, archived = true,
    deactivated_at = coalesce(deactivated_at, now()),
    deleted_at = coalesce(deleted_at, now()), updated_at = now()
   where id = p_method_id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', left(coalesce(p_actor, 'admin'), 120), 'method.deleted',
    'payment_method', p_method_id::text,
    jsonb_build_object('softDelete', true, 'activeProcessesPreserved', v_active));
  return jsonb_build_object('id', p_method_id, 'deleted', true,
    'idempotent', false, 'activeProcesses', v_active);
end;
$$;

revoke execute on function public.reserve_payment_method_v2(uuid,text,text,numeric,text,uuid,uuid,uuid,integer)
  from public, anon, authenticated;
revoke execute on function public.approve_payment_order_v5(uuid,integer,text)
  from public, anon, authenticated;
revoke execute on function public.delete_payment_method_safely(uuid,text)
  from public, anon, authenticated;
grant execute on function public.reserve_payment_method_v2(uuid,text,text,numeric,text,uuid,uuid,uuid,integer)
  to service_role;
grant execute on function public.approve_payment_order_v5(uuid,integer,text) to service_role;
grant execute on function public.delete_payment_method_safely(uuid,text) to service_role;

commit;
