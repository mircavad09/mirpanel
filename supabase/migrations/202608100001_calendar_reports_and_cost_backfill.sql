begin;

alter table public.payment_orders
  add column if not exists cost_source text,
  add column if not exists cost_backfilled_at timestamptz,
  add column if not exists cost_backfill_product_id text,
  add column if not exists cost_backfill_plan_id text;

alter table public.payment_orders drop constraint if exists payment_orders_cost_source_check;
alter table public.payment_orders add constraint payment_orders_cost_source_check
  check (cost_source is null or cost_source in ('approval_snapshot', 'backfilled_current_cost'));

create table if not exists public.payment_cost_backfill_backups (
  order_id uuid primary key references public.payment_orders(id) on delete restrict,
  batch_digest text not null,
  backed_up_at timestamptz not null default now(),
  backed_up_by text not null,
  snapshot jsonb not null
);
alter table public.payment_cost_backfill_backups enable row level security;
revoke all on table public.payment_cost_backfill_backups from public, anon, authenticated;
grant select, insert on table public.payment_cost_backfill_backups to service_role;

create index if not exists payment_orders_completed_baku_day_idx
  on public.payment_orders (((completed_at at time zone 'Asia/Baku')::date), completed_at desc)
  where status in ('approved', 'completed') and completed_at is not null;

create or replace function public.approve_payment_order_v4(
  p_order_id uuid,
  p_duration_months integer default null,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  v_result := public.approve_payment_order_v3(p_order_id, p_duration_months, p_actor);
  if coalesce((v_result->>'idempotent')::boolean, false) = false then
    update payment_orders
       set cost_source = case when cost_price_snapshot is null then null else 'approval_snapshot' end
     where id = p_order_id;
  end if;
  return v_result || jsonb_build_object('costSource', (
    select cost_source from payment_orders where id = p_order_id
  ));
end;
$$;

create or replace function public.payment_order_profit_statistics_v2(
  p_tab text default 'all', p_search text default null, p_product_id text default null,
  p_plan_name text default null, p_method_id uuid default null, p_date_from date default null,
  p_date_to date default null, p_today date default null
) returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select product_id, product_title, plan_id, plan_name,
      (completed_at at time zone 'Asia/Baku')::date as completed_day,
      coalesce(sale_price_snapshot, amount) as sale,
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
  ), product_grouped as (
    select product_id, product_title as title, count(*)::integer as count,
      round(sum(sale),2) as revenue,
      round(coalesce(sum(cost) filter (where cost is not null),0),2) as cost,
      round(coalesce(sum(profit) filter (where cost is not null),0),2) as profit,
      (count(*) filter (where cost is null))::integer as missing,
      round(coalesce(sum(sale) filter (where cost is not null),0),2) as known_revenue
    from filtered group by product_id, product_title
  ), plan_grouped as (
    select product_id, product_title, plan_id, plan_name, count(*)::integer as count,
      round(sum(sale),2) as revenue,
      round(coalesce(sum(cost) filter (where cost is not null),0),2) as cost,
      round(coalesce(sum(profit) filter (where cost is not null),0),2) as profit,
      (count(*) filter (where cost is null))::integer as missing
    from filtered group by product_id, product_title, plan_id, plan_name
  ), day_grouped as (
    select completed_day as day, count(*)::integer as count,
      round(sum(sale),2) as revenue,
      round(coalesce(sum(cost) filter (where cost is not null),0),2) as cost,
      round(coalesce(sum(profit) filter (where cost is not null),0),2) as profit,
      (count(*) filter (where cost is null))::integer as missing
    from filtered group by completed_day
  )
  select jsonb_build_object(
    'count', (select count(*) from filtered),
    'revenue', coalesce((select round(sum(sale),2) from filtered),0),
    'cost', coalesce((select round(sum(cost),2) from filtered where cost is not null),0),
    'profit', coalesce((select round(sum(profit),2) from filtered where cost is not null),0),
    'profitMargin', (select round((sum(profit) filter (where cost is not null)) /
      nullif((sum(sale) filter (where cost is not null)),0) * 100,2) from filtered),
    'missingCostCount', (select count(*) from filtered where cost is null),
    'topProduct', coalesce((select title from product_grouped order by count desc,title limit 1),'—'),
    'topProfitProduct', coalesce((select title from product_grouped where known_revenue>0 order by profit desc,title limit 1),'—'),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
      'productId',product_id,'title',title,'count',count,'revenue',revenue,'cost',cost,'profit',profit,
      'margin',case when known_revenue=0 then null else round(profit/known_revenue*100,2) end,
      'missingCostCount',missing) order by count desc,title) from product_grouped),'[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
      'productId',product_id,'productTitle',product_title,'planId',plan_id,'planName',plan_name,
      'count',count,'revenue',revenue,'cost',cost,'profit',profit,'missingCostCount',missing)
      order by count desc,product_title,plan_name) from plan_grouped),'[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object(
      'date',day,'count',count,'revenue',revenue,'cost',cost,'profit',profit,'missingCostCount',missing)
      order by day desc) from day_grouped),'[]'::jsonb)
  );
$$;

create or replace function public.payment_cost_backfill_preview()
returns jsonb language sql stable security definer set search_path = public as $$
  with targets as (
    select o.id, o.order_code, o.product_id, o.product_title, o.plan_id, o.plan_name,
      o.duration_months, coalesce(o.sale_price_snapshot,o.amount) as sale,
      c.cost_amount as cost,
      case when c.cost_amount is null then null else round(coalesce(o.sale_price_snapshot,o.amount)-c.cost_amount,2) end as profit
    from payment_orders o
    left join payment_plan_costs c on c.product_id=o.product_id and c.plan_id=o.plan_id
    where o.status in ('approved','completed') and o.completed_at is not null and o.cost_price_snapshot is null
  ), matched as (select * from targets where cost is not null), digest as (
    select md5(coalesce(string_agg(id::text || ':' || cost::text, ',' order by id),'')) as value from matched
  )
  select jsonb_build_object(
    'missingCount',(select count(*) from targets),
    'matchedCount',(select count(*) from matched),
    'unmatchedCount',(select count(*) from targets where cost is null),
    'digest',(select value from digest),
    'sale',coalesce((select round(sum(sale),2) from matched),0),
    'cost',coalesce((select round(sum(cost),2) from matched),0),
    'profit',coalesce((select round(sum(profit),2) from matched),0),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'orderId',id,'orderCode',order_code,'productId',product_id,'productTitle',product_title,
      'planId',plan_id,'planName',plan_name,'durationMonths',duration_months,
      'sale',sale,'cost',cost,'profit',profit,'matched',cost is not null
    ) order by order_code) from targets),'[]'::jsonb)
  );
$$;

create or replace function public.backfill_payment_order_cost_snapshots(
  p_expected_count integer,
  p_expected_digest text,
  p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_digest text;
  v_changed integer := 0;
begin
  perform 1 from payment_orders o
   where o.status in ('approved','completed') and o.completed_at is not null and o.cost_price_snapshot is null
   for update;

  select count(*), md5(coalesce(string_agg(o.id::text || ':' || c.cost_amount::text, ',' order by o.id),''))
    into v_count, v_digest
    from payment_orders o
    join payment_plan_costs c on c.product_id=o.product_id and c.plan_id=o.plan_id
   where o.status in ('approved','completed') and o.completed_at is not null and o.cost_price_snapshot is null;

  if v_count <> p_expected_count or v_digest is distinct from p_expected_digest then
    raise exception 'BACKFILL_PREVIEW_CHANGED';
  end if;

  insert into payment_cost_backfill_backups(order_id,batch_digest,backed_up_by,snapshot)
  select o.id, v_digest, left(coalesce(p_actor,'admin'),120), jsonb_build_object(
    'orderCode',o.order_code,'status',o.status,'amount',o.amount,
    'salePriceSnapshot',o.sale_price_snapshot,'costPriceSnapshot',o.cost_price_snapshot,
    'profitSnapshot',o.profit_snapshot,'profitMarginSnapshot',o.profit_margin_snapshot,
    'costSource',o.cost_source,'costBackfilledAt',o.cost_backfilled_at,
    'productId',o.product_id,'productTitle',o.product_title,
    'planId',o.plan_id,'planName',o.plan_name,'completedAt',o.completed_at,
    'serviceStartedAt',o.completed_at,'serviceExpiresOn',o.service_expires_on
  )
  from payment_orders o
  join payment_plan_costs c on c.product_id=o.product_id and c.plan_id=o.plan_id
  where o.status in ('approved','completed') and o.completed_at is not null
    and o.cost_price_snapshot is null
  on conflict (order_id) do nothing;

  update payment_orders o set
    sale_price_snapshot=coalesce(o.sale_price_snapshot,o.amount),
    cost_price_snapshot=c.cost_amount,
    profit_snapshot=round(coalesce(o.sale_price_snapshot,o.amount)-c.cost_amount,2),
    profit_margin_snapshot=case when coalesce(o.sale_price_snapshot,o.amount)=0 then null else
      round(((coalesce(o.sale_price_snapshot,o.amount)-c.cost_amount)/coalesce(o.sale_price_snapshot,o.amount))*100,2) end,
    cost_source='backfilled_current_cost', cost_backfilled_at=now(),
    cost_backfill_product_id=o.product_id, cost_backfill_plan_id=o.plan_id,
    updated_at=now()
  from payment_plan_costs c
  where o.product_id=c.product_id and o.plan_id=c.plan_id
    and o.status in ('approved','completed') and o.completed_at is not null and o.cost_price_snapshot is null;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
    values ('admin',left(coalesce(p_actor,'admin'),120),'orders.cost_backfilled','payment_orders','batch',
      jsonb_build_object('changed',v_changed,'digest',v_digest,'costSource','backfilled_current_cost'));
  end if;
  return jsonb_build_object('changed',v_changed,'idempotent',v_changed=0,'digest',v_digest);
end;
$$;

create or replace function public.payment_finance_snapshot()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ordersTotal',(select count(*) from payment_orders),
    'pending',(select count(*) from payment_orders where status in ('reviewing','new_receipt_requested')),
    'completed',(select count(*) from payment_orders where status in ('approved','completed')),
    'rejected',(select count(*) from payment_orders where status='rejected'),
    'activeReservations',(select count(*) from payment_reservations where status='reviewing' or (status='reserved' and expires_at>now())),
    'dailyConfirmed',(select coalesce(sum(confirmed_count),0) from payment_method_daily_counters where counter_date=payment_baku_date()),
    'costPlansTotal',(select count(*) from payment_plan_costs),
    'existingCostSnapshots',(select count(*) from payment_orders where status in ('approved','completed') and cost_price_snapshot is not null),
    'missingCost',(select count(*) from payment_orders where status in ('approved','completed') and cost_price_snapshot is null),
    'revenue',(select coalesce(round(sum(coalesce(sale_price_snapshot,amount)),2),0) from payment_orders where status in ('approved','completed')),
    'cost',(select coalesce(round(sum(cost_price_snapshot),2),0) from payment_orders where status in ('approved','completed') and cost_price_snapshot is not null),
    'profit',(select coalesce(round(sum(profit_snapshot),2),0) from payment_orders where status in ('approved','completed') and cost_price_snapshot is not null),
    'capturedAt',now()
  );
$$;

revoke execute on function public.approve_payment_order_v4(uuid,integer,text) from public,anon,authenticated;
revoke execute on function public.payment_order_profit_statistics_v2(text,text,text,text,uuid,date,date,date) from public,anon,authenticated;
revoke execute on function public.payment_cost_backfill_preview() from public,anon,authenticated;
revoke execute on function public.backfill_payment_order_cost_snapshots(integer,text,text) from public,anon,authenticated;
revoke execute on function public.payment_finance_snapshot() from public,anon,authenticated;
grant execute on function public.approve_payment_order_v4(uuid,integer,text) to service_role;
grant execute on function public.payment_order_profit_statistics_v2(text,text,text,text,uuid,date,date,date) to service_role;
grant execute on function public.payment_cost_backfill_preview() to service_role;
grant execute on function public.backfill_payment_order_cost_snapshots(integer,text,text) to service_role;
grant execute on function public.payment_finance_snapshot() to service_role;

commit;
