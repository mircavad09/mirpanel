-- Actual delivered units, with a one-time, explicitly labelled legacy fallback.
-- Never changes orders, customer balances, baseline numbers or delivery records.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025018);
create table if not exists public.product_sales_delivery_release (
 id boolean primary key default true check(id), installed_at timestamptz not null default now()
);
create table if not exists public.product_sales_legacy_units (
 order_id uuid not null references public.payment_orders(id), line_index integer not null,
 product_id text not null, quantity bigint not null check(quantity>0),
 source text not null default 'legacy_approved_before_delivery_tracking',
 primary key(order_id,line_index)
);
alter table public.product_sales_delivery_release enable row level security;
alter table public.product_sales_legacy_units enable row level security;
revoke all on public.product_sales_delivery_release,public.product_sales_legacy_units from public,anon,authenticated;
-- Freeze the previously admitted, untracked legacy approvals exactly once.
-- These rows have no reliable delivery timestamp. They are not new sale events.
insert into public.product_sales_legacy_units(order_id,line_index,product_id,quantity)
select o.id, (x.ordinality-1)::integer,x.item->>'productId',greatest(1,(x.item->>'quantity')::bigint)
from public.payment_orders o cross join lateral jsonb_array_elements(
 case when o.checkout_snapshot->>'cartVersion'='2' then o.checkout_snapshot->'items'
 else jsonb_build_array(jsonb_build_object('productId',o.product_id,'quantity',coalesce(o.quantity,1))) end
) with ordinality x(item,ordinality)
where not exists(select 1 from public.product_sales_delivery_release)
 and o.status in ('approved','completed') and o.payment_confirmed is not true
 and not exists(select 1 from mirpanel_community.customer_order_deliveries d where d.order_id=o.id)
on conflict do nothing;
insert into public.product_sales_delivery_release(id) values(true) on conflict do nothing;

create or replace view public.product_sales_delivered_units as
with lines as (
 select o.id,o.status,o.payment_confirmed,(x.ordinality-1)::integer line_index,
 x.item->>'productId' product_id,greatest(1,(x.item->>'quantity')::bigint) quantity
 from public.payment_orders o cross join lateral jsonb_array_elements(
 case when o.checkout_snapshot->>'cartVersion'='2' then o.checkout_snapshot->'items'
 else jsonb_build_array(jsonb_build_object('productId',o.product_id,'quantity',coalesce(o.quantity,1))) end
 ) with ordinality x(item,ordinality)
), delivered as (
 select order_id,line_index,sum(quantity)::bigint quantity from mirpanel_community.customer_order_deliveries group by order_id,line_index
)
select l.id order_id,l.line_index,l.product_id,least(l.quantity,d.quantity) quantity,'delivery_record'::text source
from lines l join delivered d on d.order_id=l.id and d.line_index=l.line_index
where l.status not in ('rejected','expired') and (l.payment_confirmed or l.status in ('approved','completed'))
union all
select b.order_id,b.line_index,b.product_id,b.quantity,b.source
from public.product_sales_legacy_units b join public.payment_orders o on o.id=b.order_id
where o.status in ('approved','completed') and o.payment_confirmed is not true
and not exists(select 1 from mirpanel_community.customer_order_deliveries d where d.order_id=o.id);
revoke all on public.product_sales_delivered_units from public,anon,authenticated;

-- cart_product_units: preserved compatibility marker for older cart installers.
create or replace function public.product_sales_snapshot() returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
 -- cart_product_units: count each delivered line only once.
 with real as materialized(select product_id,sum(quantity)::bigint count from public.product_sales_delivered_units group by product_id)
 select jsonb_build_object(
 'historicalTotal',s.historical_total,'initializedAt',s.initialized_at,'version',s.version,
 'distributed',(select coalesce(sum(count),0) from public.product_sales_baselines),
 'baselines',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'count',count) order by product_id) from public.product_sales_baselines),'[]'::jsonb),
 'real',coalesce((select jsonb_agg(to_jsonb(r) order by product_id) from real r),'[]'::jsonb),
 'realTotal',(select coalesce(sum(count),0) from real),
 'countingRule','delivered-units-v1',
 'verifiedDeliveredUnits',(select coalesce(sum(quantity),0) from public.product_sales_delivered_units where source='delivery_record'),
 'legacyInferredUnits',(select coalesce(sum(quantity),0) from public.product_sales_delivered_units where source<>'delivery_record'),
 'legacyCutover',(select installed_at from public.product_sales_delivery_release)
 ) from public.product_sales_settings s where s.id=1;
$$;
revoke all on function public.product_sales_snapshot() from public,anon,authenticated;
grant execute on function public.product_sales_snapshot() to service_role;
notify pgrst,'reload schema';
commit;
