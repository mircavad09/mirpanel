-- Deploy previous application first. Retain all allocated numbers permanently.
begin;
set local search_path=mirpanel_community,public;
select pg_advisory_xact_lock(926103002);
select count(*) as retained_numbers from community_member_numbers;
commit;
