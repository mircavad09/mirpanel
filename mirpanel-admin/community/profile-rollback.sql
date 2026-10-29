-- Deploy previous application first. Retain media and optional fields; no row deletion.
begin;
select pg_advisory_xact_lock(926103001);
-- The previous app ignores the additive columns/table. No destructive DDL is required.
select to_regclass('mirpanel_community.profile_media') is not null as retained_media;
commit;
