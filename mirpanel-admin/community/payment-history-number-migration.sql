begin;
set local lock_timeout='5s';
lock table mirpanel_community.wallet_topups in share row exclusive mode;
alter table mirpanel_community.wallet_topups add column if not exists history_number bigint;
create table if not exists mirpanel_community.wallet_topup_history_counters (
 user_id text primary key references mirpanel_community."user"(id) on delete cascade,
 last_number bigint not null check(last_number>0)
);
alter table mirpanel_community.wallet_topup_history_counters enable row level security;
revoke all on mirpanel_community.wallet_topup_history_counters from public,anon,authenticated;

with maxima as (
 select user_id,max(history_number) as last_number
 from mirpanel_community.wallet_topups where history_number is not null group by user_id
), numbered as (
 select t.id,coalesce(m.last_number,0)+row_number() over (
  partition by t.user_id order by coalesce(t.submitted_at,t.created_at),t.id
 ) as number
 from mirpanel_community.wallet_topups t left join maxima m on m.user_id=t.user_id
 where t.status<>'draft' and t.history_number is null
)
update mirpanel_community.wallet_topups t set history_number=n.number from numbered n where n.id=t.id;

insert into mirpanel_community.wallet_topup_history_counters(user_id,last_number)
select user_id,max(history_number) from mirpanel_community.wallet_topups where history_number is not null group by user_id
on conflict(user_id) do update set last_number=greatest(wallet_topup_history_counters.last_number,excluded.last_number);
create unique index if not exists wallet_topup_history_number_unique
 on mirpanel_community.wallet_topups(user_id,history_number) where history_number is not null;

create or replace function mirpanel_community.assign_wallet_topup_history_number() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='UPDATE' then new.history_number:=old.history_number;
 else new.history_number:=null; end if;
 if new.status<>'draft' and new.history_number is null then
  insert into mirpanel_community.wallet_topup_history_counters(user_id,last_number) values(new.user_id,1)
  on conflict(user_id) do update set last_number=wallet_topup_history_counters.last_number+1
  returning last_number into new.history_number;
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.assign_wallet_topup_history_number() from public,anon,authenticated;
drop trigger if exists assign_wallet_topup_history_number on mirpanel_community.wallet_topups;
create trigger assign_wallet_topup_history_number before insert or update of status on mirpanel_community.wallet_topups
 for each row execute function mirpanel_community.assign_wallet_topup_history_number();
commit;
