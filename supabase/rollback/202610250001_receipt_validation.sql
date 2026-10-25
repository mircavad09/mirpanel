-- No receipt/order/fingerprint/column/backup deletion; keep approval safety on existing validated orders.
begin;
select pg_advisory_xact_lock(714026001);
do $$declare r record;begin for r in select definition from receipt_release_20261025.functions loop execute r.definition;end loop;end$$;
revoke all on function receipt_validation_ready(),receipt_register(uuid,text,text,text,jsonb,text,text,text),receipt_submit_order(uuid,uuid,uuid,text,text,text,text,text,text,text,integer,text,integer) from service_role;
-- Approval wrappers remain available for safe draining; bank-credit guard deliberately remains.
commit;
