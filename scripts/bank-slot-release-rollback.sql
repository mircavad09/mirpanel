-- Redeploy the prior app first, then restore only the two replaced functions.
-- No orders, reservations, counters, card rows or clocks are restored.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
do $$ declare f record; g record; begin
 for f in select * from mirpanel_bank_slot_backup_20260902.function_definitions loop
   execute f.definition;
   execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.signature);
   for g in select * from mirpanel_bank_slot_backup_20260902.function_grants where signature=f.signature loop
     execute format('grant execute on function %s to %s%s',f.signature,g.grantee,case when g.is_grantable then ' with grant option' else '' end);
   end loop;
 end loop;
end $$;
commit;
