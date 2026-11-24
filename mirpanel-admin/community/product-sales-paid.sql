-- Read-only projection: one row per immutable order/line, never incremental events.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025020);
create or replace function public.product_sales_epoint_paid() returns table(order_id uuid)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if to_regclass('mirpanel_community.epoint_purchases') is not null then
  return query execute 'select distinct order_id from mirpanel_community.epoint_purchases where paid_at is not null';
 end if;
end $$;
revoke all on function public.product_sales_epoint_paid() from public,anon,authenticated;
create or replace view public.product_sales_paid_units as
-- PAID_QUERY_START
with lines as (
 select o.id order_id,(x.ordinality-1)::integer line_index,x.item->>'productId' product_id,
 case when x.item->>'quantity' ~ '^[1-9][0-9]{0,8}$' then (x.item->>'quantity')::bigint else 1 end quantity,
 o.fulfillment_cancellation cancellation
 from public.payment_orders o cross join lateral jsonb_array_elements(
 case when o.checkout_snapshot->>'cartVersion'='2' and jsonb_typeof(o.checkout_snapshot->'items')='array' then o.checkout_snapshot->'items'
 else jsonb_build_array(jsonb_build_object('productId',o.product_id,'quantity',coalesce(o.quantity,1))) end
 ) with ordinality x(item,ordinality)
 where (o.payment_confirmed is true or exists(select 1 from public.product_sales_epoint_paid() e where e.order_id=o.id))
 and o.status not in ('rejected','expired')
), delivered as (
 select order_id,line_index,sum(quantity)::bigint quantity from mirpanel_community.customer_order_deliveries group by order_id,line_index
), refunds as (
 select l.order_id,l.line_index,sum((r->>'quantity')::bigint) quantity
 from lines l cross join lateral jsonb_array_elements(case when jsonb_typeof(l.cancellation->'lines')='array' then l.cancellation->'lines' else '[]'::jsonb end) r
 where r->>'index'=l.line_index::text and r->>'quantity' ~ '^[1-9][0-9]{0,8}$'
 and l.cancellation->>'refundCents' ~ '^[0-9]{1,12}$'
 and exists(select 1 from mirpanel_community.community_refunds f where f.order_id=l.order_id and f.cents>0 and f.cents>=(l.cancellation->>'refundCents')::bigint)
 group by l.order_id,l.line_index
)
select l.order_id,l.line_index,l.product_id,
 greatest(least(l.quantity,coalesce(d.quantity,0)),l.quantity-least(l.quantity,coalesce(r.quantity,0)))::bigint quantity,'confirmed_payment'::text source
from lines l left join delivered d using(order_id,line_index) left join refunds r using(order_id,line_index)
where l.product_id is not null and l.product_id<>'' and l.product_id<>'__cart__'
union all
-- Preserve the exact already displayed legacy component, without treating old
-- approvals as new confirmations. A confirmed order replaces this fallback.
select d.order_id,d.line_index,d.product_id,d.quantity,d.source from public.product_sales_delivered_units d
where not exists(select 1 from lines l where l.order_id=d.order_id)
-- PAID_QUERY_END
;
revoke all on public.product_sales_paid_units from public,anon,authenticated;
create table if not exists public.product_sales_paid_release(id boolean primary key default true check(id),installed_at timestamptz not null default now(),revision bigint not null default 0);
alter table public.product_sales_paid_release enable row level security;
revoke all on public.product_sales_paid_release from public,anon,authenticated;
insert into public.product_sales_paid_release(id) values(true) on conflict do nothing;
create or replace function public.product_sales_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.product_sales_paid_release set revision=revision+1 where id;
 return null;
end $$;
revoke all on function public.product_sales_changed() from public,anon,authenticated;
drop trigger if exists product_sales_paid_changed on public.payment_orders;
create trigger product_sales_paid_changed after insert or update of payment_confirmed,status,quantity,checkout_snapshot,fulfillment_cancellation,product_id or delete on public.payment_orders for each statement execute function public.product_sales_changed();
drop trigger if exists product_sales_refund_changed on mirpanel_community.community_refunds;
create trigger product_sales_refund_changed after insert or update or delete on mirpanel_community.community_refunds for each statement execute function public.product_sales_changed();
drop trigger if exists product_sales_delivery_changed on mirpanel_community.customer_order_deliveries;
create trigger product_sales_delivery_changed after insert or update or delete on mirpanel_community.customer_order_deliveries for each statement execute function public.product_sales_changed();
drop trigger if exists product_sales_baseline_changed on public.product_sales_baselines;
create trigger product_sales_baseline_changed after insert or update or delete on public.product_sales_baselines for each statement execute function public.product_sales_changed();
do $$begin
 if to_regclass('mirpanel_community.epoint_purchases') is not null then
 execute 'drop trigger if exists product_sales_epoint_changed on mirpanel_community.epoint_purchases';
 execute 'create trigger product_sales_epoint_changed after insert or update of paid_at or delete on mirpanel_community.epoint_purchases for each statement execute function public.product_sales_changed()';
 end if;
end $$;
create or replace function public.product_sales_revision() returns bigint language sql stable security definer set search_path=pg_catalog,public as $$select revision from public.product_sales_paid_release where id$$;
revoke all on function public.product_sales_revision() from public,anon,authenticated;
grant execute on function public.product_sales_revision() to service_role;
-- Snapshot function installed below, using the same historical baselines.
create or replace function public.product_sales_snapshot() returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
 -- cart_product_units: one net confirmed purchase quantity per order/line.
 with real as materialized(select product_id,sum(quantity)::bigint count from public.product_sales_paid_units group by product_id)
 select jsonb_build_object(
 'historicalTotal',s.historical_total,'initializedAt',s.initialized_at,'version',s.version,
 'distributed',(select coalesce(sum(count),0) from public.product_sales_baselines),
 'baselines',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'count',count) order by product_id) from public.product_sales_baselines),'[]'::jsonb),
 'real',coalesce((select jsonb_agg(to_jsonb(r) order by product_id) from real r),'[]'::jsonb),
 'realTotal',(select coalesce(sum(count),0) from real),
 'countingRule','confirmed-paid-units-v2',
 'verifiedPaidUnits',(select coalesce(sum(quantity),0) from public.product_sales_paid_units where source='confirmed_payment'),
 'verifiedDeliveredUnits',(select coalesce(sum(quantity),0) from public.product_sales_delivered_units where source='delivery_record'),
 'legacyInferredUnits',(select coalesce(sum(quantity),0) from public.product_sales_paid_units where source<>'confirmed_payment'),
 'legacyCutover',(select installed_at from public.product_sales_delivery_release)
 ) from public.product_sales_settings s where s.id=1;
$$;
revoke all on function public.product_sales_snapshot() from public,anon,authenticated;
grant execute on function public.product_sales_snapshot() to service_role;
notify pgrst,'reload schema';
commit;
