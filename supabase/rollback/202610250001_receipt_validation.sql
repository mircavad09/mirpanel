-- No receipt/order/fingerprint/column/backup deletion; keep approval safety on existing validated orders.
begin;
select pg_advisory_xact_lock(714026001);
do $$begin
 if employee_system_ready() not in (5,6) then raise exception 'RECEIPT_ROLLBACK_SCHEMA_MISMATCH';end if;
 if exists(select 1 from payment_orders where receipt_validation_required and status not in ('approved','completed','rejected','cancelled','expired'))
 or exists(select 1 from receipt_inspections s join payment_reservations r on r.id=s.reservation_id where s.order_id is null and s.status<>'rejected' and s.expires_at>clock_timestamp() and r.status in ('reserved','reviewing') and r.expires_at>clock_timestamp()) then raise exception 'ROLLBACK_BLOCKED_OPEN_RECEIPTS';end if;
end$$;
do $$declare r record;begin
 if(select count(*) from receipt_release_20261025.functions where name in ('employee_system_ready()','public.employee_system_ready()'))<>1 then raise exception 'ROLLBACK_DEFINITION_MISSING';end if;
 for r in select definition from receipt_release_20261025.functions where name in ('employee_system_ready()','public.employee_system_ready()') loop execute r.definition;end loop;
 if employee_system_ready()<>5 then raise exception 'RECEIPT_ROLLBACK_TARGET_MISMATCH';end if;
end$$;
revoke all on function receipt_validation_ready(),receipt_register(uuid,text,text,text,jsonb,text,text,text),receipt_submit_order(uuid,uuid,uuid,text,text,text,text,text,text,text,integer,text,integer) from service_role;
-- Approval wrappers remain available for safe draining; bank-credit guard deliberately remains.
commit;
