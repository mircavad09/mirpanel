-- Additive guest-browser ownership. No old order backfill; no business status changes.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(714026002);
do $$begin if to_regprocedure('public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer)') is null then raise exception 'CHECKOUT_V2_REQUIRED';end if;end$$;
create schema if not exists browser_orders_release_20261025;
revoke all on schema browser_orders_release_20261025 from public,anon,authenticated,service_role;
create table if not exists browser_orders_release_20261025.manifest(table_name text primary key,row_count bigint not null,captured_at timestamptz not null default clock_timestamp());
insert into browser_orders_release_20261025.manifest select 'payment_orders',count(*),clock_timestamp() from public.payment_orders on conflict do nothing;
insert into browser_orders_release_20261025.manifest select 'payment_reservations',count(*),clock_timestamp() from public.payment_reservations on conflict do nothing;
-- Manifest = pre-change inventory, NOT a backup. External backup/restore is a release gate.
create table if not exists public.browser_order_owners(
 order_id uuid primary key references public.payment_orders(id) on delete cascade,
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 linked_at timestamptz not null default clock_timestamp()
);
create index if not exists browser_order_owners_token_idx on public.browser_order_owners(token_hash,linked_at desc,order_id);
alter table public.browser_order_owners enable row level security;
revoke all on public.browser_order_owners from public,anon,authenticated;
grant select on public.browser_order_owners to service_role;
create or replace function public.browser_orders_ready() returns integer language sql stable security definer set search_path=pg_catalog,public as $$select 1;$$;
create or replace function public.submit_payment_order_browser(
 p_reservation_id uuid,p_checkout_key uuid,p_product_id text,p_plan_id text,p_product_title text,p_plan_name text,
 p_receipt_bucket text,p_receipt_path text,p_receipt_mime text,p_receipt_size integer,p_receipt_sha256 text,p_duration_months integer,p_owner_hash text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare existing_id uuid;owner_hash text;result jsonb;
begin
 if p_owner_hash is null or p_owner_hash !~ '^[0-9a-f]{64}$' then raise exception 'BROWSER_OWNER_REQUIRED';end if;
 -- Same reservation is serialised before checking whether it predates this feature.
 perform pg_advisory_xact_lock(hashtextextended(p_reservation_id::text,714026002));
 select id into existing_id from public.payment_orders where reservation_id=p_reservation_id;
 if existing_id is not null then
  select token_hash into owner_hash from public.browser_order_owners where order_id=existing_id;
  if owner_hash is not null and owner_hash<>p_owner_hash then raise exception 'BROWSER_OWNER_MISMATCH';end if;
 end if;
 result:=public.submit_payment_order_v2(p_reservation_id,p_checkout_key,p_product_id,p_plan_id,p_product_title,p_plan_name,p_receipt_bucket,p_receipt_path,p_receipt_mime,p_receipt_size,p_receipt_sha256,p_duration_months);
 -- Never attach an old/unowned existing order, even when a valid checkout is retried.
 if existing_id is null then
  insert into public.browser_order_owners(order_id,token_hash) values((result->>'id')::uuid,p_owner_hash);
 end if;
 return result;
end;$$;
create or replace function public.browser_orders_page(p_owner_hash text,p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 21)
returns table(id uuid,order_code text,product_title text,plan_name text,amount numeric,currency text,created_at timestamptz,status text,receipt_deleted_at timestamptz,receipt_path text)
language sql stable security definer set search_path=pg_catalog,public as $$
 select o.id,o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.created_at,o.status::text,o.receipt_deleted_at,o.receipt_path from public.payment_orders o join public.browser_order_owners b on b.order_id=o.id
 where b.token_hash=p_owner_hash and (p_before is null or (o.created_at,o.id)<(p_before,p_before_id))
 order by o.created_at desc,o.id desc limit least(greatest(coalesce(p_limit,21),1),21);
$$;
revoke all on function public.browser_orders_ready(),public.submit_payment_order_browser(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text),public.browser_orders_page(text,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.browser_orders_ready(),public.submit_payment_order_browser(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text),public.browser_orders_page(text,timestamptz,uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
