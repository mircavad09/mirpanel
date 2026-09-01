begin;

-- Archived months are immutable financial snapshots.  Current-month values are
-- calculated live from the order snapshots until that month closes in Baku.
create table if not exists public.payment_monthly_reports (
  month_start date primary key,
  completed_count integer not null default 0 check (completed_count >= 0),
  revenue numeric(14,2) not null default 0,
  cost numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  missing_cost_count integer not null default 0 check (missing_cost_count >= 0),
  top_product text not null default '—',
  products jsonb not null default '[]'::jsonb,
  payment_methods jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

alter table public.payment_monthly_reports enable row level security;
revoke all on table public.payment_monthly_reports from public, anon, authenticated;
grant select, insert on table public.payment_monthly_reports to service_role;

create or replace function public.payment_month_report_snapshot(p_month_start date)
returns jsonb language sql stable security definer set search_path = public as $$
  with bounds as (
    select date_trunc('month', p_month_start)::date as month_start,
           (date_trunc('month', p_month_start)::date + interval '1 month')::date as month_end
  ), filtered as (
    select o.product_id, o.product_title, o.method_name_snapshot, o.method_last4_snapshot,
      coalesce(o.sale_price_snapshot, o.amount) as sale,
      o.cost_price_snapshot as cost, o.profit_snapshot as profit
    from public.payment_orders o cross join bounds b
    where o.status in ('approved','completed') and o.completed_at is not null
      and (o.completed_at at time zone 'Asia/Baku')::date >= b.month_start
      and (o.completed_at at time zone 'Asia/Baku')::date < b.month_end
  ), products as (
    select product_id, coalesce(nullif(product_title,''),'Məhsul') as title, count(*)::integer as count,
      round(sum(sale),2) as revenue
    from filtered group by product_id, coalesce(nullif(product_title,''),'Məhsul')
  ), methods as (
    select concat(coalesce(nullif(method_name_snapshot,''),'Ödəniş üsulu'),
             case when nullif(regexp_replace(coalesce(method_last4_snapshot,''),'\\D','','g'),'') is null then ''
                  else ' •••• ' || right(regexp_replace(method_last4_snapshot,'\\D','','g'),4) end) as label,
      count(*)::integer as count, round(sum(sale),2) as revenue
    from filtered group by concat(coalesce(nullif(method_name_snapshot,''),'Ödəniş üsulu'),
             case when nullif(regexp_replace(coalesce(method_last4_snapshot,''),'\\D','','g'),'') is null then ''
                  else ' •••• ' || right(regexp_replace(method_last4_snapshot,'\\D','','g'),4) end)
  )
  select jsonb_build_object(
    'monthStart', (select month_start from bounds),
    'completedCount', (select count(*) from filtered),
    'revenue', coalesce((select round(sum(sale),2) from filtered),0),
    'cost', coalesce((select round(sum(cost),2) from filtered where cost is not null),0),
    'profit', coalesce((select round(sum(profit),2) from filtered where cost is not null),0),
    'missingCostCount', (select count(*) from filtered where cost is null),
    'topProduct', coalesce((select title from products order by count desc,title limit 1),'—'),
    'products', coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'title',title,'count',count,'revenue',revenue) order by count desc,title) from products),'[]'::jsonb),
    'paymentMethods', coalesce((select jsonb_agg(jsonb_build_object('label',label,'count',count,'revenue',revenue) order by revenue desc,label) from methods),'[]'::jsonb)
  );
$$;

create or replace function public.archive_due_payment_monthly_reports()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_current_month date := date_trunc('month', public.payment_baku_date())::date;
  v_month date;
  v_first_month date;
  v_report jsonb;
  v_created integer := 0;
begin
  select date_trunc('month', min(completed_at at time zone 'Asia/Baku'))::date
    into v_first_month
    from public.payment_orders
   where status in ('approved','completed') and completed_at is not null;
  if v_first_month is null or v_first_month >= v_current_month then return 0; end if;

  for v_month in select generate_series(v_first_month, v_current_month - interval '1 month', interval '1 month')::date loop
    if not exists (select 1 from public.payment_monthly_reports where month_start = v_month) then
      v_report := public.payment_month_report_snapshot(v_month);
      insert into public.payment_monthly_reports(month_start,completed_count,revenue,cost,profit,missing_cost_count,top_product,products,payment_methods)
      values (v_month,
        coalesce((v_report->>'completedCount')::integer,0), coalesce((v_report->>'revenue')::numeric,0),
        coalesce((v_report->>'cost')::numeric,0), coalesce((v_report->>'profit')::numeric,0),
        coalesce((v_report->>'missingCostCount')::integer,0), coalesce(v_report->>'topProduct','—'),
        coalesce(v_report->'products','[]'::jsonb), coalesce(v_report->'paymentMethods','[]'::jsonb));
      v_created := v_created + 1;
    end if;
  end loop;
  return v_created;
end;
$$;

create or replace function public.current_payment_month_report()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.payment_month_report_snapshot(date_trunc('month', public.payment_baku_date())::date);
$$;

revoke execute on function public.payment_month_report_snapshot(date) from public, anon, authenticated;
revoke execute on function public.archive_due_payment_monthly_reports() from public, anon, authenticated;
revoke execute on function public.current_payment_month_report() from public, anon, authenticated;
grant execute on function public.payment_month_report_snapshot(date) to service_role;
grant execute on function public.archive_due_payment_monthly_reports() to service_role;
grant execute on function public.current_payment_month_report() to service_role;

commit;
