-- Run immediately before the queue migration, in the SAME transaction.
-- Fail rather than overwrite a previous recovery point.
create schema mirpanel_queue_backup_20260902;
revoke all on schema mirpanel_queue_backup_20260902 from public,anon,authenticated,service_role;
create table mirpanel_queue_backup_20260902.function_definitions as
select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f';
create table mirpanel_queue_backup_20260902.function_grants as
select p.oid::regprocedure::text as signature,
 case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end as grantee,
 a.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where n.nspname='public' and p.prokind='f' and a.privilege_type='EXECUTE';
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'payment_%' order by tablename loop
   execute format('lock table public.%I in share row exclusive mode',t.tablename);
 end loop;
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'payment_%' order by tablename loop
   execute format('create table mirpanel_queue_backup_20260902.%I as table public.%I',t.tablename,t.tablename);
 end loop;
 for t in select tablename from pg_tables where schemaname='mirpanel_queue_backup_20260902' loop
   execute format('alter table mirpanel_queue_backup_20260902.%I enable row level security',t.tablename);
   execute format('revoke all on mirpanel_queue_backup_20260902.%I from public,anon,authenticated,service_role',t.tablename);
 end loop;
end $$;
