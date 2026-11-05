select not has_function_privilege('anon','public.manual_stock_archive_employee(uuid,text)','execute') and not has_function_privilege('authenticated','public.manual_stock_archive_employee(uuid,text)','execute') as private_archive;
select exists(select 1 from pg_constraint where conname='employee_archived_inactive' and convalidated) as inactive_guard;
select not exists(select 1 from public.employee_accounts a join public.manual_stock_permissions p on a.id=p.employee_id where a.archived_at is not null) as permissions_consistent;
