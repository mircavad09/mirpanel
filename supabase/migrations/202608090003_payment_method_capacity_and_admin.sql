begin;

create index if not exists payment_methods_visible_order_idx
  on public.payment_methods(sort_order, created_at)
  where deleted_at is null and archived = false;

create or replace function public.cancel_customer_payment_reservation(
  p_reservation_id uuid,
  p_checkout_key uuid,
  p_actor text default 'customer'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res payment_reservations%rowtype;
begin
  if p_checkout_key is null then raise exception 'CHECKOUT_KEY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_checkout_key::text, 0));
  select * into v_res from payment_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_res.checkout_key is distinct from p_checkout_key then raise exception 'RESERVATION_CHECKOUT_MISMATCH'; end if;
  if v_res.status = 'reviewing' then raise exception 'RESERVATION_ALREADY_SUBMITTED'; end if;
  if v_res.status in ('completed', 'rejected', 'cancelled', 'expired') then
    return jsonb_build_object('id', v_res.id, 'status', v_res.status, 'idempotent', true);
  end if;
  update payment_reservations set status = 'cancelled', updated_at = now() where id = v_res.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('customer', p_actor, 'reservation.cancelled', 'reservation', v_res.id::text,
    jsonb_build_object('checkoutKey', p_checkout_key));
  return jsonb_build_object('id', v_res.id, 'status', 'cancelled', 'idempotent', false);
end;
$$;

create or replace function public.update_payment_method_admin(
  p_method_id uuid,
  p_display_name text,
  p_method_type text,
  p_provider_name text,
  p_holder_name text,
  p_encrypted_number text,
  p_last4 text,
  p_color text,
  p_icon text,
  p_theme text,
  p_active boolean,
  p_sort_order integer,
  p_daily_limit integer,
  p_limit_mode text,
  p_admin_note text,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_method payment_methods%rowtype;
  v_active_reservations integer := 0;
begin
  select * into v_method from payment_methods where id = p_method_id for update;
  if not found or v_method.deleted_at is not null or v_method.archived then
    raise exception 'PAYMENT_METHOD_NOT_FOUND';
  end if;

  perform expire_payment_reservations();
  if v_method.active and not p_active then
    select count(*) into v_active_reservations
      from payment_reservations
     where method_id = p_method_id
       and (status = 'reviewing' or (status = 'reserved' and expires_at > now()));
    if v_active_reservations > 0 then raise exception 'PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS'; end if;
  end if;

  if p_active and coalesce(p_encrypted_number, v_method.encrypted_number) is null then
    raise exception 'PAYMENT_METHOD_NUMBER_REQUIRED';
  end if;

  update payment_methods set
    display_name = p_display_name,
    method_type = p_method_type,
    provider_name = p_provider_name,
    holder_name = p_holder_name,
    encrypted_number = coalesce(p_encrypted_number, encrypted_number),
    last4 = coalesce(p_last4, last4),
    color = p_color,
    icon = p_icon,
    theme = p_theme,
    active = p_active,
    sort_order = p_sort_order,
    daily_limit = p_daily_limit,
    limit_mode = p_limit_mode,
    admin_note = p_admin_note,
    deactivated_at = case when p_active then null else coalesce(deactivated_at, now()) end,
    updated_at = now()
  where id = p_method_id
  returning * into v_method;

  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'method.updated', 'payment_method', p_method_id::text,
    jsonb_build_object('numberChanged', p_encrypted_number is not null, 'active', p_active));

  return jsonb_build_object('id', v_method.id, 'active', v_method.active, 'updatedAt', v_method.updated_at);
end;
$$;

revoke execute on function public.cancel_customer_payment_reservation(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.cancel_customer_payment_reservation(uuid, uuid, text) to service_role;
grant execute on function public.update_payment_method_admin(uuid,text,text,text,text,text,text,text,text,text,boolean,integer,integer,text,text,text) to service_role;

commit;
