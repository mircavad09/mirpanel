begin;

alter table public.payment_methods
  add column if not exists theme text not null default 'auto';

alter table public.payment_methods
  drop constraint if exists payment_methods_theme_check;

alter table public.payment_methods
  add constraint payment_methods_theme_check
  check (theme in ('auto', 'leo', 'abb', 'kapital', 'm10', 'neutral'));

alter table public.payment_reservations
  add column if not exists checkout_key uuid;

create unique index if not exists payment_reservations_one_active_checkout_idx
  on public.payment_reservations(checkout_key)
  where checkout_key is not null and status in ('reserved', 'reviewing');

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
      'expiresAt', v_existing.expires_at, 'idempotent', true, 'checkoutKey', v_existing.checkout_key);
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
      jsonb_build_object('newMethodId', p_method_id, 'checkoutKey', p_checkout_key));
  elsif p_previous_reservation_id is not null then
    select * into v_existing from payment_reservations where id = p_previous_reservation_id for update;
    if found and v_existing.checkout_key is distinct from p_checkout_key then
      raise exception 'RESERVATION_CHECKOUT_MISMATCH';
    end if;
  end if;

  select * into v_method from payment_methods where id = p_method_id for update;
  if not found or not v_method.active or v_method.archived or v_method.encrypted_number is null then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;

  select coalesce(confirmed_count, 0) into v_confirmed
    from payment_method_daily_counters
   where method_id = p_method_id and counter_date = payment_baku_date();
  select count(*) into v_pending from payment_reservations
   where method_id = p_method_id and status in ('reserved', 'reviewing')
     and (status = 'reviewing' or expires_at > now());

  if v_method.limit_mode = 'limited' and v_confirmed + v_pending >= v_method.daily_limit then
    raise exception 'PAYMENT_METHOD_LIMIT_REACHED';
  end if;

  insert into payment_reservations(
    method_id, product_id, plan_id, amount, currency, idempotency_key, checkout_key, expires_at
  ) values (
    p_method_id, p_product_id, p_plan_id, p_amount, p_currency, p_idempotency_key, p_checkout_key,
    now() + make_interval(mins => greatest(1, least(p_minutes, 30)))
  ) returning * into v_reservation;

  insert into payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
  values ('customer', 'reservation.created', 'reservation', v_reservation.id::text,
    jsonb_build_object('methodId', p_method_id, 'expiresAt', v_reservation.expires_at, 'checkoutKey', p_checkout_key));

  return jsonb_build_object('id', v_reservation.id, 'status', v_reservation.status,
    'expiresAt', v_reservation.expires_at, 'idempotent', false, 'checkoutKey', v_reservation.checkout_key);
end;
$$;

revoke execute on function public.reserve_payment_method_v2(uuid, text, text, numeric, text, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_payment_method_v2(uuid, text, text, numeric, text, uuid, uuid, uuid, integer)
  to service_role;

commit;
