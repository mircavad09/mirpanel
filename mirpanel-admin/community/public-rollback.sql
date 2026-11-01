-- First disable COMMUNITY_PUBLIC_ENABLED and deploy the last owner-only app.
-- Preserve every account, message, notification, number, audit and business row.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926103201);
update mirpanel_community.public_community_release set ready=false where version=1;
commit;
-- Reopening requires explicit release verification and ready=true; re-running
-- public-release.sql deliberately does not override this rollback safety flag.
