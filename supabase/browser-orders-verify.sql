-- Read only; no user data/token output. Expected: READY=1, manifest=2, RLS=true,
-- anon_read=false, anon_rpc=false, service_rpc=true, orphan_links=0.
begin read only;
select public.browser_orders_ready() as ready;
select count(*) as manifest_entries from browser_orders_release_20261025.manifest;
select relrowsecurity as rls from pg_class where oid='public.browser_order_owners'::regclass;
select has_table_privilege('anon','public.browser_order_owners','SELECT') as anon_read,
 has_function_privilege('anon','public.browser_orders_page(text,timestamptz,uuid,integer)','EXECUTE') as anon_rpc,
 has_function_privilege('service_role','public.submit_payment_order_browser(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text)','EXECUTE') as service_rpc;
select count(*) as orphan_links from public.browser_order_owners b left join public.payment_orders o on o.id=b.order_id where o.id is null;
commit;
