-- New orders use a server-issued decimal number. Existing MP-* rows are preserved.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.payment_orders in share row exclusive mode;
create temporary table numeric_order_migration_guard on commit drop as
select count(*) as row_count, md5(string_agg(md5(to_jsonb(o)::text), '' order by id)) as fingerprint
from public.payment_orders o;
create table if not exists public.payment_order_number_counter (
  id boolean primary key default true check (id),
  last_number bigint not null check (last_number >= 970)
);
alter table public.payment_order_number_counter enable row level security;
revoke all on public.payment_order_number_counter from public, anon, authenticated;
insert into public.payment_order_number_counter (id, last_number)
select true, greatest(970, coalesce(max(order_code::bigint), 970))
from public.payment_orders where order_code ~ '^[0-9]{1,18}$'
on conflict (id) do update set last_number = greatest(payment_order_number_counter.last_number, excluded.last_number);

do $$
declare
  v_constraint text;
begin
  -- Keep every existing order row intact; only widen the accepted code format.
  for v_constraint in
    select conname
      from pg_constraint
     where conrelid = 'public.payment_orders'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%order_code%'
  loop
    execute format('alter table public.payment_orders drop constraint %I', v_constraint);
  end loop;
end;
$$;

alter table public.payment_orders
  add constraint payment_orders_order_code_check
  check (order_code ~ '^(MP-[A-F0-9]{6}|[1-9][0-9]*)$');

create or replace function public.submit_payment_order_v2(
  p_reservation_id uuid,
  p_checkout_key uuid,
  p_product_id text,
  p_plan_id text,
  p_product_title text,
  p_plan_name text,
  p_receipt_bucket text,
  p_receipt_path text,
  p_receipt_mime text,
  p_receipt_size integer,
  p_receipt_sha256 text,
  p_duration_months integer default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res public.payment_reservations%rowtype;
  v_order public.payment_orders%rowtype;
  v_order_code text;
begin
  select * into v_res from public.payment_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if p_checkout_key is null or v_res.checkout_key is distinct from p_checkout_key then
    raise exception 'RESERVATION_CHECKOUT_MISMATCH';
  end if;
  if v_res.product_id is distinct from p_product_id or v_res.plan_id is distinct from p_plan_id then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  select * into v_order from public.payment_orders where reservation_id = p_reservation_id;
  if found then
    return jsonb_build_object('id', v_order.id, 'orderCode', v_order.order_code, 'status', v_order.status, 'idempotent', true);
  end if;

  if v_res.status <> 'reserved' or v_res.expires_at <= now() then
    update public.payment_reservations set status = 'expired', updated_at = now()
      where id = v_res.id and status = 'reserved';
    raise exception 'RESERVATION_EXPIRED';
  end if;

  -- This row lock rolls back with the order; retries do not consume a number.
  update public.payment_order_number_counter set last_number = last_number + 1
  where id = true returning last_number::text into v_order_code;
  if v_order_code is null then raise exception 'ORDER_COUNTER_UNAVAILABLE'; end if;
  insert into public.payment_orders(order_code, reservation_id, method_id, product_id, product_title,
    plan_id, plan_name, amount, currency, receipt_bucket, receipt_path, receipt_mime,
    receipt_size, receipt_sha256, consent_accepted, duration_months)
  values (v_order_code, v_res.id, v_res.method_id, v_res.product_id, p_product_title,
    v_res.plan_id, p_plan_name, v_res.amount, v_res.currency, p_receipt_bucket, p_receipt_path,
    p_receipt_mime, p_receipt_size, p_receipt_sha256, true, p_duration_months)
  returning * into v_order;

  update public.payment_reservations set status = 'reviewing', updated_at = now() where id = v_res.id;
  insert into public.payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
  values ('customer', 'order.submitted', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'methodId', v_order.method_id));

  return jsonb_build_object('id', v_order.id, 'orderCode', v_order.order_code, 'status', v_order.status, 'idempotent', false);
end;
$$;

revoke execute on function public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer) from public, anon, authenticated;
grant execute on function public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer) to service_role;

do $$
begin
  if exists (
    select 1 from numeric_order_migration_guard before_state
    cross join (select count(*) as row_count, md5(string_agg(md5(to_jsonb(o)::text), '' order by id)) as fingerprint from public.payment_orders o) after_state
    where before_state.row_count <> after_state.row_count or before_state.fingerprint is distinct from after_state.fingerprint
  ) then raise exception 'EXISTING_ORDER_DATA_CHANGED'; end if;
end;
$$;

commit;
