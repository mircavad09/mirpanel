-- No data, unit, column or audit deletion. Only safe after draining open inventory.
begin;
select pg_advisory_xact_lock(714025001);
do $$begin if exists(select 1 from employee_stock_units where inventory_reservation_id is not null and state in ('RESERVED','DELIVERY_PENDING')) then raise exception 'ROLLBACK_BLOCKED_OPEN_INVENTORY';end if;end$$;
drop trigger if exists inventory_reservation_lifecycle on payment_reservations;
drop trigger if exists inventory_order_before on payment_orders;
drop trigger if exists inventory_order_after on payment_orders;
drop trigger if exists inventory_assignment_guard on employee_order_assignments;
drop trigger if exists inventory_units_version on employee_stock_units;
drop trigger if exists inventory_scope_guard on employee_stock_units;
do $$declare r record;begin for r in select definition from inventory_release_20261024.functions loop execute r.definition;end loop;end$$;
revoke all on function inventory_snapshot(),inventory_set_quantity(text,integer,text,uuid,integer),inventory_reserve_payment(uuid,text,text,numeric,text,uuid,uuid,uuid,integer,boolean) from service_role;
commit;
