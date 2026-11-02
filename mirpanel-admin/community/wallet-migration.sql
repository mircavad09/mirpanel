begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926110201);
set local search_path=mirpanel_community,pg_catalog;
create table if not exists wallet_release(id boolean primary key default true check(id),enabled boolean not null default true);
insert into wallet_release values(true,true) on conflict do nothing;
create table if not exists wallet_accounts(user_id text primary key references "user"(id),cents bigint not null default 0 check(cents>=0 and cents<=9007199254740991));
create table if not exists wallet_ledger(id bigint generated always as identity primary key,actor_id text not null references "user"(id),user_id text not null references "user"(id),request_id uuid not null,cents bigint not null check(cents>0),before_cents bigint not null,after_cents bigint not null,reason text not null check(length(reason) between 3 and 300),kind text not null default 'admin_credit' check(kind='admin_credit'),created_at timestamptz not null default clock_timestamp(),unique(actor_id,request_id),check(after_cents=before_cents+cents));
create index if not exists wallet_ledger_user on wallet_ledger(user_id,id desc);
create or replace function wallet_immutable() returns trigger language plpgsql as $$begin raise exception 'WALLET_LEDGER_IMMUTABLE';end$$;
drop trigger if exists wallet_immutable on wallet_ledger;
create trigger wallet_immutable before update or delete or truncate on wallet_ledger for each statement execute function wallet_immutable();
create or replace function wallet_credit(p_actor text,p_user text,p_cents bigint,p_reason text,p_request uuid) returns jsonb
language plpgsql security definer set search_path=mirpanel_community,pg_catalog as $$
declare old wallet_ledger%rowtype; previous bigint; item wallet_ledger%rowtype;
begin
 if not exists(select 1 from wallet_release where id and enabled) then raise exception 'WALLET_DISABLED';end if;
 if not exists(select 1 from owner_identity o join "user" u on u.id=o.user_id join account a on a."userId"=o.user_id and a."providerId"='google' and a."accountId"=o.google_subject join community_group_roles r on r.user_id=o.user_id and r.role='owner' where o.user_id=p_actor and u."emailVerified" and lower(u.email)='mircavad09@gmail.com') then raise exception 'WALLET_OWNER_REQUIRED';end if;
 if p_cents is null or p_cents<=0 or p_cents>100000000 or p_reason is null or length(trim(p_reason)) not between 3 and 300 or p_request is null then raise exception 'WALLET_INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor||p_request::text,0));
 select * into old from wallet_ledger where actor_id=p_actor and request_id=p_request;
 if found then
  if old.user_id<>p_user or old.cents<>p_cents or old.reason<>trim(p_reason) then raise exception 'WALLET_KEY_CONFLICT';end if;
  return to_jsonb(old)||jsonb_build_object('idempotent',true);
 end if;
 insert into wallet_accounts(user_id) values(p_user) on conflict do nothing;
 select cents into previous from wallet_accounts where user_id=p_user for update;
 update wallet_accounts set cents=cents+p_cents where user_id=p_user;
 insert into wallet_ledger(actor_id,user_id,request_id,cents,before_cents,after_cents,reason) values(p_actor,p_user,p_request,p_cents,previous,previous+p_cents,trim(p_reason)) returning * into item;
 return to_jsonb(item)||jsonb_build_object('idempotent',false);
end$$;
revoke all on wallet_accounts,wallet_ledger,wallet_release from public;
revoke all on function wallet_credit(text,text,bigint,text,uuid) from public;
do $$begin if exists(select 1 from pg_roles where rolname='anon') then execute 'revoke all on mirpanel_community.wallet_accounts,mirpanel_community.wallet_ledger,mirpanel_community.wallet_release from anon,authenticated';end if;end$$;
commit;
