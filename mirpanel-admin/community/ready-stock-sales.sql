begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);

-- Saving a separate Netflix limit is an explicit admin choice.
create table if not exists mirpanel_community.ready_stock_sales_products (
 product_id text primary key check(product_id='netflix')
);
alter table mirpanel_community.ready_stock_sales_products enable row level security;
revoke all on mirpanel_community.ready_stock_sales_products from public,anon,authenticated;
create table if not exists mirpanel_community.ready_stock_sales_functions (
 name text primary key,definition text not null
);
revoke all on mirpanel_community.ready_stock_sales_functions from public,anon,authenticated;
insert into mirpanel_community.ready_stock_sales_functions
 select oid::regprocedure::text,pg_get_functiondef(oid) from pg_proc
 where oid in ('public.inventory_snapshot()'::regprocedure,'public.inventory_is_tracked(text,text)'::regprocedure)
 on conflict do nothing;

create or replace function public.inventory_snapshot() returns jsonb language sql stable security definer
set search_path=pg_catalog,public as $$
 with base as (select public.inventory_snapshot_before_netflix_rooms() entries)
 select case when exists(select 1 from mirpanel_community.ready_stock_sales_products where product_id='netflix')
 then entries
 else coalesce((select jsonb_agg(x) from jsonb_array_elements(entries) x where x->>'productId'<>'netflix'),'[]'::jsonb)
 || jsonb_build_array(coalesce((select x from jsonb_array_elements(entries) x where x->>'productId'='netflix' limit 1),'{}'::jsonb)
 || jsonb_build_object('productId','netflix','scope','product','unlimited',false,'plans','[]'::jsonb,
 'available',(select count(*) from mirpanel_community.netflix_room_sellable))) end from base;
$$;

create or replace function public.inventory_is_tracked(p_product text,p_key text) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select case when p_product='netflix' and not exists(
  select 1 from mirpanel_community.ready_stock_sales_products where product_id='netflix'
 ) then false else public.inventory_is_tracked_before_netflix_rooms(p_product,p_key) end;
$$;

create or replace function public.ready_stock_set_sales(p_available integer,p_actor text,p_key uuid,p_expected_version integer,p_plan_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(714025001);
 result:=public.inventory_set_nullable_quantity('netflix',p_available,p_actor,p_key,p_expected_version,case when exists(select 1 from public.product_inventory_policies where product_id='netflix' and scope='plan') then p_plan_key else null end);
 insert into mirpanel_community.ready_stock_sales_products values('netflix') on conflict do nothing;
 return result;
end;
$$;
revoke all on function public.ready_stock_set_sales(integer,text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.ready_stock_set_sales(integer,text,uuid,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
