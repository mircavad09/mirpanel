begin;

-- Filtered order finance remains server-side and now includes payment-method totals.
-- This replaces only the reporting function; it does not update order data.
create or replace function public.payment_order_profit_statistics_v2(
  p_tab text default 'all', p_search text default null, p_product_id text default null,
  p_plan_name text default null, p_method_id uuid default null, p_date_from date default null,
  p_date_to date default null, p_today date default null
) returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select product_id, product_title, plan_id, plan_name, method_id,
      coalesce(nullif(method_name_snapshot,''),'Ödəniş üsulu') as method_name,
      nullif(method_last4_snapshot,'') as method_last4,
      (completed_at at time zone 'Asia/Baku')::date as completed_day,
      coalesce(sale_price_snapshot, amount) as sale, cost_price_snapshot as cost
    from payment_orders
    where status in ('approved','completed') and completed_at is not null
      and (p_search is null or p_search='' or order_code ilike ('%'||p_search||'%'))
      and (p_product_id is null or p_product_id='' or product_id=p_product_id)
      and (p_plan_name is null or p_plan_name='' or plan_name=p_plan_name)
      and (p_method_id is null or method_id=p_method_id)
      and (p_date_from is null or (completed_at at time zone 'Asia/Baku')::date>=p_date_from)
      and (p_date_to is null or (completed_at at time zone 'Asia/Baku')::date<=p_date_to)
      and (p_tab<>'today' or (completed_at at time zone 'Asia/Baku')::date=coalesce(p_today,payment_baku_date()))
      and (p_tab<>'expiring' or (contacted_at is null and expiry_notification_on is not null and expiry_notification_on<=coalesce(p_today,payment_baku_date())))
  ), products as (
    select product_id,product_title as title,count(*)::integer as count,round(sum(sale),2) revenue,
      round(coalesce(sum(cost) filter(where cost is not null),0),2) cost,
      (count(*) filter(where cost is null))::integer missing
    from filtered group by product_id,product_title
  ), plans as (
    select product_id,product_title,plan_id,plan_name,count(*)::integer count,round(sum(sale),2) revenue,
      round(coalesce(sum(cost) filter(where cost is not null),0),2) cost,
      (count(*) filter(where cost is null))::integer missing
    from filtered group by product_id,product_title,plan_id,plan_name
  ), methods as (
    select method_id,method_name,method_last4,count(*)::integer count,round(sum(sale),2) revenue,
      round(coalesce(sum(cost) filter(where cost is not null),0),2) cost
    from filtered group by method_id,method_name,method_last4
  ), days as (
    select completed_day as report_day,count(*)::integer count,round(sum(sale),2) revenue,
      round(coalesce(sum(cost) filter(where cost is not null),0),2) cost,
      (count(*) filter(where cost is null))::integer missing
    from filtered group by completed_day
  ) select jsonb_build_object(
    'count',(select count(*) from filtered),
    'revenue',coalesce((select round(sum(sale),2) from filtered),0),
    'cost',coalesce((select round(sum(cost),2) from filtered where cost is not null),0),
    'missingCostCount',(select count(*) from filtered where cost is null),
    'topProduct',coalesce((select title from products order by count desc,title limit 1),'—'),
    'products',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'title',title,'count',count,'revenue',revenue,'cost',cost,'missingCostCount',missing) order by count desc,title) from products),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'productTitle',product_title,'planId',plan_id,'planName',plan_name,'count',count,'revenue',revenue,'cost',cost,'missingCostCount',missing) order by count desc,product_title,plan_name) from plans),'[]'::jsonb),
    'paymentMethods',coalesce((select jsonb_agg(jsonb_build_object('methodId',method_id,'label',method_name||case when method_last4 is null then '' else ' •••• '||method_last4 end,'count',count,'revenue',revenue,'cost',cost) order by revenue desc,method_name) from methods),'[]'::jsonb),
    'days',coalesce((select jsonb_agg(jsonb_build_object('date',report_day,'count',count,'revenue',revenue,'cost',cost,'missingCostCount',missing) order by report_day desc) from days),'[]'::jsonb)
  );
$$;

revoke execute on function public.payment_order_profit_statistics_v2(text,text,text,text,uuid,date,date,date) from public,anon,authenticated;
grant execute on function public.payment_order_profit_statistics_v2(text,text,text,text,uuid,date,date,date) to service_role;

commit;
