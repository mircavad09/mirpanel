-- Run before DDL, in a REPEATABLE READ transaction. No live business row is edited.
-- Freeze a private, idempotent backup; never overwrite an existing snapshot.
create schema if not exists employee_pre_release_20261021;
revoke all on schema employee_pre_release_20261021 from public,anon,authenticated,service_role;
create table if not exists employee_pre_release_20261021.manifest(
 table_name text primary key,rows_copied bigint not null,fingerprint text not null,backed_up_at timestamptz not null default now());
do $$ declare t text;n bigint;h text;source_n bigint;source_h text;
begin
 foreach t in array array['payment_orders','payment_reservations','capcut_accounts','capcut_deliveries','netflix_accounts',
 'employee_accounts','employee_reporting_periods','employee_order_assignments','employee_order_bonus_events',
 'employee_salary_settings','employee_payroll_paid','employee_stock_units','employee_work_audit',
 'employee_reporting_audit','employee_catalog_plans','employee_requests'] loop
  if to_regclass('public.'||t) is not null then
   if to_regclass('employee_pre_release_20261021.'||t) is null then
    execute format('create table employee_pre_release_20261021.%I as table public.%I',t,t);
    execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from public.%I x',t) into source_n,source_h;
    execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from employee_pre_release_20261021.%I x',t) into n,h;
    if n<>source_n or h<>source_h then raise exception 'EMPLOYEE_BACKUP_VERIFICATION_FAILED';end if;
    insert into employee_pre_release_20261021.manifest(table_name,rows_copied,fingerprint) values(t,n,h);
   else
    execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from employee_pre_release_20261021.%I x',t) into n,h;
    if not exists(select 1 from employee_pre_release_20261021.manifest m where m.table_name=t and m.rows_copied=n and m.fingerprint=h) then raise exception 'EMPLOYEE_BACKUP_MANIFEST_MISMATCH';end if;
   end if;
   execute format('revoke all on employee_pre_release_20261021.%I from public,anon,authenticated,service_role',t);
  end if;
 end loop;
end $$;
revoke all on employee_pre_release_20261021.manifest from public,anon,authenticated,service_role;
