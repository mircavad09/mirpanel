begin;
create schema if not exists mirpanel_capacity_backup_20260906;
create table if not exists mirpanel_capacity_backup_20260906.function_defs(
  identity_args text primary key,function_def text not null,backed_up_at timestamptz not null default now()
);
insert into mirpanel_capacity_backup_20260906.function_defs(identity_args,function_def)
select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('refresh_payment_method_automation','payment_method_queue_snapshot','reserve_payment_method_v3')
on conflict(identity_args) do nothing;
create table if not exists mirpanel_capacity_backup_20260906.invariants as
select now() backed_up_at,(select count(*) from public.payment_methods) methods,
 (select count(*) from public.payment_reservations) reservations,
 (select count(*) from public.payment_orders) orders,
 (select count(*) from public.payment_method_daily_counters) counters;
commit;
