select
  (select count(*)=4 and bool_and(relrowsecurity) from pg_class
   where oid in ('mirpanel_community.ready_stock_release'::regclass,'mirpanel_community.ready_stock_plans'::regclass,'mirpanel_community.ready_stock_batches'::regclass,'mirpanel_community.ready_stock_units'::regclass)) as tables_private,
  not exists(select 1 from unnest(array['anon','authenticated']) as role_name
   cross join unnest(array['ready_stock_release','ready_stock_plans','ready_stock_batches','ready_stock_units']) as tbl
   where has_table_privilege(role_name,'mirpanel_community.'||tbl,'SELECT,INSERT,UPDATE,DELETE')) as grants_private,
  (select enabled from mirpanel_community.ready_stock_release where id) is true as enabled,
  to_regclass('mirpanel_community.ready_stock_free') is not null as free_index,
  exists(select 1 from pg_constraint where conrelid='mirpanel_community.ready_stock_units'::regclass and confrelid='mirpanel_community.customer_order_deliveries'::regclass and contype='f') as linked_to_delivery;
