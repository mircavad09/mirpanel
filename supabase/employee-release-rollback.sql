-- Set EMPLOYEE_PANEL_ENABLED=false on the server first. No data is deleted.
begin;
-- Disable EMPLOYEE_PANEL_ENABLED and back up employee tables before rollback.

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

-- Switch the employee feature OFF before rollback. Preserve every account/period/ledger/audit row.
-- This rollback deliberately does not drop tables or rewrite any legacy payment order.

revoke all on function public.employee_start_reporting(uuid,text),public.employee_reporting_snapshot(uuid) from service_role;
revoke all on public.employee_accounts,public.employee_reporting_periods,public.employee_order_assignments,
  public.employee_order_bonus_events,public.employee_reporting_audit from service_role;
commit;
