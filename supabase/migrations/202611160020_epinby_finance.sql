begin;
set local lock_timeout='5s';
create table if not exists mirpanel_community.epinby_catalog_costs (
 supplier_product_id bigint primary key,
 cost jsonb not null
);
alter table mirpanel_community.epinby_catalog_costs enable row level security;
revoke all on mirpanel_community.epinby_catalog_costs from public,anon,authenticated;
alter table mirpanel_community.epinby_order_units
 add column if not exists execution_quote jsonb,
 add column if not exists supplier_charge jsonb;
-- The generic recovery tool may estimate historical costs from current manual
-- plan prices. Epinby sales must instead be reconciled by supplier order ID.
do $guard$
begin
 if to_regclass('public.payment_order_cost_recovery') is not null then
  execute $view$
   create or replace view public.payment_order_cost_recovery as
   with delivered as (
    select order_id,sum(quantity) as units from mirpanel_community.customer_order_deliveries group by order_id
   ), resolved as (
    select o.id,o.order_code,o.product_title,o.plan_name,o.cost_lines_snapshot as previous_lines,
      coalesce(o.sale_price_snapshot,o.amount) as sale,
      public.resolve_payment_order_cost_lines(o,true) as lines
    from public.payment_orders o left join delivered d on d.order_id=o.id
    where o.cost_price_snapshot is null and o.currency='AZN'
      and o.status not in ('rejected','expired','cancelled')
      and not exists(select 1 from mirpanel_community.api_dispatches a where a.order_id=o.id
        and a.supplier_id='e91bb000-0000-4000-8000-000000000001')
      and (o.fulfillment_cancellation->>'full'='false' or
           d.units>=greatest(coalesce(o.quantity,1),1) or
           (o.status in ('approved','completed') and o.completed_at is not null
            and o.payment_confirmed is not true and d.order_id is null))
   )
   select *,public.payment_order_cost_total(lines) as cost,
    exists(select 1 from jsonb_array_elements(lines) x where x->>'source'='estimate') as estimated
   from resolved
  $view$;
 end if;
end;
$guard$;
commit;
