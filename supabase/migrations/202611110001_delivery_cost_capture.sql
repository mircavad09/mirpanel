begin;
set local lock_timeout='5s';
-- One cost capture path for card approval, wallet and both delivery methods.
create or replace function public.capture_payment_order_checkout_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sale numeric; cost numeric;
begin
  -- Preserve every valid captured cost, including legacy approval snapshots.
  if tg_op='UPDATE' and old.cost_price_snapshot is not null then
    if new.cost_lines_snapshot is not distinct from old.cost_lines_snapshot then
      new.cost_price_snapshot:=old.cost_price_snapshot;
      new.sale_price_snapshot:=old.sale_price_snapshot;
      new.profit_snapshot:=old.profit_snapshot;
      new.profit_margin_snapshot:=old.profit_margin_snapshot;
      new.cost_source:=old.cost_source;
    end if;
    return new;
  end if;
  if new.product_id='__cart__' or new.payment_source='wallet'
     or new.payment_confirmed or new.status in ('approved','completed') then
    new.cost_lines_snapshot:=public.resolve_payment_order_cost_lines(new,tg_op='UPDATE');
    sale:=new.amount;
    cost:=public.payment_order_cost_total(new.cost_lines_snapshot);
    new.sale_price_snapshot:=sale;
    new.cost_price_snapshot:=cost;
    new.profit_snapshot:=sale-cost;
    new.profit_margin_snapshot:=case when sale>0 and abs((sale-cost)*100/sale)<99999 then round((sale-cost)*100/sale,2) end;
    new.cost_source:=case when cost is not null then
      case when tg_op='INSERT' then 'checkout_snapshot'
        when exists(select 1 from jsonb_array_elements(new.cost_lines_snapshot) x where x->>'source'='estimate')
          then 'backfilled_current_cost' else 'backfilled_historical_cost' end end;
  end if;
  return new;
end;
$$;
drop trigger if exists payment_order_checkout_cost on public.payment_orders;
create trigger payment_order_checkout_cost before insert or update of checkout_snapshot,status,payment_confirmed
on public.payment_orders for each row execute function public.capture_payment_order_checkout_cost();


create or replace function public.capture_delivered_order_cost() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Resolves at the purchase date and preserves any already known line costs.
  update public.payment_orders set status=status
    where id=new.order_id and cost_price_snapshot is null;
  return new;
end;
$$;
drop trigger if exists customer_delivery_cost_capture on mirpanel_community.customer_order_deliveries;
create trigger customer_delivery_cost_capture after insert on mirpanel_community.customer_order_deliveries
for each row execute function public.capture_delivered_order_cost();
revoke execute on function public.capture_delivered_order_cost() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
