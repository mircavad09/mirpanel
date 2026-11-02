begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926110203);
set local search_path=mirpanel_community,public,pg_catalog;
create table if not exists shop_release(id boolean primary key default true check(id),enabled boolean not null default true);
insert into shop_release values(true,true) on conflict do nothing;
alter table wallet_ledger drop constraint if exists wallet_ledger_cents_check;
alter table wallet_ledger add constraint wallet_ledger_cents_check check(cents<>0);
alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table wallet_ledger add constraint wallet_ledger_kind_check check(kind in ('admin_credit','topup_credit','purchase_debit','purchase_refund'));
create table if not exists shop_checkouts(
 id uuid primary key,owner_hash text not null check(owner_hash~'^[a-f0-9]{64}$'),user_id text references "user"(id),request_id uuid not null,
 mode text not null check(mode in ('card','wallet')),method_id uuid not null references public.payment_methods(id),
 input jsonb not null,total_cents bigint not null check(total_cents>=0),state text not null default 'reserved' check(state in ('reserved','submitted','cancelled','expired')),
 receipt jsonb,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,submitted_at timestamptz,
 unique(owner_hash,request_id));
create table if not exists shop_lines(
 id uuid primary key default gen_random_uuid(),checkout_id uuid not null references shop_checkouts(id),position integer not null,
 reservation_id uuid not null unique references public.payment_reservations(id),checkout_key uuid not null,
 order_id uuid unique references public.payment_orders(id),product_id text not null,plan_id text not null,
 title text not null,plan_name text not null,image text,unit_cents bigint not null check(unit_cents>=0),snapshot jsonb not null,
 unique(checkout_id,position));
create table if not exists wallet_topups(
 id uuid primary key,user_id text not null references "user"(id),request_id uuid not null,requested_cents bigint not null check(requested_cents>0),
 method_id uuid not null references public.payment_methods(id),receipt jsonb,status text not null default 'draft' check(status in ('draft','reviewing','approved','rejected')),
 approved_cents bigint check(approved_cents>0),decided_by text references "user"(id),created_at timestamptz not null default clock_timestamp(),
 submitted_at timestamptz,decided_at timestamptz,receipt_deleted_at timestamptz,unique(user_id,request_id));
create index if not exists shop_checkouts_owner on shop_checkouts(owner_hash,created_at desc);
create index if not exists wallet_topups_user on wallet_topups(user_id,created_at desc);
alter table public.payment_orders add column if not exists payment_source text not null default 'card' check(payment_source in ('card','wallet'));
alter table public.payment_orders add column if not exists payment_confirmed boolean not null default false;
-- One privately stored receipt can belong to all linked cart lines.
alter table public.payment_orders drop constraint if exists payment_orders_receipt_path_key;
alter table public.payment_orders alter column receipt_bucket drop not null,alter column receipt_path drop not null,alter column receipt_mime drop not null,alter column receipt_size drop not null,alter column receipt_sha256 drop not null;
do $$begin if not exists(select 1 from pg_constraint where conrelid='public.payment_orders'::regclass and conname='shop_receipt_required') then
 alter table public.payment_orders add constraint shop_receipt_required check((payment_source='wallet' and payment_confirmed) or (receipt_bucket is not null and receipt_path is not null and receipt_mime is not null and receipt_size is not null and receipt_sha256 is not null));end if;end$$;
-- Rejection releases stock through the existing lifecycle and returns only the
-- original wallet-paid line amount. Repeated status updates cannot refund twice.
create or replace function shop_wallet_refund() returns trigger language plpgsql security definer set search_path=mirpanel_community,public,pg_catalog as $$
declare uid text;previous bigint;delta bigint;
begin
 if new.payment_source<>'wallet' or not new.payment_confirmed or new.status not in ('rejected','cancelled','canceled') or old.status in ('rejected','cancelled','canceled') then return new;end if;
 select c.user_id into uid from shop_lines l join shop_checkouts c on c.id=l.checkout_id where l.order_id=new.id;
 if uid is null then raise exception 'WALLET_REFUND_OWNER_REQUIRED';end if;
 if exists(select 1 from wallet_ledger where actor_id=uid and request_id=new.id and kind='purchase_refund') then return new;end if;
 delta:=round(new.amount*100)::bigint;
 if delta=0 then return new;end if;
 select cents into previous from wallet_accounts where user_id=uid for update;
 if previous is null then raise exception 'WALLET_REFUND_ACCOUNT_REQUIRED';end if;
 update wallet_accounts set cents=cents+delta where user_id=uid;
 insert into wallet_ledger(actor_id,user_id,request_id,cents,before_cents,after_cents,reason,kind) values(uid,uid,new.id,delta,previous,previous+delta,'Ləğv edilmiş balans sifarişinin geri ödənişi','purchase_refund');
 return new;
end$$;
drop trigger if exists shop_wallet_refund on public.payment_orders;
create trigger shop_wallet_refund after update of status on public.payment_orders for each row execute function shop_wallet_refund();
alter table shop_checkouts enable row level security;alter table shop_lines enable row level security;alter table wallet_topups enable row level security;
revoke all on shop_release,shop_checkouts,shop_lines,wallet_topups from public,anon,authenticated;
revoke all on function shop_wallet_refund() from public,anon,authenticated;
commit;
