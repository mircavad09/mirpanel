-- Still inside the release transaction, before any normal queue refresh.
do $$ declare t record; different boolean; begin
 for t in select tablename from pg_tables where schemaname='mirpanel_status_queue_backup_20260903' and tablename like 'payment_%' loop
   execute format('select exists((select * from public.%1$I except all select * from mirpanel_status_queue_backup_20260903.%1$I) union all (select * from mirpanel_status_queue_backup_20260903.%1$I except all select * from public.%1$I))',t.tablename) into different;
   if different then raise exception 'PAYMENT_DATA_CHANGED'; end if;
 end loop;
 if (select count(*) from mirpanel_status_queue_backup_20260903.function_definitions)<>2 then raise exception 'BACKUP_INCOMPLETE'; end if;
 if has_function_privilege('anon','public.payment_method_queue_snapshot(boolean,boolean)','execute') or has_function_privilege('authenticated','public.payment_method_queue_snapshot(boolean,boolean)','execute') then raise exception 'PUBLIC_RPC_ACCESS'; end if;
 if not has_function_privilege('service_role','public.payment_method_queue_snapshot(boolean,boolean)','execute') then raise exception 'SERVER_RPC_ACCESS_MISSING'; end if;
end $$;
