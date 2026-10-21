-- Non-destructive v3 rollback. Reverts routines only; retains timestamps, notes,
-- encrypted message snapshots, orders, stock, audit and bonus rows.
begin;
do $$declare r record;begin
 if exists(select 1 from employee_order_assignments where state not in ('COMPLETED','CANCELLED')) then
 raise exception 'ROLLBACK_BLOCKED_OPEN_EMPLOYEE_ORDERS';end if;
 for r in select definition from employee_review_release_20261021.functions loop execute r.definition;end loop;
end$$;
revoke all on function public.employee_order_action_v3(uuid,text,text,text,uuid,uuid,integer,jsonb),public.employee_review_summary() from service_role;
commit;
