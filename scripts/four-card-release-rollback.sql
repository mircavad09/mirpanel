-- Operator-only rollback AFTER returning the app to commit 045cdee.
-- Restore only the six changed pre-existing functions. Never restore data rows,
-- counters, order states or clocks: legitimate activity since backup must survive.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
do $$ declare f record; g record; begin
 for f in select * from mirpanel_queue_backup_20260902.function_definitions
 where signature ~ '(^|\.)(refresh_payment_method_automation|approve_payment_order_v6|reserve_payment_method_v3|set_payment_method_active_admin|delete_payment_method_safely|update_payment_method_admin)\(' loop
   execute f.definition;
   execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.signature);
   for g in select * from mirpanel_queue_backup_20260902.function_grants where signature=f.signature loop
     execute format('grant execute on function %s to %s%s',f.signature,g.grantee,case when g.is_grantable then ' with grant option' else '' end);
   end loop;
 end loop;
end $$;
revoke execute on function public.payment_method_queue_snapshot(boolean,boolean) from public,anon,authenticated,service_role;
-- Additive queue history and the private backup are retained, never dropped.
commit;
