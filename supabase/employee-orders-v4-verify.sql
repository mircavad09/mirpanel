-- Read-only validation after applying 202610230001_employee_orders.sql.
select public.employee_system_ready() as employee_schema_version;
select table_name,row_count,captured_at from employee_orders_release_20261023.manifest order by table_name;
do $$declare r record;n bigint;begin
 if public.employee_system_ready()<>4 then raise exception 'EXPECTED_SCHEMA_4';end if;
 if (select count(*) from employee_orders_release_20261023.manifest)<>7 then raise exception 'BACKUP_MANIFEST_INCOMPLETE';end if;
 for r in select * from employee_orders_release_20261023.manifest loop execute format('select count(*) from employee_orders_release_20261023.%I',r.table_name) into n;if n<>r.row_count then raise exception 'BACKUP_MANIFEST_MISMATCH';end if;end loop;
 if has_table_privilege('authenticated','public.employee_order_claims','select') or has_function_privilege('authenticated','public.employee_order_action_v4(uuid,text,text,text,uuid,uuid,integer,jsonb)','execute') then raise exception 'PUBLIC_PERMISSION_LEAK';end if;
end$$;
