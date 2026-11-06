select exists(select 1 from pg_tables where schemaname='mirpanel_community' and tablename='shop_drafts' and rowsecurity) as drafts_rls;
select not has_table_privilege('anon','mirpanel_community.shop_drafts','SELECT,INSERT,UPDATE,DELETE') as drafts_private;
select exists(select 1 from pg_constraint where conrelid='public.payment_reservations'::regclass and conname='cart_shadow_parent') as parent_guard;
select bool_and(position('capacity_shadow' in pg_get_functiondef(p.oid))>0) as capacity_readers from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('refresh_payment_method_automation','payment_method_queue_snapshot','reserve_payment_method_v2','reserve_payment_method_v3');
select bool_and(position('cart_inventory_' in pg_get_functiondef(p.oid))>0) as inventory_validation from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('inventory_order_trigger','inventory_order_after');
