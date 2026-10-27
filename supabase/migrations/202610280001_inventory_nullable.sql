-- Explicit unlimited inventory; no existing stock count or order is rewritten.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(714025001);
do $$begin if employee_system_ready() not in (5,6) then raise exception 'INVENTORY_SCHEMA_5_OR_6_REQUIRED';end if;end$$;
create schema if not exists inventory_nullable_backup;
revoke all on schema inventory_nullable_backup from public,anon,authenticated,service_role;
create table if not exists inventory_nullable_backup.functions(name text primary key,definition text not null);
insert into inventory_nullable_backup.functions select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('inventory_snapshot','inventory_is_tracked','inventory_order_trigger') on conflict do nothing;
create table if not exists inventory_nullable_backup.manifest(table_name text primary key,row_count bigint not null,captured_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['product_inventory_policies','employee_catalog_plans','employee_stock_units'] loop
 if to_regclass('inventory_nullable_backup.'||t) is null then execute format('create table inventory_nullable_backup.%I as table public.%I',t,t);end if;
 execute format('insert into inventory_nullable_backup.manifest select %L,count(*) from inventory_nullable_backup.%I on conflict do nothing',t,t);
end loop;end$$;
alter table product_inventory_policies add column if not exists unlimited boolean not null default false;
create or replace function public.inventory_is_tracked(p_product text,p_key text) returns boolean language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from product_inventory_policies where product_id=p_product and scope='product') then
 exists(select 1 from product_inventory_policies where product_id=p_product and scope='product' and not unlimited)
 else exists(select 1 from employee_catalog_plans where product_id=p_product and source_plan_key=p_key and inventory_tracked) end;
$$;
create or replace function public.inventory_snapshot() returns jsonb language sql stable security definer set search_path=public as $$
with products as(select product_id,scope,version,unlimited from product_inventory_policies union select distinct p.product_id,'plan',0,false from employee_catalog_plans p where inventory_tracked and not exists(select 1 from product_inventory_policies x where x.product_id=p.product_id))
select coalesce(jsonb_agg(jsonb_build_object('productId',p.product_id,'scope',p.scope,'version',p.version,'unlimited',p.unlimited,
 'available',case when p.scope='product' and not p.unlimited then (select count(*) from employee_stock_units u where u.product_id=p.product_id and u.plan_id is null and state='AVAILABLE') else null end,
 'plans',case when p.scope='plan' then (select coalesce(jsonb_agg(jsonb_build_object('planKey',c.source_plan_key,'tracked',c.inventory_tracked,'available',case when c.inventory_tracked then (select count(*) from employee_stock_units u where u.plan_id=c.id and u.state='AVAILABLE') else null end)),'[]'::jsonb) from employee_catalog_plans c where c.product_id=p.product_id) else '[]'::jsonb end)),'[]'::jsonb) from products p;
$$;
create or replace function public.inventory_set_nullable_quantity(p_product text,p_available integer,p_actor text,p_key uuid,p_expected_version integer default 0,p_plan_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare saved employee_requests%rowtype;policy product_inventory_policies%rowtype;plan uuid;n integer;i integer;ids uuid[];v jsonb;payload jsonb:=jsonb_build_object('nullableInventory',p_product,'available',p_available,'version',p_expected_version,'plan',p_plan_key);
begin
 if nullif(trim(p_actor),'') is null or p_key is null or p_product is null or p_product!~'^[a-zA-Z0-9_-]{1,100}$' or p_expected_version is null or (p_available is not null and p_available not between 0 and 10000) or (p_plan_key is not null and p_plan_key!~'^[0-9]+$') then raise exception 'INVALID_INVENTORY';end if;
 perform pg_advisory_xact_lock(714025001);
 select * into saved from employee_requests where actor_ref=p_actor and request_key=p_key;
 if found then if saved.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 select * into policy from product_inventory_policies where product_id=p_product for update;
 if coalesce(policy.version,0)<>p_expected_version then raise exception 'INVENTORY_VERSION_CONFLICT';end if;
 if p_plan_key is null then
  if policy.scope='plan' or exists(select 1 from employee_catalog_plans where product_id=p_product and inventory_tracked) then raise exception 'PLAN_INVENTORY_MANAGED_SEPARATELY';end if;
  insert into product_inventory_policies(product_id,scope,unlimited) values(p_product,'product',p_available is null) on conflict(product_id) do update set unlimited=excluded.unlimited;
 else
  if policy.scope='product' then raise exception 'PRODUCT_INVENTORY_MANAGED_SEPARATELY';end if;
  select id into plan from employee_catalog_plans where product_id=p_product and source_plan_key=p_plan_key for update;
  if plan is null then raise exception 'INVENTORY_PLAN_NOT_CONFIGURED';end if;
  insert into product_inventory_policies(product_id,scope) values(p_product,'plan') on conflict do nothing;
  update employee_catalog_plans set inventory_tracked=(p_available is not null) where id=plan;
 end if;
 if p_available is not null then
  select count(*) into n from employee_stock_units where product_id=p_product and plan_id is not distinct from plan and state='AVAILABLE';
  if p_available>n then
   for i in 1..(p_available-n) loop insert into employee_stock_units(id,product_id,plan_id,secret_cipher,fingerprint,unit_kind) values(gen_random_uuid(),p_product,plan,'',gen_random_uuid()::text,'quantity');end loop;
  elsif p_available<n then
   select array_agg(id) into ids from(select id from employee_stock_units where product_id=p_product and plan_id is not distinct from plan and state='AVAILABLE' and unit_kind='quantity' order by created_at,id for update limit n-p_available)s;
   if coalesce(cardinality(ids),0)<>n-p_available then raise exception 'INVENTORY_CREDENTIAL_MANAGED';end if;
   update employee_stock_units set state='DISABLED',version=version+1 where id=any(ids);
  end if;
 end if;
 update product_inventory_policies set version=version+1,updated_at=clock_timestamp() where product_id=p_product returning * into policy;
 v:=jsonb_build_object('ok',true,'available',p_available,'unlimited',p_available is null,'version',policy.version,'planKey',p_plan_key);
 insert into employee_requests values(p_actor,p_key,payload,v,clock_timestamp());
 insert into employee_work_audit(actor_role,actor_ref,action) values('admin',p_actor,case when p_available is null then 'inventory.unlimited_set' else 'inventory.quantity_set' end);
 return v;
end;$$;
create or replace function public.inventory_order_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare n integer;ids uuid[];required boolean;begin
 perform pg_advisory_xact_lock(714025001);
 required:=new.inventory_required or inventory_is_tracked(new.product_id,new.plan_id) or exists(select 1 from employee_stock_units where inventory_reservation_id=new.reservation_id and state in ('RESERVED','DELIVERY_PENDING'));
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
create or replace function public.inventory_nullable_ready() returns boolean language sql stable security definer set search_path=public as $$select true;$$;
revoke all on function inventory_set_nullable_quantity(text,integer,text,uuid,integer,text),inventory_nullable_ready() from public,anon,authenticated;
grant execute on function inventory_set_nullable_quantity(text,integer,text,uuid,integer,text),inventory_nullable_ready() to service_role;
notify pgrst,'reload schema';
commit;
