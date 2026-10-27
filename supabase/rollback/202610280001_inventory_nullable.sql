-- Non-destructive rollback: refuses to restore finite-only code while unlimited
-- policies exist. Deliberately resolve these policies in admin first; no mass reset.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(714025001);
do $$declare r record;begin
 if exists(select 1 from product_inventory_policies where unlimited) or exists(select 1 from product_inventory_policies p join employee_catalog_plans c using(product_id) where p.scope='plan' and not c.inventory_tracked and not exists(select 1 from inventory_nullable_backup.employee_catalog_plans old where old.id=c.id and not old.inventory_tracked)) then raise exception 'ROLLBACK_BLOCKED_UNLIMITED_POLICIES';end if;
 for r in select * from inventory_nullable_backup.functions loop execute r.definition;end loop;
end$$;
revoke execute on function inventory_set_nullable_quantity(text,integer,text,uuid,integer,text) from service_role;
create or replace function public.inventory_nullable_ready() returns boolean language sql stable security definer set search_path=public as $$select false;$$;
commit;
