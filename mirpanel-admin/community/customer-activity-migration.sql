begin;
set local search_path=mirpanel_community,public;
set local lock_timeout='5s';

create table if not exists community_customer_activity (
 user_id text primary key references "user"(id) on delete cascade,
 last_seen timestamptz not null
);
alter table community_customer_activity enable row level security;
revoke all on community_customer_activity from public,anon,authenticated;

create or replace function remember_customer_activity() returns trigger
language plpgsql set search_path=mirpanel_community,pg_catalog as $$
begin
 insert into community_customer_activity(user_id,last_seen) values(new.user_id,new.last_seen)
 on conflict(user_id) do update set last_seen=excluded.last_seen
 where community_customer_activity.last_seen<excluded.last_seen;
 return new;
end;
$$;
revoke all on function remember_customer_activity() from public,anon,authenticated;
drop trigger if exists remember_customer_activity on community_presence;
create trigger remember_customer_activity
after insert or update of last_seen on community_presence for each row
when (new.tab_id='00000000-0000-0000-0000-000000000001'::uuid)
execute function remember_customer_activity();

-- Preserve actual observations, not the account creation or session expiration time.
insert into community_customer_activity(user_id,last_seen)
select v.user_id,max(v.last_seen) from community_presence v
join session s on s.id=v.session_id and s."userId"=v.user_id
where isfinite(v.last_seen) and v.last_seen<=clock_timestamp() and v.last_seen<=s."expiresAt"
group by v.user_id
on conflict(user_id) do update set last_seen=excluded.last_seen
where community_customer_activity.last_seen<excluded.last_seen;
commit;
