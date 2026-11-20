begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
create table if not exists mirpanel_community.renewal_policies(
 product_id text not null,plan_key text not null default '*',
 method text not null check(method in ('new_account','extend_existing','operator','disabled')),
 updated_by text not null,updated_at timestamptz not null default clock_timestamp(),primary key(product_id,plan_key)
);
create table if not exists mirpanel_community.scheduled_renewals(
 id uuid primary key,user_id text not null references mirpanel_community."user"(id),request_id uuid not null,
 source_id uuid not null,source_order_id uuid references public.payment_orders(id),source_order_code text not null,
 source_line integer not null,source_unit integer not null,base_expires_on date not null,due_at timestamptz not null,
 product_id text not null,plan_key text not null,plan_index integer not null,plan_signature text not null,
 snapshot jsonb not null,period_unit text not null check(period_unit in ('days','months')),period_count integer not null check(period_count between 1 and 3650),
 method text not null check(method in ('new_account','extend_existing','operator')),mode text not null check(mode in ('prepaid','auto_wallet')),
 cents bigint not null check(cents>0),consent_at timestamptz not null,checkout_id uuid unique references mirpanel_community.shop_checkouts(id),
 new_order_id uuid unique references public.payment_orders(id),state text not null check(state in ('authorized','paid_waiting','needs_funds','awaiting_delivery','delivered','cancelled','blocked')),
 reason text,created_at timestamptz not null default clock_timestamp(),paid_at timestamptz,delivered_at timestamptz,expires_at timestamptz,
 unique(user_id,request_id)
);
create unique index if not exists scheduled_renewal_source_once on mirpanel_community.scheduled_renewals(source_id,base_expires_on) where state<>'cancelled';
alter table mirpanel_community.scheduled_renewals alter column source_order_id drop not null;
create index if not exists scheduled_renewal_due on mirpanel_community.scheduled_renewals(due_at,created_at) where state in ('authorized','paid_waiting','needs_funds');
create table if not exists mirpanel_community.renewal_events(
 id bigint generated always as identity primary key,renewal_id uuid not null references mirpanel_community.scheduled_renewals(id),
 event text not null,message text not null,created_at timestamptz not null default clock_timestamp(),unique(renewal_id,event)
);
alter table mirpanel_community.renewal_policies enable row level security;
alter table mirpanel_community.scheduled_renewals enable row level security;
alter table mirpanel_community.renewal_events enable row level security;
revoke all on mirpanel_community.renewal_policies,mirpanel_community.scheduled_renewals,mirpanel_community.renewal_events from public,anon,authenticated;
create or replace function mirpanel_community.finish_scheduled_renewal() returns trigger language plpgsql security definer set search_path=pg_catalog,public,mirpanel_community as $$
declare r mirpanel_community.scheduled_renewals%rowtype; ending timestamptz;
begin
 select * into r from scheduled_renewals where new_order_id=new.order_id for update;
 if not found or r.state='delivered' then return new;end if;
 if new.quantity<>1 or new.line_index<>0 or r.state<>'awaiting_delivery' then raise exception 'SCHEDULED_RENEWAL_DELIVERY_INVALID';end if;
 ending:=case when r.period_unit='days' then new.delivered_at+make_interval(days=>r.period_count) else new.delivered_at+make_interval(months=>r.period_count) end;
 update scheduled_renewals set state='delivered',delivered_at=new.delivered_at,expires_at=ending,reason=null where id=r.id;
 update payment_orders set service_expires_on=(ending at time zone 'Asia/Baku')::date where id=new.order_id;
 insert into renewal_events(renewal_id,event,message) values(r.id,'delivered',(r.snapshot->>'title')||' üçün yeni '||(r.snapshot->>'planName')||' xidməti təqdim edildi') on conflict do nothing;
 return new;
end;$$;
drop trigger if exists scheduled_renewal_delivered on mirpanel_community.customer_order_deliveries;
create trigger scheduled_renewal_delivered after insert on mirpanel_community.customer_order_deliveries for each row execute function mirpanel_community.finish_scheduled_renewal();
create or replace function mirpanel_community.cancel_scheduled_renewal_order() returns trigger language plpgsql security definer set search_path=pg_catalog,public,mirpanel_community as $$
begin
 if new.status in ('cancelled','rejected','expired') and old.status not in ('cancelled','rejected','expired') then
  update scheduled_renewals set state='cancelled',reason='Sifariş mövcud ləğv və geri ödəmə qaydası ilə bağlanıb' where new_order_id=new.id and state='awaiting_delivery';
 end if;return new;
end;$$;
drop trigger if exists scheduled_renewal_cancelled on public.payment_orders;
create trigger scheduled_renewal_cancelled after update of status on public.payment_orders for each row execute function mirpanel_community.cancel_scheduled_renewal_order();
revoke all on function mirpanel_community.finish_scheduled_renewal(),mirpanel_community.cancel_scheduled_renewal_order() from public,anon,authenticated;
commit;
