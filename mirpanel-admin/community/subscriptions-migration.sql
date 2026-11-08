begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
alter table mirpanel_community.shop_drafts add column if not exists renewal jsonb;
create table if not exists mirpanel_community.subscription_renewals (
 checkout_id uuid not null references mirpanel_community.shop_checkouts(id),
 source_id uuid not null,
 user_id text not null references mirpanel_community."user"(id),
 order_id uuid references public.payment_orders(id),
 line_index integer not null check(line_index>=0),
 base_expires_on date not null,
 period_unit text not null check(period_unit in ('days','months')),
 period_count integer not null check(period_count between 1 and 3650),
 expires_on date,
 primary key(checkout_id,source_id),
 unique(order_id,line_index)
);
create index if not exists subscription_renewals_source_idx on mirpanel_community.subscription_renewals(user_id,source_id,base_expires_on desc);
alter table mirpanel_community.subscription_renewals enable row level security;
revoke all on mirpanel_community.subscription_renewals from public,anon,authenticated;

-- A paid order alone is not proof of renewal. The existing authorized delivery
-- operation confirms fulfillment; extension is recorded in the same transaction.
create or replace function mirpanel_community.apply_subscription_renewal() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare r mirpanel_community.subscription_renewals%rowtype; starts date;
begin
 select * into r from mirpanel_community.subscription_renewals
 where order_id=new.order_id and line_index=new.line_index for update;
 if not found or r.expires_on is not null then return new; end if;
 if new.quantity<>1 or new.actor='wallet:auto' or not exists(
  select 1 from public.payment_orders o join mirpanel_community.community_order_owners u on u.order_id=o.id
  where o.id=new.order_id and u.user_id=r.user_id and o.status not in ('cancelled','rejected','expired')
    and (o.payment_confirmed is true or o.status in ('approved','completed'))
 ) then raise exception 'SUBSCRIPTION_RENEWAL_NOT_FULFILLED'; end if;
 starts:=greatest(r.base_expires_on+1,(new.delivered_at at time zone 'Asia/Baku')::date);
 update mirpanel_community.subscription_renewals set expires_on=case when r.period_unit='days'
  then starts+r.period_count-1 else (starts+make_interval(months=>r.period_count))::date-1 end
 where checkout_id=r.checkout_id and source_id=r.source_id;
 return new;
end $$;
revoke all on function mirpanel_community.apply_subscription_renewal() from public,anon,authenticated;
drop trigger if exists apply_subscription_renewal on mirpanel_community.customer_order_deliveries;
create trigger apply_subscription_renewal after insert on mirpanel_community.customer_order_deliveries
 for each row execute function mirpanel_community.apply_subscription_renewal();
commit;
