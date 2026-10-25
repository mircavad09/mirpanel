-- Read-only schema / backup / privilege checks; not the migration itself.
select employee_system_ready() as employee_schema_version,receipt_validation_ready() as receipt_validation_version;
select * from receipt_release_20261025.manifest order by table_name;
do $$declare r record;n bigint;begin
 if employee_system_ready()<>6 or receipt_validation_ready()<>1 then raise exception 'EXPECTED_RECEIPT_SCHEMA_6';end if;
 if(select count(*) from receipt_release_20261025.manifest)<>3 then raise exception 'BACKUP_INCOMPLETE';end if;
 for r in select * from receipt_release_20261025.manifest loop execute format('select count(*) from receipt_release_20261025.%I',r.table_name) into n;if n<>r.row_count then raise exception 'BACKUP_MISMATCH';end if;end loop;
 if has_table_privilege('authenticated','receipt_inspections','select') or has_function_privilege('anon','receipt_register(uuid,text,text,text,jsonb,text,text,text)','execute') then raise exception 'RECEIPT_PERMISSION_LEAK';end if;
 if has_table_privilege('service_role','receipt_inspections','insert') then raise exception 'RECEIPT_DIRECT_WRITE_LEAK';end if;
end$$;
