begin;

-- Completion/reporting time and card-capacity day are deliberately independent:
-- old orders complete now, but never consume or validate today's/old counters.
create or replace function public.approve_payment_order_v7(
  p_order_id uuid,
  p_duration_months integer default null,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_order public.payment_orders%rowtype;
  v_reservation public.payment_reservations%rowtype;
  v_method public.payment_methods%rowtype;
  v_limit_day date;
  v_current_day date := public.payment_baku_date();
  v_count integer := 0;
  v_completed_at timestamptz := now();
  v_completed_on date := public.payment_baku_date(v_completed_at);
  v_duration integer;
  v_expires_on date;
  v_cost numeric(12,2);
  v_profit numeric(12,2);
  v_margin numeric(7,2);
  v_count_limit boolean;
begin
  perform pg_advisory_xact_lock(714025001);

  select * into v_order from public.payment_orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.status='approved' then
    select * into v_reservation from public.payment_reservations where id=v_order.reservation_id;
    v_limit_day := coalesce(public.payment_baku_date(v_reservation.created_at), public.payment_baku_date(v_order.created_at));
    return jsonb_build_object('orderCode',v_order.order_code,'status','approved','idempotent',true,
      'completedAt',coalesce(v_order.completed_at,v_order.approved_at),'expiresOn',v_order.service_expires_on,
      'usageDay',v_limit_day,'limitCounted',v_limit_day=v_current_day,'costSource',v_order.cost_source);
  end if;
  if v_order.status not in ('reviewing','new_receipt_requested') then raise exception 'ORDER_NOT_REVIEWABLE'; end if;

  select * into v_reservation from public.payment_reservations where id=v_order.reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;

  -- created_at is immutable and wins over the legacy usage_day/default. The order
  -- creation timestamp is the safe fallback for legacy rows without a reservation.
  v_limit_day := coalesce(public.payment_baku_date(v_reservation.created_at), public.payment_baku_date(v_order.created_at));
  if v_limit_day is null then raise exception 'ORDER_LIMIT_DAY_MISSING'; end if;
  if v_limit_day>v_current_day then raise exception 'ORDER_LIMIT_DAY_INVALID'; end if;
  v_count_limit := v_limit_day=v_current_day;

  v_duration := coalesce(v_order.duration_months,p_duration_months);
  if v_duration is not null and (v_duration<1 or v_duration>120) then raise exception 'INVALID_PLAN_DURATION'; end if;
  if v_duration is not null then v_expires_on:=((v_completed_on+make_interval(months=>v_duration))::date-1); end if;

  select cost_amount into v_cost from public.payment_plan_costs
   where product_id=v_order.product_id and plan_id=v_order.plan_id;
  if v_cost is not null then
    v_profit:=round(v_order.amount-v_cost,2);
    if v_order.amount<>0 then v_margin:=round((v_profit/v_order.amount)*100,2); end if;
  end if;

  select * into v_method from public.payment_methods where id=v_order.method_id for update;
  if not found then raise exception 'PAYMENT_METHOD_NOT_FOUND'; end if;

  if v_count_limit then
    insert into public.payment_method_daily_counters(method_id,counter_date,confirmed_count)
    values(v_method.id,v_current_day,0) on conflict(method_id,counter_date) do nothing;
    select confirmed_count into v_count from public.payment_method_daily_counters
     where method_id=v_method.id and counter_date=v_current_day for update;
    if v_method.limit_mode='limited' and v_count>=v_method.daily_limit then raise exception 'PAYMENT_METHOD_LIMIT_REACHED'; end if;
    update public.payment_method_daily_counters set confirmed_count=confirmed_count+1,updated_at=now()
     where method_id=v_method.id and counter_date=v_current_day;
  end if;

  update public.payment_orders set status='approved',approved_at=v_completed_at,completed_at=v_completed_at,
    duration_months=v_duration,service_expires_on=v_expires_on,
    expiry_notification_on=case when v_expires_on is null then null else v_expires_on-1 end,
    sale_price_snapshot=amount,cost_price_snapshot=v_cost,profit_snapshot=v_profit,profit_margin_snapshot=v_margin,
    cost_source=case when v_cost is null then null else 'approval_snapshot' end,rejected_at=null,updated_at=now()
   where id=v_order.id;
  update public.payment_reservations set status='completed',updated_at=now() where id=v_order.reservation_id;
  update public.payment_review_tokens set used_at=coalesce(used_at,now()) where order_id=v_order.id;
  insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
  values('admin',left(coalesce(p_actor,'admin'),120),'order.approved','order',v_order.id::text,
    jsonb_build_object('orderCode',v_order.order_code,'durationMonths',v_duration,'expiresOn',v_expires_on,
      'costSnapshotPresent',v_cost is not null,'usageDay',v_limit_day,'limitCounted',v_count_limit));

  if v_count_limit then perform public.refresh_payment_method_automation(); end if;
  return jsonb_build_object('orderCode',v_order.order_code,'status','approved','idempotent',false,
    'confirmedCount',case when v_count_limit then v_count+1 else null end,'completedAt',v_completed_at,
    'expiresOn',v_expires_on,'costSnapshotPresent',v_cost is not null,
    'costSource',case when v_cost is null then null else 'approval_snapshot' end,
    'usageDay',v_limit_day,'limitCounted',v_count_limit);
end;
$$;

revoke execute on function public.approve_payment_order_v7(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.approve_payment_order_v7(uuid,integer,text) to service_role;

commit;
