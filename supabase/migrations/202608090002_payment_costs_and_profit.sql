begin;

create table if not exists public.payment_plan_costs (
  product_id text not null,
  plan_id text not null,
  cost_amount numeric(12,2) not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'admin',
  primary key (product_id, plan_id),
  constraint payment_plan_costs_amount_check check (cost_amount >= 0 and cost_amount <= 9999999.99)
);

alter table public.payment_plan_costs enable row level security;
revoke all on table public.payment_plan_costs from public, anon, authenticated;
grant all on table public.payment_plan_costs to service_role;

alter table public.payment_orders
  add column if not exists sale_price_snapshot numeric(12,2),
  add column if not exists cost_price_snapshot numeric(12,2),
  add column if not exists profit_snapshot numeric(12,2),
  add column if not exists profit_margin_snapshot numeric(7,2);

alter table public.payment_orders drop constraint if exists payment_orders_sale_snapshot_check;
alter table public.payment_orders add constraint payment_orders_sale_snapshot_check
  check (sale_price_snapshot is null or sale_price_snapshot >= 0);
alter table public.payment_orders drop constraint if exists payment_orders_cost_snapshot_check;
alter table public.payment_orders add constraint payment_orders_cost_snapshot_check
  check (cost_price_snapshot is null or cost_price_snapshot >= 0);

create or replace function public.save_payment_plan_costs(p_items jsonb, p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_product_id text;
  v_plan_id text;
  v_cost numeric(12,2);
  v_changed integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then raise exception 'INVALID_COST_BATCH'; end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := left(trim(coalesce(v_item->>'productId', '')), 100);
    v_plan_id := left(trim(coalesce(v_item->>'planId', '')), 100);
    if v_product_id = '' or v_plan_id = '' then raise exception 'INVALID_COST_KEY'; end if;
    if v_item->>'cost' is null then
      delete from payment_plan_costs where product_id = v_product_id and plan_id = v_plan_id;
      if found then v_changed := v_changed + 1; end if;
    else
      begin v_cost := (v_item->>'cost')::numeric(12,2);
      exception when others then raise exception 'INVALID_COST_AMOUNT'; end;
      if v_cost < 0 or v_cost > 9999999.99 then raise exception 'INVALID_COST_AMOUNT'; end if;
      insert into payment_plan_costs(product_id, plan_id, cost_amount, updated_by)
      values (v_product_id, v_plan_id, v_cost, left(coalesce(p_actor, 'admin'), 120))
      on conflict (product_id, plan_id) do update set
        cost_amount = excluded.cost_amount, updated_at = now(), updated_by = excluded.updated_by
      where payment_plan_costs.cost_amount is distinct from excluded.cost_amount;
      if found then v_changed := v_changed + 1; end if;
    end if;
  end loop;
  if v_changed > 0 then
    insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
    values ('admin', left(coalesce(p_actor, 'admin'), 120), 'costs.updated', 'payment_plan_costs', 'batch', jsonb_build_object('changed', v_changed));
  end if;
  return jsonb_build_object('changed', v_changed, 'idempotent', v_changed = 0);
end;
$$;

create or replace function public.approve_payment_order_v3(
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
  v_cost numeric(12,2);
  v_profit numeric(12,2);
  v_margin numeric(7,2);
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
  if v_duration is not null then v_expires_on := ((v_completed_on + make_interval(months => v_duration))::date - 1); end if;
  select cost_amount into v_cost from payment_plan_costs where product_id = v_order.product_id and plan_id = v_order.plan_id;
  if v_cost is not null then
    v_profit := round(v_order.amount - v_cost, 2);
    if v_order.amount <> 0 then v_margin := round((v_profit / v_order.amount) * 100, 2); end if;
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
    sale_price_snapshot = amount, cost_price_snapshot = v_cost, profit_snapshot = v_profit,
    profit_margin_snapshot = v_margin, rejected_at = null, updated_at = now() where id = v_order.id;
  update payment_reservations set status = 'completed', updated_at = now() where id = v_order.reservation_id;
  update payment_review_tokens set used_at = coalesce(used_at, now()) where order_id = v_order.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'order.approved', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'durationMonths', v_duration, 'expiresOn', v_expires_on, 'costSnapshotPresent', v_cost is not null));
  return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved', 'idempotent', false,
    'confirmedCount', v_count + 1, 'completedAt', v_completed_at, 'expiresOn', v_expires_on, 'costSnapshotPresent', v_cost is not null);
end;
$$;

create or replace function public.payment_order_profit_statistics(
  p_tab text default 'all', p_search text default null, p_product_id text default null,
  p_plan_name text default null, p_method_id uuid default null, p_date_from date default null,
  p_date_to date default null, p_today date default null
) returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select product_title, coalesce(sale_price_snapshot, amount) as sale,
      cost_price_snapshot as cost, profit_snapshot as profit
    from payment_orders
    where status in ('approved', 'completed') and completed_at is not null
      and (p_search is null or p_search = '' or order_code ilike ('%' || p_search || '%'))
      and (p_product_id is null or p_product_id = '' or product_id = p_product_id)
      and (p_plan_name is null or p_plan_name = '' or plan_name = p_plan_name)
      and (p_method_id is null or method_id = p_method_id)
      and (p_date_from is null or (completed_at at time zone 'Asia/Baku')::date >= p_date_from)
      and (p_date_to is null or (completed_at at time zone 'Asia/Baku')::date <= p_date_to)
      and (p_tab <> 'today' or (completed_at at time zone 'Asia/Baku')::date = coalesce(p_today, payment_baku_date()))
      and (p_tab <> 'expiring' or (contacted_at is null and expiry_notification_on is not null and expiry_notification_on <= coalesce(p_today, payment_baku_date())))
  ), grouped as (
    select product_title as title, count(*)::integer as count, round(sum(sale),2) as revenue,
      round(coalesce(sum(cost) filter (where cost is not null),0),2) as cost,
      round(coalesce(sum(profit) filter (where cost is not null),0),2) as profit,
      (count(*) filter (where cost is null))::integer as missing,
      count(cost)::integer as known_count,
      round(coalesce(sum(sale) filter (where cost is not null),0),2) as profit_revenue
    from filtered group by product_title
  )
  select jsonb_build_object(
    'count', (select count(*) from filtered),
    'revenue', coalesce((select round(sum(sale),2) from filtered),0),
    'cost', coalesce((select round(sum(cost),2) from filtered where cost is not null),0),
    'profit', coalesce((select round(sum(profit),2) from filtered where cost is not null),0),
    'profitMargin', (select round((sum(profit) filter (where cost is not null)) / nullif((sum(sale) filter (where cost is not null)),0) * 100,2) from filtered),
    'missingCostCount', (select count(*) from filtered where cost is null),
    'topProduct', coalesce((select title from grouped order by count desc,title limit 1),'—'),
    'topProfitProduct', coalesce((select title from grouped where known_count>0 order by profit desc,title limit 1),'—'),
    'products', coalesce((select jsonb_agg(jsonb_build_object('title',title,'count',count,'revenue',revenue,'cost',cost,'profit',profit,
      'margin',case when profit_revenue=0 then null else round(profit/profit_revenue*100,2) end,'missingCostCount',missing) order by profit desc,title) from grouped),'[]'::jsonb)
  );
$$;

revoke execute on function public.save_payment_plan_costs(jsonb,text) from public,anon,authenticated;
revoke execute on function public.approve_payment_order_v3(uuid,integer,text) from public,anon,authenticated;
revoke execute on function public.payment_order_profit_statistics(text,text,text,text,uuid,date,date,date) from public,anon,authenticated;
grant execute on function public.save_payment_plan_costs(jsonb,text) to service_role;
grant execute on function public.approve_payment_order_v3(uuid,integer,text) to service_role;
grant execute on function public.payment_order_profit_statistics(text,text,text,text,uuid,date,date,date) to service_role;

commit;
