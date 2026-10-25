-- Deploy previous app first (or disable BROWSER_ORDERS_ENABLED), then revoke only.
-- Preserve ALL orders, ownership records, receipts and prior checkout functions.
begin;
select pg_advisory_xact_lock(714026002);
revoke execute on function public.submit_payment_order_browser(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text),public.browser_orders_page(text,timestamptz,uuid,integer) from service_role;
revoke all on public.browser_order_owners from service_role;
create or replace function public.browser_orders_ready() returns integer language sql stable security definer set search_path=pg_catalog,public as $$select 0;$$;
notify pgrst,'reload schema';
commit;
