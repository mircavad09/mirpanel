begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
set local search_path=mirpanel_community,public,pg_catalog;
create table if not exists cart_v2_release(id boolean primary key default true check(id),enabled boolean not null default true);
insert into cart_v2_release values(true,true) on conflict do nothing;
create table if not exists shop_drafts(id uuid primary key,owner_hash text not null check(owner_hash~'^[a-f0-9]{64}$'),user_id text references "user"(id),product_id text not null,plan_index integer not null check(plan_index>=0),details_cipher text not null,details_tag text not null,terms_version text not null,schema_hash text not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '30 days');
create index if not exists shop_drafts_owner on shop_drafts(owner_hash,expires_at);
alter table shop_drafts add column if not exists removed_at timestamptz;
alter table shop_checkouts add column if not exists model_version integer not null default 1;
alter table shop_checkouts add column if not exists main_reservation_id uuid references public.payment_reservations(id);
alter table shop_checkouts add column if not exists main_checkout_key uuid;
alter table shop_checkouts add column if not exists order_id uuid unique references public.payment_orders(id);
alter table shop_lines drop constraint if exists shop_lines_order_id_key;
alter table public.payment_reservations add column if not exists capacity_shadow boolean not null default false;
alter table public.payment_reservations add column if not exists cart_parent_reservation_id uuid references public.payment_reservations(id);
alter table public.payment_reservations drop constraint if exists cart_shadow_parent;
alter table public.payment_reservations add constraint cart_shadow_parent check(capacity_shadow=(cart_parent_reservation_id is not null));
-- Existing reservations keep capacity_shadow=false. Only product-unit holds are
-- shadows; the parent holds exactly one bank slot and the whole payment amount.
create or replace function public.cart_shadow_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public,mirpanel_community as $$
declare parent public.payment_reservations%rowtype;
begin
 if new.capacity_shadow then
 select * into parent from public.payment_reservations where id=new.cart_parent_reservation_id;
 if not found or parent.capacity_shadow or parent.method_id is distinct from new.method_id or parent.status<>'reserved' or new.expires_at is distinct from parent.expires_at or not exists(select 1 from shop_checkouts where main_reservation_id=parent.id and model_version=2 and state='reserved') then raise exception 'CART_PARENT_REQUIRED';end if;
 end if;return new;
end;$$;
drop trigger if exists cart_shadow_guard on public.payment_reservations;
create trigger cart_shadow_guard before insert on public.payment_reservations for each row execute function public.cart_shadow_guard();
-- Restrict all bank-capacity readers (including the old single-product path)
-- to parents. No stock readers are altered.
do $$declare r record;d text;changed text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('refresh_payment_method_automation','payment_method_queue_snapshot','reserve_payment_method_v2','reserve_payment_method_v3') loop
 d:=pg_get_functiondef(r.oid);
 if position('capacity_shadow' in d)=0 then
 changed:=regexp_replace(d,'(from (public\.)?payment_reservations r\s+where )','\1 not r.capacity_shadow and ','gi');
 changed:=regexp_replace(changed,'(from (public\.)?payment_reservations\s+where )','\1 not capacity_shadow and ','gi');
 if changed=d then raise exception 'CAPACITY_READER_PATTERN_MISMATCH';end if;execute changed;
 end if;end loop;
end$$;
create or replace function public.cart_inventory_before(p_order public.payment_orders,p_insert boolean) returns void language plpgsql security definer set search_path=pg_catalog,public,mirpanel_community as $$
declare g shop_checkouts%rowtype;l shop_lines%rowtype;n integer;total bigint:=0;units integer:=0;
begin
 select * into g from shop_checkouts where id=(p_order.checkout_snapshot->>'cartGroupId')::uuid and model_version=2 for update;
 if not found or g.main_reservation_id is distinct from p_order.reservation_id or g.total_cents is distinct from round(p_order.amount*100)::bigint or g.method_id is distinct from p_order.method_id or p_order.product_id is distinct from '__cart__' then raise exception 'CART_ORDER_MISMATCH';end if;
 for l in select * from shop_lines where checkout_id=g.id loop
 total:=total+l.unit_cents;units:=units+1;
 if (l.snapshot->>'tracked')::boolean then
 select count(*) into n from employee_stock_units where inventory_reservation_id=l.reservation_id and product_id=l.product_id and state in ('RESERVED','DELIVERY_PENDING') and (p_insert or reserved_order_id=p_order.id);
 if n<>1 then raise exception 'INVENTORY_RESERVATION_REQUIRED';end if;
 end if;end loop;
 if units<1 or units<>p_order.quantity or total<>g.total_cents then raise exception 'CART_LINES_MISMATCH';end if;
end;$$;
create or replace function public.cart_inventory_after(p_order public.payment_orders,p_insert boolean,p_previous text) returns void language plpgsql security definer set search_path=pg_catalog,public,mirpanel_community as $$
declare g uuid:=(p_order.checkout_snapshot->>'cartGroupId')::uuid;ids uuid[];
begin
 if p_insert then
 update employee_stock_units set reserved_order_id=p_order.id where inventory_reservation_id in(select reservation_id from shop_lines where checkout_id=g) and state='RESERVED';
 elsif p_order.status in ('approved','completed') and p_previous not in ('approved','completed') then
 select array_agg(id) into ids from employee_stock_units where reserved_order_id=p_order.id and state in ('RESERVED','DELIVERY_PENDING');
 update employee_stock_units set state='DELIVERED',delivered_order_id=p_order.id,admin_approved_at=clock_timestamp(),version=version+1 where id=any(ids);
 if cardinality(ids)>0 then insert into employee_work_audit(actor_role,actor_ref,action,order_id,stock_ids) values('admin','inventory-system','inventory.delivered',p_order.id,ids);end if;
 update public.payment_reservations set status='completed',updated_at=clock_timestamp() where id in(select reservation_id from shop_lines where checkout_id=g) and status='reviewing';
 elsif p_order.status in ('rejected','cancelled','expired') and p_order.status is distinct from p_previous then
 perform public.inventory_release(p_order.reservation_id,p_order.id);
 update public.payment_reservations set status=case when p_order.status='expired' then 'expired' else 'cancelled' end,updated_at=clock_timestamp() where id in(select reservation_id from shop_lines where checkout_id=g) and status in ('reserved','reviewing');
 end if;
end;$$;
-- Insert a cart-specific, fully validating branch; preserve the complete legacy
-- inventory trigger implementations for every existing single-product order.
do $$declare r record;d text;branch text;pos integer;begin
 for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('inventory_order_trigger','inventory_order_after') loop
 d:=pg_get_functiondef(r.oid);if position('cart_inventory_' in d)>0 then continue;end if;
 pos:=position('begin' in lower(d));if pos=0 then raise exception 'INVENTORY_TRIGGER_PATTERN_MISMATCH';end if;
 branch:=case when r.proname='inventory_order_trigger' then 'if TG_OP=''INSERT'' or (new.status in (''approved'',''completed'') and old.status not in (''approved'',''completed'')) then perform public.cart_inventory_before(new,TG_OP=''INSERT'');end if;' else 'perform public.cart_inventory_after(new,TG_OP=''INSERT'',case when TG_OP=''INSERT'' then null else old.status::text end);' end;
 d:=overlay(d placing 'begin if new.checkout_snapshot->>''cartVersion''=''2'' then '||branch||' return new;end if;' from pos for 5);execute d;
 end loop;
end$$;
alter table shop_drafts enable row level security;alter table cart_v2_release enable row level security;
-- Count cart product lines, not the synthetic parent product, in public sales.
do $sales$declare d text;begin
 if to_regprocedure('public.product_sales_snapshot()') is not null then
 d:=pg_get_functiondef('public.product_sales_snapshot()'::regprocedure);
 if position('cart_product_units' in d)=0 and position('product_sales_delivered_units' in d)=0 then
 d:=regexp_replace(d,'select product_id,count\(\*\) as count\s+from public\.payment_orders\s+where status in \(''approved'',''completed''\)\s+group by product_id',
 'select product_id,sum(n) as count from (select product_id,1::bigint n from public.payment_orders where status in (''approved'',''completed'') and coalesce(checkout_snapshot->>''cartVersion'','''')<>''2'' union all select x->>''productId'',(x->>''quantity'')::bigint from public.payment_orders o cross join lateral jsonb_array_elements(o.checkout_snapshot->''items'') x where o.status in (''approved'',''completed'') and o.checkout_snapshot->>''cartVersion''=''2'') cart_product_units group by product_id','i');
 if position('cart_product_units' in d)=0 and position('product_sales_delivered_units' in d)=0 then raise exception 'SALES_READER_PATTERN_MISMATCH';end if;execute d;
 end if;end if;
end$sales$;
revoke all on shop_drafts,cart_v2_release from public,anon,authenticated;
revoke all on function public.cart_shadow_guard(),public.cart_inventory_before(public.payment_orders,boolean),public.cart_inventory_after(public.payment_orders,boolean,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
