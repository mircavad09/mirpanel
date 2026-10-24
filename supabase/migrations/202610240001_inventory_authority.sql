-- Schema 5: employee_stock_units is the ONLY operational stock ledger.
-- No seed, no historical order reconciliation, no catalogue quantity import.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(714025001);
do $$begin if employee_system_ready() not in (4,5) then raise exception 'EMPLOYEE_V4_REQUIRED';end if;end$$;
lock table payment_orders,payment_reservations,employee_stock_units,employee_catalog_plans,employee_work_audit in share mode;
create schema if not exists inventory_release_20261024;
revoke all on schema inventory_release_20261024 from public,anon,authenticated,service_role;
create table if not exists inventory_release_20261024.manifest(table_name text primary key,row_count bigint not null,captured_at timestamptz not null default clock_timestamp());
create table if not exists inventory_release_20261024.functions(name text primary key,definition text not null);
insert into inventory_release_20261024.functions select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='employee_system_ready' on conflict do nothing;
do $$declare t text;begin foreach t in array array['payment_orders','payment_reservations','employee_stock_units','employee_catalog_plans','employee_work_audit'] loop
 if to_regclass('inventory_release_20261024.'||t) is null then execute format('create table inventory_release_20261024.%I as table public.%I',t,t);end if;
 execute format('insert into inventory_release_20261024.manifest select %L,count(*),clock_timestamp() from inventory_release_20261024.%I on conflict do nothing',t,t);
end loop;end$$;
do $$declare r record;n bigint;begin
 if (select count(*) from inventory_release_20261024.manifest)<>5 then raise exception 'INVENTORY_BACKUP_MANIFEST_INVALID';end if;
 for r in select * from inventory_release_20261024.manifest loop
 execute format('select count(*) from inventory_release_20261024.%I',r.table_name) into n;
 if n<>r.row_count then raise exception 'INVENTORY_BACKUP_COUNT_MISMATCH';end if;
 end loop;
end$$;
create table if not exists public.product_inventory_policies(product_id text primary key,scope text not null check(scope in ('product','plan')),version integer not null default 1,updated_at timestamptz not null default clock_timestamp());
alter table product_inventory_policies enable row level security;
revoke all on product_inventory_policies from public,anon,authenticated;
grant select on product_inventory_policies to service_role;
alter table employee_stock_units add column if not exists inventory_reservation_id uuid references payment_reservations(id),add column if not exists unit_kind text not null default 'credential' check(unit_kind in ('credential','quantity'));
alter table employee_stock_units alter column plan_id drop not null;
-- Reservations start at checkout, before an employee/order exists.
do $$declare r record;begin for r in select conname from pg_constraint where conrelid='employee_stock_units'::regclass and contype='c' and pg_get_constraintdef(oid) like '%employee_id IS NOT NULL%' loop execute format('alter table employee_stock_units drop constraint %I',r.conname);end loop;end$$;
do $$begin if not exists(select 1 from pg_constraint where conname='inventory_unit_reservation_guard' and conrelid='employee_stock_units'::regclass) then
 alter table employee_stock_units add constraint inventory_unit_reservation_guard check(state not in ('RESERVED','DELIVERY_PENDING') or inventory_reservation_id is not null or (reserved_order_id is not null and employee_id is not null));end if;
 if not exists(select 1 from pg_constraint where conname='inventory_credential_plan_guard' and conrelid='employee_stock_units'::regclass) then
 alter table employee_stock_units add constraint inventory_credential_plan_guard check(unit_kind='quantity' or plan_id is not null);end if;end$$;
alter table payment_orders add column if not exists inventory_required boolean not null default false;
create index if not exists inventory_reservation_idx on employee_stock_units(inventory_reservation_id);
create or replace function public.inventory_scope_guard() returns trigger language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(714025001);
 if new.unit_kind='credential' and exists(select 1 from product_inventory_policies where product_id=new.product_id and scope='product') then raise exception 'PLAN_INVENTORY_MANAGED_SEPARATELY';end if;return new;end;$$;
drop trigger if exists inventory_scope_guard on employee_stock_units;
create trigger inventory_scope_guard before insert on employee_stock_units for each row execute function inventory_scope_guard();
create or replace function public.inventory_is_tracked(p_product text,p_key text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from product_inventory_policies where product_id=p_product) or exists(select 1 from employee_catalog_plans where product_id=p_product and source_plan_key=p_key and inventory_tracked);
$$;
create or replace function public.inventory_release(p_reservation uuid,p_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare ids uuid[];begin
 select array_agg(id) into ids from employee_stock_units where (inventory_reservation_id=p_reservation or reserved_order_id=p_order) and state in ('RESERVED','DELIVERY_PENDING');
 update employee_stock_units set state=case when unit_kind='credential' and revealed_at is not null then 'DISABLED' else 'AVAILABLE' end,
 inventory_reservation_id=null,reserved_order_id=null,employee_id=null,version=version+1 where id=any(ids);
 if cardinality(ids)>0 then insert into employee_work_audit(actor_role,actor_ref,action,order_id,stock_ids) values('admin','inventory-system','inventory.released',p_order,ids);end if;
end;$$;
create or replace function public.inventory_reservation_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare plan uuid;scope text;ids uuid[];tracked boolean;begin
 perform pg_advisory_xact_lock(714025001);
 if TG_OP='INSERT' then
 tracked:=inventory_is_tracked(new.product_id,new.plan_id);
 if not tracked then
 if current_setting('mirpanel.inventory_required',true)=new.product_id then raise exception 'INVENTORY_SETUP_REQUIRED';end if;return new;end if;
 select p.scope into scope from product_inventory_policies p where product_id=new.product_id;
 select id into plan from employee_catalog_plans where product_id=new.product_id and source_plan_key=new.plan_id;
 select array_agg(id) into ids from (select u.id from employee_stock_units u where u.product_id=new.product_id and u.state='AVAILABLE' and
 (case when scope='product' then u.plan_id is null else u.plan_id=plan end) order by u.created_at,u.id for update skip locked limit 1)s;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'INVENTORY_EMPTY';end if;
 update employee_stock_units set state='RESERVED',inventory_reservation_id=new.id,version=version+1 where id=any(ids);
 insert into employee_work_audit(actor_role,actor_ref,action,stock_ids) values('admin','inventory-system','inventory.reserved',ids);
 elsif new.status in ('cancelled','rejected','expired') and old.status is distinct from new.status then perform inventory_release(new.id,null);
 end if;return new;
end;$$;
-- AFTER insert is required: reservation FK must already exist. Failure rolls all back.
drop trigger if exists inventory_reservation_lifecycle on payment_reservations;
create trigger inventory_reservation_lifecycle after insert or update of status on payment_reservations for each row execute function inventory_reservation_trigger();
create or replace function public.inventory_order_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare n integer;ids uuid[];required boolean;begin
 perform pg_advisory_xact_lock(714025001);
 required:=new.inventory_required or inventory_is_tracked(new.product_id,new.plan_id);
 if TG_OP='INSERT' then
 if required then
 select count(*) into n from employee_stock_units where product_id=new.product_id and inventory_reservation_id=new.reservation_id and state='RESERVED';
 if n<>coalesce(new.quantity,1) then raise exception 'INVENTORY_RESERVATION_REQUIRED';end if;
 new.inventory_required:=true;new.quantity:=coalesce(new.quantity,1);
 end if;
 elsif new.status in ('approved','completed') and old.status not in ('approved','completed') then
 if required then
 select count(*) into n from employee_stock_units where product_id=new.product_id and reserved_order_id=new.id and inventory_reservation_id=new.reservation_id and state in ('RESERVED','DELIVERY_PENDING');
 if n<>coalesce(new.quantity,1) then raise exception 'INVENTORY_RESERVATION_REQUIRED';end if;
 end if;
 end if;return new;
end;$$;
create or replace function public.inventory_order_after() returns trigger language plpgsql security definer set search_path=public as $$
declare ids uuid[];begin
 if TG_OP='INSERT' then
 update employee_stock_units set reserved_order_id=new.id where inventory_reservation_id=new.reservation_id and state='RESERVED';
 elsif new.status in ('approved','completed') and old.status not in ('approved','completed') then
 select array_agg(id) into ids from employee_stock_units where reserved_order_id=new.id and state in ('RESERVED','DELIVERY_PENDING');
 update employee_stock_units set state='DELIVERED',delivered_order_id=new.id,admin_approved_at=clock_timestamp(),version=version+1 where id=any(ids);
 if cardinality(ids)>0 then insert into employee_work_audit(actor_role,actor_ref,action,order_id,stock_ids) values('admin','inventory-system','inventory.delivered',new.id,ids);end if;
 elsif new.status in ('cancelled','rejected','expired') and old.status is distinct from new.status then perform inventory_release(new.reservation_id,new.id);end if;return new;
end;$$;
drop trigger if exists inventory_order_before on payment_orders;
create trigger inventory_order_before before insert or update of status on payment_orders for each row execute function inventory_order_trigger();
drop trigger if exists inventory_order_after on payment_orders;
create trigger inventory_order_after after insert or update of status on payment_orders for each row execute function inventory_order_after();
create or replace function public.inventory_assignment_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare o payment_orders%rowtype;n integer;begin
 select * into o from payment_orders where id=new.order_id;
 if TG_OP='INSERT' then update employee_stock_units set employee_id=new.employee_id where reserved_order_id=new.order_id and state='RESERVED';end if;
 if new.state='DELIVERED_PENDING_ADMIN' and (TG_OP='INSERT' or old.state is distinct from new.state) and (o.inventory_required or inventory_is_tracked(o.product_id,o.plan_id)) then
 select count(*) into n from employee_stock_units where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
 if n<>new.quantity then raise exception 'INVENTORY_RESERVATION_REQUIRED';end if;end if;return new;
end;$$;
drop trigger if exists inventory_assignment_guard on employee_order_assignments;
create trigger inventory_assignment_guard before insert or update of state on employee_order_assignments for each row execute function inventory_assignment_trigger();
create or replace function public.inventory_reserve_payment(p_method_id uuid,p_product_id text,p_plan_id text,p_amount numeric,p_currency text,p_idempotency_key uuid,p_checkout_key uuid,p_previous_reservation_id uuid default null,p_minutes integer default 10,p_require_stock boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform set_config('mirpanel.inventory_required',case when p_require_stock then p_product_id else '' end,true);
 return reserve_payment_method_v3(p_method_id,p_product_id,p_plan_id,p_amount,p_currency,p_idempotency_key,p_checkout_key,p_previous_reservation_id,p_minutes);
end;$$;
create or replace function public.inventory_units_version() returns trigger language plpgsql security definer set search_path=public as $$begin update product_inventory_policies set version=version+1,updated_at=clock_timestamp() where product_id=new.product_id;return new;end;$$;
drop trigger if exists inventory_units_version on employee_stock_units;
create trigger inventory_units_version after insert or update of state on employee_stock_units for each row execute function inventory_units_version();
create or replace function public.inventory_snapshot() returns jsonb language sql stable security definer set search_path=public as $$
with products as(select product_id,scope,version from product_inventory_policies union select distinct p.product_id,'plan',0 from employee_catalog_plans p where inventory_tracked and not exists(select 1 from product_inventory_policies x where x.product_id=p.product_id))
select coalesce(jsonb_agg(jsonb_build_object('productId',p.product_id,'scope',p.scope,'version',p.version,
 'available',case when p.scope='product' then (select count(*) from employee_stock_units u where u.product_id=p.product_id and u.plan_id is null and state='AVAILABLE') else null end,
 'plans',case when p.scope='plan' then (select coalesce(jsonb_agg(jsonb_build_object('planKey',c.source_plan_key,'tracked',c.inventory_tracked,'available',(select count(*) from employee_stock_units u where u.plan_id=c.id and u.state='AVAILABLE'))),'[]'::jsonb) from employee_catalog_plans c where c.product_id=p.product_id) else '[]'::jsonb end)),'[]'::jsonb) from products p;
$$;
create or replace function public.inventory_set_quantity(p_product text,p_available integer,p_actor text,p_key uuid,p_expected_version integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$
declare saved employee_requests%rowtype;policy product_inventory_policies%rowtype;n integer;i integer;ids uuid[];v jsonb;payload jsonb:=jsonb_build_object('inventoryProduct',p_product,'available',p_available,'version',p_expected_version);begin
 if nullif(trim(p_actor),'') is null or p_key is null or p_product is null or p_available is null or p_expected_version is null or p_product!~'^[a-zA-Z0-9_-]{1,100}$' or p_available not between 0 and 10000 then raise exception 'INVALID_INVENTORY';end if;
 perform pg_advisory_xact_lock(714025001);
 select * into saved from employee_requests where actor_ref=p_actor and request_key=p_key;if found then if saved.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 select * into policy from product_inventory_policies where product_id=p_product for update;
 if exists(select 1 from employee_catalog_plans where product_id=p_product and inventory_tracked) or policy.scope='plan' then raise exception 'PLAN_INVENTORY_MANAGED_SEPARATELY';end if;
 if coalesce(policy.version,0)<>p_expected_version then raise exception 'INVENTORY_VERSION_CONFLICT';end if;
 insert into product_inventory_policies(product_id,scope) values(p_product,'product') on conflict do nothing;
 select count(*) into n from employee_stock_units where product_id=p_product and plan_id is null and state='AVAILABLE';
 if p_available>n then for i in 1..(p_available-n) loop insert into employee_stock_units(id,product_id,plan_id,secret_cipher,fingerprint,unit_kind) values(gen_random_uuid(),p_product,null,'',gen_random_uuid()::text,'quantity');end loop;
 elsif p_available<n then select array_agg(id) into ids from(select id from employee_stock_units where product_id=p_product and plan_id is null and state='AVAILABLE' order by created_at,id limit n-p_available for update)s;update employee_stock_units set state='DISABLED',version=version+1 where id=any(ids);end if;
 update product_inventory_policies set version=version+1,updated_at=clock_timestamp() where product_id=p_product returning * into policy;
 v:=jsonb_build_object('ok',true,'available',p_available,'version',policy.version);
 insert into employee_requests values(p_actor,p_key,payload,v,clock_timestamp());insert into employee_work_audit(actor_role,actor_ref,action) values('admin',p_actor,'inventory.quantity_set');return v;
end;$$;
create or replace function public.employee_system_ready() returns integer language sql stable security definer set search_path=public as $$select 5;$$;
do $$declare r record;begin for r in select p.oid::regprocedure::text as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'inventory_%' loop
 execute 'revoke all on function '||r.name||' from public,anon,authenticated';end loop;end$$;
grant execute on function inventory_snapshot(),inventory_set_quantity(text,integer,text,uuid,integer),inventory_reserve_payment(uuid,text,text,numeric,text,uuid,uuid,uuid,integer,boolean) to service_role;
commit;
select employee_system_ready() as employee_schema_version;
select * from inventory_release_20261024.manifest order by table_name;
