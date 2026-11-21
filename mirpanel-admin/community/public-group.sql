begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025031);
-- One-time closed default. Later owner choices survive every restart/deploy.
alter table mirpanel_community.community_group_settings add column if not exists public_open boolean not null default false;
create or replace function mirpanel_community.guard_public_group_message() returns trigger language plpgsql security definer set search_path=pg_catalog,mirpanel_community as $$
declare opened boolean;
begin
 select public_open into opened from community_group_settings where id=true for share;
 if opened is distinct from true and new.user_id<>'mirpanel-system-bot-v1' and not exists(select 1 from community_group_roles where user_id=new.user_id and role='owner') then
  raise exception 'Qrup söhbəti müvəqqəti bağlıdır' using errcode='42501';
 end if;
 return new;
end;$$;
drop trigger if exists guard_public_group_message on mirpanel_community.community_messages;
create trigger guard_public_group_message before insert on mirpanel_community.community_messages for each row execute function mirpanel_community.guard_public_group_message();
revoke all on function mirpanel_community.guard_public_group_message() from public,anon,authenticated;
commit;
