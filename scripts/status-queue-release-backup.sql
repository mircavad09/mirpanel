-- Same transaction as 202609030002; obtain the writer lock before table locks.
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(714025001);
create schema mirpanel_status_queue_backup_20260903;
revoke all on schema mirpanel_status_queue_backup_20260903 from public,anon,authenticated,service_role;
create table mirpanel_status_queue_backup_20260903.function_definitions as
select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('refresh_payment_method_automation','payment_method_queue_snapshot');
create table mirpanel_status_queue_backup_20260903.function_grants as
select p.oid::regprocedure::text signature,
 case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end grantee,a.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where n.nspname='public' and p.proname in ('refresh_payment_method_automation','payment_method_queue_snapshot') and a.privilege_type='EXECUTE';
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'payment_%' order by tablename loop
   execute format('lock table public.%I in share row exclusive mode',t.tablename);
   execute format('create table mirpanel_status_queue_backup_20260903.%I as table public.%I',t.tablename,t.tablename);
 end loop;
 for t in select tablename from pg_tables where schemaname='mirpanel_status_queue_backup_20260903' loop
   execute format('alter table mirpanel_status_queue_backup_20260903.%I enable row level security',t.tablename);
   execute format('revoke all on mirpanel_status_queue_backup_20260903.%I from public,anon,authenticated,service_role',t.tablename);
 end loop;
end $$;
