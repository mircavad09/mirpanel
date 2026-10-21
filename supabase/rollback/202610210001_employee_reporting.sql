-- Switch the employee feature OFF before rollback. Preserve every account/period/ledger/audit row.
-- This rollback deliberately does not drop tables or rewrite any legacy payment order.
begin;
revoke all on function public.employee_start_reporting(uuid,text),public.employee_reporting_snapshot(uuid) from service_role;
revoke all on public.employee_accounts,public.employee_reporting_periods,public.employee_order_assignments,
  public.employee_order_bonus_events,public.employee_reporting_audit from service_role;
commit;
