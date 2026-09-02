-- Execute after migration but before COMMIT, while backup locks remain held.
do $$ declare t record; different boolean; begin
 for t in select tablename from pg_tables where schemaname='mirpanel_queue_backup_20260902' and tablename like 'payment_%' loop
   execute format('select exists((select * from public.%1$I except all select * from mirpanel_queue_backup_20260902.%1$I) union all (select * from mirpanel_queue_backup_20260902.%1$I except all select * from public.%1$I))',t.tablename) into different;
   if different then raise exception 'RELEASE_DATA_CHANGED: %',t.tablename; end if;
 end loop;
 if has_function_privilege('anon','public.payment_method_queue_snapshot(boolean,boolean)','execute') or has_function_privilege('authenticated','public.payment_method_queue_snapshot(boolean,boolean)','execute') then raise exception 'PUBLIC_ACCESS_NOT_BLOCKED'; end if;
 if not has_function_privilege('service_role','public.payment_method_queue_snapshot(boolean,boolean)','execute') then raise exception 'SERVER_ACCESS_MISSING'; end if;
end $$;
