-- Non-destructive off switch. Keep the server's manual_only access guard installed.
begin;
update public.manual_stock_release set enabled=false where id;
-- Preserve employees, secrets, allocations and audit; revoke only new manual-only logins.
update public.employee_accounts set active=false,session_version=session_version+1 where manual_only and active;
commit;
