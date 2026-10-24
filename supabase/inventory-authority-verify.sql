-- Read-only checks. No stock import, no reconciliation.
select employee_system_ready() as employee_schema_version;
select * from inventory_release_20261024.manifest order by table_name;
do $$declare r record;n bigint;begin
 if employee_system_ready()<>5 then raise exception 'EXPECTED_SCHEMA_5';end if;
 if (select count(*) from inventory_release_20261024.manifest)<>5 then raise exception 'BACKUP_INCOMPLETE';end if;
 for r in select * from inventory_release_20261024.manifest loop execute format('select count(*) from inventory_release_20261024.%I',r.table_name) into n;if n<>r.row_count then raise exception 'BACKUP_MISMATCH';end if;end loop;
 if has_function_privilege('authenticated','inventory_set_quantity(text,integer,text,uuid,integer)','execute') then raise exception 'PUBLIC_WRITE_LEAK';end if;
end$$;
