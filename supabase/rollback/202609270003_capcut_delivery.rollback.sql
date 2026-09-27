begin;
drop function if exists public.cancel_capcut_delivery(uuid,text);
drop function if exists public.approve_capcut_delivery(uuid,text);
drop table if exists public.capcut_deliveries;
drop table if exists public.capcut_accounts;
drop table if exists public.capcut_delivery_template;
commit;
