-- Disable EMPLOYEE_PANEL_ENABLED and back up employee tables before rollback.
begin;
do $$ begin if exists(select 1 from public.employee_order_assignments where state not in ('COMPLETED','CANCELLED')) then
 raise exception 'ROLLBACK_BLOCKED_OPEN_EMPLOYEE_ORDERS';end if;end $$;
drop trigger if exists employee_payment_completion_guard on public.payment_orders;
do $$ declare f record;tab text;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('employee_plan_resolve','employee_submit_checkout','employee_add_stock','employee_order_action','employee_restart_reporting','employee_order_list','employee_inventory_counts','employee_monthly_pay','employee_queue_count','employee_account_control','employee_approve_direct','employee_system_ready','employee_stock_alerts','employee_plan_review','employee_fill_legacy') loop
 execute format('revoke all on function %s from service_role',f.signature);end loop;
 foreach tab in array array['employee_catalog_plans','employee_stock_units','employee_work_audit','employee_requests','employee_salary_settings','employee_payroll_paid'] loop
 execute format('revoke all on public.%I from service_role',tab);end loop;
end $$;
-- All data and additive payment order columns are deliberately retained.
commit;
