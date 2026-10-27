begin read only;
select employee_system_ready() as employee_schema_version,inventory_nullable_ready() as nullable_inventory_ready;
select table_name,row_count,captured_at from inventory_nullable_backup.manifest order by table_name;
do $$declare r record;n bigint;begin
 if employee_system_ready() not in (5,6) or inventory_nullable_ready() is not true then raise exception 'INVENTORY_NULLABLE_NOT_READY';end if;
 if (select count(*) from inventory_nullable_backup.manifest)<>3 then raise exception 'MANIFEST_INCOMPLETE';end if;
 for r in select * from inventory_nullable_backup.manifest loop execute format('select count(*) from inventory_nullable_backup.%I',r.table_name) into n;if n<>r.row_count then raise exception 'MANIFEST_COUNT_MISMATCH';end if;end loop;
 if has_function_privilege('authenticated','inventory_set_nullable_quantity(text,integer,text,uuid,integer,text)','execute') or has_function_privilege('anon','inventory_set_nullable_quantity(text,integer,text,uuid,integer,text)','execute') then raise exception 'UNSAFE_INVENTORY_PRIVILEGE';end if;
end$$;
select 'INVENTORY_NULLABLE_OK' as result;
commit;
