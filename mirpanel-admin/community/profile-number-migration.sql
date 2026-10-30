-- Display numbers only. Internal identities, orders and roles are unchanged.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926103002);
set local search_path=mirpanel_community,public;
lock table "user" in share row exclusive mode;
create sequence if not exists community_member_number_seq start with 1001;
-- No cascading FK: allocated numbers must survive account deletion.
create table if not exists community_member_numbers(user_id text primary key,member_number bigint not null unique default nextval('mirpanel_community.community_member_number_seq'),allocated_at timestamptz not null default clock_timestamp());
insert into community_member_numbers(user_id) select u.id from "user" u where not exists(select 1 from community_member_numbers n where n.user_id=u.id) order by u."createdAt",u.id;
create or replace function community_allocate_number() returns trigger language plpgsql set search_path=mirpanel_community,pg_temp as $$begin insert into community_member_numbers(user_id) values(new.id) on conflict do nothing;return new;end$$;
drop trigger if exists community_allocate_number on "user";
create trigger community_allocate_number after insert on "user" for each row execute function community_allocate_number();
alter table community_member_numbers enable row level security;
revoke all on community_member_numbers from public,anon,authenticated;
revoke all on sequence community_member_number_seq from public,anon,authenticated;
revoke all on function community_allocate_number() from public,anon,authenticated;
commit;
