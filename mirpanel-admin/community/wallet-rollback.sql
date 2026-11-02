-- Disable new credits without deleting any account, balance or immutable history.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926110201);
update mirpanel_community.wallet_release set enabled=false where id;
commit;
