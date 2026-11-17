create table if not exists mirpanel_community.token_accounts(user_id text primary key references mirpanel_community."user"(id),balance bigint not null default 0 check(balance>=0));
create table if not exists mirpanel_community.token_purchases(order_id uuid primary key references public.payment_orders(id),user_id text not null references mirpanel_community."user"(id),quantity integer not null check(quantity between 50 and 5000),cents integer not null check(cents=quantity*2),state text not null default 'pending' check(state in ('pending','credited','refunded')),created_at timestamptz not null default clock_timestamp());
create table if not exists mirpanel_community.token_gifts(id uuid primary key default gen_random_uuid(),sender_id text not null references mirpanel_community."user"(id),recipient_id text not null references mirpanel_community."user"(id),request_id uuid not null,kind text not null check(kind in ('rose','heart')),cost integer not null check((kind='rose' and cost=1) or(kind='heart' and cost=5)),message_id bigint unique references mirpanel_community.community_messages(id),created_at timestamptz not null default clock_timestamp(),unique(sender_id,request_id));
create table if not exists mirpanel_community.token_ledger(id bigserial primary key,user_id text not null references mirpanel_community."user"(id),delta bigint not null,balance_after bigint not null check(balance_after>=0),kind text not null check(kind in ('purchase','refund','gift')),source_id text not null,created_at timestamptz not null default clock_timestamp(),unique(kind,source_id));
create index if not exists token_ledger_user on mirpanel_community.token_ledger(user_id,id desc);
create or replace function mirpanel_community.sync_token_purchase(oid uuid) returns void language plpgsql set search_path=pg_catalog as $$
declare p mirpanel_community.token_purchases; o public.payment_orders; n bigint; terminal boolean;
begin
 select * into p from mirpanel_community.token_purchases where order_id=oid for update;if not found then return;end if;
 select * into o from public.payment_orders where id=oid;
 terminal:=o.status in ('rejected','cancelled','expired','refunded');
 if p.state='refunded' then return;end if;
 if not terminal and not(o.payment_confirmed is true or o.status in ('approved','completed')) then return;end if;
 insert into mirpanel_community.token_accounts(user_id) values(p.user_id) on conflict do nothing;
 select balance into n from mirpanel_community.token_accounts where user_id=p.user_id for update;
 if terminal then
  if p.state='credited' then
   if n<p.quantity then raise exception 'İstifadə edilmiş token alışı geri qaytarıla bilməz.' using errcode='P0001';end if;
   n:=n-p.quantity;update mirpanel_community.token_accounts set balance=n where user_id=p.user_id;
   insert into mirpanel_community.token_ledger(user_id,delta,balance_after,kind,source_id) values(p.user_id,-p.quantity,n,'refund',oid::text) on conflict do nothing;
  end if;update mirpanel_community.token_purchases set state='refunded' where order_id=oid;
 elsif p.state='pending' then
  if o.currency<>'AZN' or round(o.amount*100)::bigint<>p.cents then raise exception 'TOKEN_PAYMENT_AMOUNT_MISMATCH';end if;
  n:=n+p.quantity;update mirpanel_community.token_accounts set balance=n where user_id=p.user_id;
  insert into mirpanel_community.token_ledger(user_id,delta,balance_after,kind,source_id) values(p.user_id,p.quantity,n,'purchase',oid::text);
  update mirpanel_community.token_purchases set state='credited' where order_id=oid;
 end if;
end$$;
create or replace function mirpanel_community.token_order_changed() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin perform mirpanel_community.sync_token_purchase(new.id);return new;end$$;
drop trigger if exists token_order_changed on public.payment_orders;
create trigger token_order_changed after update of status,payment_confirmed on public.payment_orders for each row execute function mirpanel_community.token_order_changed();
alter table mirpanel_community.token_accounts enable row level security;
alter table mirpanel_community.token_purchases enable row level security;
alter table mirpanel_community.token_gifts enable row level security;
alter table mirpanel_community.token_ledger enable row level security;
revoke all on mirpanel_community.token_accounts,mirpanel_community.token_purchases,mirpanel_community.token_gifts,mirpanel_community.token_ledger from public,anon,authenticated;
revoke all on sequence mirpanel_community.token_ledger_id_seq from public,anon,authenticated;
revoke all on function mirpanel_community.sync_token_purchase(uuid),mirpanel_community.token_order_changed() from public,anon,authenticated;
