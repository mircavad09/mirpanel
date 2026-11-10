begin;

create table if not exists public.payment_plan_cost_history (
  product_id text not null,
  plan_id text not null,
  effective_at timestamptz not null,
  cost_amount numeric(12,2),
  primary key (product_id, plan_id, effective_at)
);
alter table public.payment_plan_cost_history enable row level security;
revoke all on public.payment_plan_cost_history from public, anon, authenticated;

insert into public.payment_plan_cost_history(product_id,plan_id,effective_at,cost_amount)
select product_id,plan_id,updated_at,cost_amount from public.payment_plan_costs
on conflict do nothing;

create or replace function public.track_payment_plan_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then
    insert into public.payment_plan_cost_history values(old.product_id,old.plan_id,clock_timestamp(),null);
    return old;
  end if;
  if tg_op='INSERT' or new.cost_amount is distinct from old.cost_amount then
    insert into public.payment_plan_cost_history values(new.product_id,new.plan_id,new.updated_at,new.cost_amount)
    on conflict (product_id,plan_id,effective_at) do update set cost_amount=excluded.cost_amount;
  end if;
  return new;
end;
$$;
drop trigger if exists payment_plan_cost_history_write on public.payment_plan_costs;
create trigger payment_plan_cost_history_write after insert or update or delete on public.payment_plan_costs
for each row execute function public.track_payment_plan_cost();

alter table public.payment_orders add column if not exists cost_lines_snapshot jsonb,
  add column if not exists fulfillment_cancellation jsonb;
alter table public.payment_orders drop constraint if exists payment_orders_cost_source_check;
alter table public.payment_orders add constraint payment_orders_cost_source_check
check (cost_source is null or cost_source in ('approval_snapshot','checkout_snapshot','backfilled_historical_cost','backfilled_current_cost'));

create or replace function public.resolve_payment_order_cost_lines(
  o public.payment_orders, historical boolean
) returns jsonb language sql stable set search_path = '' as $$
  with lines as (
    select x.ordinality::int-1 as idx, x.value->>'productId' as product_id,
           coalesce(nullif(x.value->>'sourcePlanKey',''),x.value->>'planIndex') as plan_id,
           (x.value->>'quantity')::integer as quantity
      from jsonb_array_elements(case when jsonb_typeof(o.checkout_snapshot->'items')='array'
        then o.checkout_snapshot->'items' else '[]'::jsonb end) with ordinality x
     where o.product_id='__cart__'
    union all
    select 0,o.product_id,coalesce(nullif(o.checkout_snapshot->>'sourcePlanKey',''),o.plan_id),greatest(coalesce(o.quantity,1),1)
     where o.product_id<>'__cart__'
  )
  select jsonb_agg(
    case when o.cost_lines_snapshot->l.idx->>'unitCost' is not null then o.cost_lines_snapshot->l.idx
    else jsonb_build_object('quantity',l.quantity,'unitCost',coalesce(h.cost_amount,c.cost_amount),
      'source',case when h.cost_amount is not null then 'historical'
        when c.cost_amount is not null then case when historical then 'estimate' else 'checkout' end end)
    end order by l.idx)
  from lines l
  left join public.payment_plan_costs c on c.product_id=l.product_id and c.plan_id=l.plan_id
  left join lateral (
    select cost_amount from public.payment_plan_cost_history h
     where historical and h.product_id=l.product_id and h.plan_id=l.plan_id
       and h.effective_at<=coalesce(case when o.product_id='__cart__' or o.payment_source='wallet' then o.created_at else o.approved_at end,o.created_at)
     order by h.effective_at desc limit 1
  ) h on true;
$$;

create or replace function public.payment_order_cost_total(lines jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when count(*)=count(x->>'unitCost') then sum((x->>'unitCost')::numeric*(x->>'quantity')::integer) end
    from jsonb_array_elements(lines) x;
$$;

create or replace function public.capture_payment_order_checkout_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sale numeric; cost numeric;
begin
  if tg_op='UPDATE' and old.cost_lines_snapshot is not null then
    -- Card approval can populate its legacy order-level cost. Keep the captured cart amounts.
    if new.cost_lines_snapshot is not distinct from old.cost_lines_snapshot then
      new.cost_price_snapshot:=old.cost_price_snapshot;
      new.sale_price_snapshot:=old.sale_price_snapshot;
      new.profit_snapshot:=old.profit_snapshot;
      new.profit_margin_snapshot:=old.profit_margin_snapshot;
      new.cost_source:=old.cost_source;
    end if;
    return new;
  end if;
  if tg_op='UPDATE' and old.checkout_snapshot->>'productId' is not null then return new; end if;
  if tg_op='UPDATE' and old.checkout_snapshot->>'cartVersion'='2' then return new; end if;
  if new.product_id='__cart__' or (new.payment_source='wallet' and new.checkout_snapshot ? 'sourcePlanKey') then
    new.cost_lines_snapshot:=public.resolve_payment_order_cost_lines(new,false);
    sale:=new.amount;
    cost:=public.payment_order_cost_total(new.cost_lines_snapshot);
    new.sale_price_snapshot:=sale;
    new.cost_price_snapshot:=cost;
    new.profit_snapshot:=sale-cost;
    new.profit_margin_snapshot:=case when sale>0 and abs((sale-cost)*100/sale)<99999 then round((sale-cost)*100/sale,2) end;
    new.cost_source:=case when cost is not null then 'checkout_snapshot' end;
  end if;
  return new;
end;
$$;
drop trigger if exists payment_order_checkout_cost on public.payment_orders;
create trigger payment_order_checkout_cost before insert or update of checkout_snapshot,status
on public.payment_orders for each row execute function public.capture_payment_order_checkout_cost();

-- Legacy card orders may have an approval completion without individual deliveries.
-- Orders in the delivery workflow must be fully fulfilled or partly delivered and closed.
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
   and (o.fulfillment_cancellation->>'full'='false' or
        d.units>=greatest(coalesce(o.quantity,1),1) or
        (o.status in ('approved','completed') and o.completed_at is not null
         and o.payment_confirmed is not true and d.order_id is null))
)
select *,public.payment_order_cost_total(lines) as cost,
  exists(select 1 from jsonb_array_elements(lines) x where x->>'source'='estimate') as estimated
from resolved;
revoke all on public.payment_order_cost_recovery from public, anon, authenticated;

create or replace function public.payment_cost_backfill_preview()
returns jsonb language sql security definer set search_path = '' as $$
 select jsonb_build_object('missingCount',count(*),'matchedCount',count(cost),
   'unmatchedCount',count(*)-count(cost),'estimatedCount',count(cost) filter(where estimated),
   'cost',coalesce(sum(cost),0),'profit',coalesce(sum(sale-cost),0),
   'digest',md5(coalesce(string_agg(id::text||':'||lines::text,',' order by id),'')),
   'items',coalesce(jsonb_agg(jsonb_build_object('orderCode',order_code,'productTitle',product_title,
    'planName',plan_name,'matched',cost is not null,'sale',sale,'cost',cost,'profit',sale-cost,
    'estimated',estimated) order by order_code),'[]'::jsonb))
 from public.payment_order_cost_recovery;
$$;

create or replace function public.backfill_payment_order_cost_snapshots(
 p_expected_count integer, p_expected_digest text, p_actor text default 'admin'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare preview jsonb; historical_count integer; estimated_count integer; partial_count integer;
begin
  perform pg_advisory_xact_lock(926111019);
  lock table public.payment_plan_costs in share mode;
  preview:=public.payment_cost_backfill_preview();
  if p_expected_count is distinct from (preview->>'matchedCount')::integer or
     p_expected_digest is distinct from preview->>'digest' then
    raise exception 'COST_BACKFILL_PREVIEW_CHANGED';
  end if;
  with candidates as materialized (
    select r.* from public.payment_order_cost_recovery r
    where r.lines is distinct from r.previous_lines
      and exists(select 1 from jsonb_array_elements(r.lines) x where x->>'unitCost' is not null)
  ), backed_up as (
    insert into public.payment_cost_backfill_backups(order_id,batch_digest,backed_up_by,snapshot)
    select o.id,p_expected_digest,left(coalesce(p_actor,'admin'),120),
      jsonb_build_object('salePriceSnapshot',o.sale_price_snapshot,'costPriceSnapshot',o.cost_price_snapshot,
        'profitSnapshot',o.profit_snapshot,'profitMarginSnapshot',o.profit_margin_snapshot,
        'costSource',o.cost_source,'costBackfilledAt',o.cost_backfilled_at,'costLinesSnapshot',o.cost_lines_snapshot)
    from candidates r join public.payment_orders o on o.id=r.id
    on conflict (order_id) do nothing
  ), changed as (
    update public.payment_orders o set
      cost_lines_snapshot=r.lines,
      sale_price_snapshot=r.sale,
      cost_price_snapshot=r.cost,
      profit_snapshot=r.sale-r.cost,
      profit_margin_snapshot=case when r.sale>0 and abs((r.sale-r.cost)*100/r.sale)<99999 then round((r.sale-r.cost)*100/r.sale,2) end,
      cost_source=case when r.cost is not null then case when r.estimated then 'backfilled_current_cost' else 'backfilled_historical_cost' end end,
      cost_backfilled_at=clock_timestamp()
    from candidates r
    where o.id=r.id and o.cost_price_snapshot is null and o.cost_lines_snapshot is not distinct from r.previous_lines
    returning o.cost_price_snapshot, o.cost_source
  )
  select count(*) filter(where cost_source='backfilled_historical_cost'),
    count(*) filter(where cost_source='backfilled_current_cost'),
    count(*) filter(where cost_price_snapshot is null)
  into historical_count,estimated_count,partial_count from changed;
  if historical_count+estimated_count+partial_count>0 then
    insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
    values('admin',left(coalesce(p_actor,'admin'),120),'costs.backfilled','payment_orders','batch',
      jsonb_build_object('historical',historical_count,'estimated',estimated_count,'partial',partial_count));
  end if;
  return jsonb_build_object('updatedCount',historical_count+estimated_count,
    'historicalCount',historical_count,'estimatedCount',estimated_count,'partialCount',partial_count,
    'missingCount',(select count(*) from public.payment_order_cost_recovery));
end;
$$;

revoke execute on function public.resolve_payment_order_cost_lines(public.payment_orders,boolean),
 public.payment_order_cost_total(jsonb), public.track_payment_plan_cost(), public.capture_payment_order_checkout_cost()
 from public, anon, authenticated;
revoke execute on function public.payment_cost_backfill_preview(),
 public.backfill_payment_order_cost_snapshots(integer,text,text) from public, anon, authenticated;
grant execute on function public.payment_cost_backfill_preview(),
 public.backfill_payment_order_cost_snapshots(integer,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
