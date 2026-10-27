-- Data-preserving code rollback: deploy the previous app, then disable the RPC.
-- Existing business rows and the private session table are retained, not dropped.
begin;
revoke execute on function public.admin_session_action(text,text,text) from service_role;
commit;
