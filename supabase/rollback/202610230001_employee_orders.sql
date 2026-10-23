-- No DROP, DELETE or historical UPDATE. Refuse unsafe downgrade with open claims.
begin;
select pg_advisory_xact_lock(714025001);
do $$declare r record;begin
 if exists(select 1 from employee_order_claims c join payment_orders o on o.id=c.order_id where o.status in ('reviewing','new_receipt_requested')) then raise exception 'ROLLBACK_BLOCKED_OPEN_ORDER_CLAIMS';end if;
 for r in select definition from employee_orders_release_20261023.functions loop execute r.definition;end loop;
end$$;
revoke all on function public.employee_order_action_v4(uuid,text,text,text,uuid,uuid,integer,jsonb),public.employee_order_workflow(uuid[]) from service_role;
commit;
select public.employee_system_ready() as employee_schema_version;
