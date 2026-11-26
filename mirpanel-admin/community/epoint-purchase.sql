-- Additive, purpose-separated direct purchases. No historical money is rewritten.
alter table mirpanel_community.shop_checkouts drop constraint if exists shop_checkouts_mode_check;
alter table mirpanel_community.shop_checkouts add constraint shop_checkouts_mode_check check(mode in ('card','wallet','epoint'));
alter table public.payment_orders drop constraint if exists payment_orders_payment_source_check;
alter table public.payment_orders add constraint payment_orders_payment_source_check check(payment_source in ('card','wallet','epoint'));
alter table public.payment_orders drop constraint if exists shop_receipt_required;
alter table public.payment_orders add constraint shop_receipt_required check(payment_source='epoint' or (payment_source='wallet' and payment_confirmed) or (receipt_bucket is not null and receipt_path is not null and receipt_mime is not null and receipt_size is not null and receipt_sha256 is not null));
create table if not exists mirpanel_community.epoint_purchases (
 id uuid primary key references mirpanel_community.shop_checkouts(id),
 order_id uuid not null unique references public.payment_orders(id),
 user_id text not null references mirpanel_community."user"(id),
 method text not null check(method in ('card','apple-pay','google-pay','birbank','m10')),
 cents integer not null check(cents between 100 and 50000),
 transaction text unique, paid_at timestamptz,
 state text not null default 'awaiting_payment' check(state in ('awaiting_payment','queued','ready','awaiting_stock')),
 fee_basis_points integer not null check(fee_basis_points in (0,300)),
 fee_cents integer, fee_source text not null,
 reservation_released_at timestamptz, last_error text,
 created_at timestamptz not null default clock_timestamp(),
 check((paid_at is null)=(fee_cents is null)),
 constraint epoint_purchase_fee_method check(method in ('apple-pay','m10') or fee_basis_points=0)
);
-- Replace only the former Apple-only rate constraint, preserving all other checks.
do $$declare old record;begin
 for old in select conname from pg_constraint
 where conrelid='mirpanel_community.epoint_purchases'::regclass and contype='c'
 and pg_get_constraintdef(oid)='CHECK (((method = ''apple-pay''::text) OR (fee_basis_points = 0)))'
 loop execute format('alter table mirpanel_community.epoint_purchases drop constraint %I',old.conname);end loop;
 if not exists(select 1 from pg_constraint where conrelid='mirpanel_community.epoint_purchases'::regclass and conname='epoint_purchase_fee_method') then
  alter table mirpanel_community.epoint_purchases add constraint epoint_purchase_fee_method check(method in ('apple-pay','m10') or fee_basis_points=0);
 end if;
end$$;
alter table mirpanel_community.epoint_purchases drop constraint if exists epoint_purchases_method_check;
alter table mirpanel_community.epoint_purchases add constraint epoint_purchases_method_check check(method in ('card','apple-pay','google-pay','birbank','m10'));
alter table mirpanel_community.epoint_purchases enable row level security;
revoke all on mirpanel_community.epoint_purchases from public,anon,authenticated;
create or replace function mirpanel_community.guard_epoint_order() returns trigger language plpgsql as $$
begin
 if new.payment_source='epoint' then
  if tg_op='UPDATE' and (new.amount,new.currency,new.method_id,new.payment_source) is distinct from (old.amount,old.currency,old.method_id,old.payment_source) then raise exception 'EPOINT_ORDER_IMMUTABLE';end if;
  if (new.payment_confirmed or new.status in ('approved','completed')) and not exists(select 1 from mirpanel_community.epoint_purchases p where p.order_id=new.id and p.paid_at is not null and p.cents=round(new.amount*100)::bigint) then raise exception 'EPOINT_PAYMENT_NOT_CONFIRMED';end if;
  if new.status in ('approved','completed') and new.checkout_snapshot->'epointPayment'->>'state'='awaiting_stock' then raise exception 'EPOINT_STOCK_REVIEW_REQUIRED';end if;
 end if;
 return new;
end;$$;
drop trigger if exists guard_epoint_order on public.payment_orders;
create trigger guard_epoint_order before insert or update on public.payment_orders for each row execute function mirpanel_community.guard_epoint_order();

alter table mirpanel_community.epoint_purchases add column if not exists next_delivery_at timestamptz not null default now();
