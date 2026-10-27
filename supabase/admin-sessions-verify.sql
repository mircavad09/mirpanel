do $$begin
 if to_regclass('public.admin_sessions') is null or not(select relrowsecurity from pg_class where oid='public.admin_sessions'::regclass) then raise exception 'ADMIN_SESSION_RLS_MISSING';end if;
 if has_table_privilege('anon','public.admin_sessions','SELECT') or has_table_privilege('authenticated','public.admin_sessions','SELECT') or has_function_privilege('anon','public.admin_session_action(text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.admin_session_action(text,text,text)','EXECUTE') then raise exception 'ADMIN_SESSION_PUBLIC_ACCESS';end if;
 if not has_function_privilege('service_role','public.admin_session_action(text,text,text)','EXECUTE') then raise exception 'ADMIN_SESSION_SERVICE_MISSING';end if;
 if (select count(*) from admin_sessions_release_20261027.manifest)<>1 then raise exception 'ADMIN_SESSION_MANIFEST_MISSING';end if;
 raise notice 'ADMIN_SESSIONS_VERIFIED';
end $$;
