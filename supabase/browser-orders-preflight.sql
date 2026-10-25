-- READ ONLY. Run in mirpanel-payments / sidgtcgyqkdplgfabmmp, SQL Editor.
-- External backup + successful isolated restore MUST be confirmed separately.
begin read only;
do $$begin
 if to_regprocedure('public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer)') is null then raise exception 'STOP: CHECKOUT_V2_MISSING';end if;
 if to_regprocedure('public.employee_order_workflow(uuid[])') is null then raise exception 'STOP: WORKFLOW_STATUS_MISSING';end if;
 if to_regclass('public.payment_orders') is null or to_regclass('public.payment_reservations') is null then raise exception 'STOP: TABLES_MISSING';end if;
 if public.employee_system_ready()<>6 then raise exception 'STOP: REVIEW_SCHEMA_COMPATIBILITY';end if;
end$$;
select 'BROWSER_ORDERS_PREFLIGHT_OK' as result;
commit;
