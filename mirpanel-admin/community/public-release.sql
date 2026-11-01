-- Additive public-community release. No customer/order import or historical relinking.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926103201);
set local search_path=mirpanel_community,public;
do $$begin if to_regclass('mirpanel_community.owner_identity') is null or to_regclass('mirpanel_community.community_member_numbers') is null then raise exception 'CURRENT_OWNER_PROFILE_SCHEMA_REQUIRED';end if;end$$;
create table if not exists public_community_backup_manifest(release_key text not null,object_name text not null,rows_before bigint not null,captured_at timestamptz not null default clock_timestamp(),primary key(release_key,object_name));
insert into public_community_backup_manifest select 'public-v1','public.payment_orders',count(*),clock_timestamp() from public.payment_orders on conflict do nothing;
insert into public_community_backup_manifest select 'public-v1','mirpanel_community.user',count(*),clock_timestamp() from "user" on conflict do nothing;
-- The manifest is not a backup. A verified encrypted external dump is mandatory.
alter table "user" add column if not exists phone_number text;
alter table "user" add column if not exists phone_verified boolean default false;
alter table "user" add column if not exists registration_terms_accepted_at timestamptz;
create table if not exists community_presence(user_id text not null references "user"(id) on delete cascade,session_id text not null references session(id) on delete cascade,tab_id uuid not null,last_seen timestamptz not null default clock_timestamp(),primary key(session_id,tab_id));
create index if not exists community_presence_recent on community_presence(last_seen);
do $$begin if exists(select 1 from "user" where id='mirpanel-system-bot-v1' and (email<>'system-bot@invalid.local' or name<>'MirPanel bot')) then raise exception 'SYSTEM_BOT_ID_CONFLICT';end if;end$$;
insert into "user"(id,name,email,"emailVerified") values('mirpanel-system-bot-v1','MirPanel bot','system-bot@invalid.local',false) on conflict(id) do nothing;
insert into community_profiles(user_id,display_name,avatar) values('mirpanel-system-bot-v1','MirPanel bot',5) on conflict do nothing;
create table if not exists community_bot_blocks(user_id text not null references "user"(id),client_id uuid not null,payload_hash text not null,reason text not null check(reason in ('profanity','insult','contact','threat')),warning_id bigint references community_messages(id),created_at timestamptz not null default clock_timestamp(),primary key(user_id,client_id));
create table if not exists community_bot_warnings(reason text primary key,last_at timestamptz not null default '-infinity',message_id bigint references community_messages(id));
create table if not exists community_bot_tags(message_id bigint primary key references community_messages(id),recipient_id text not null references "user"(id),display_name text not null,reason text not null,created_at timestamptz not null default clock_timestamp(),read_at timestamptz);
create index if not exists community_bot_tags_unread on community_bot_tags(recipient_id,created_at desc) where read_at is null;
create or replace function community_bot_identity_guard() returns trigger language plpgsql set search_path=mirpanel_community,pg_temp as $$begin if new."userId"='mirpanel-system-bot-v1' then raise exception 'SYSTEM_ACCOUNT_NO_LOGIN' using errcode='42501';end if;return new;end$$;
drop trigger if exists system_bot_no_session on session;
create trigger system_bot_no_session before insert or update on session for each row execute function community_bot_identity_guard();
drop trigger if exists system_bot_no_account on account;
create trigger system_bot_no_account before insert or update on account for each row execute function community_bot_identity_guard();
create table if not exists public_community_release(version integer primary key,ready boolean not null default true,applied_at timestamptz not null default clock_timestamp());
insert into public_community_release(version) values(1) on conflict do nothing;
do $$declare t text;begin foreach t in array array['public_community_backup_manifest','community_presence','community_bot_blocks','community_bot_warnings','community_bot_tags','public_community_release'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);end loop;end$$;
revoke all on function community_bot_identity_guard() from public,anon,authenticated;
-- Existing guest RPC remains untouched. Only a server-authenticated new account
-- purchase uses this wrapper; a retry cannot claim a previously anonymous order.
create or replace function public.submit_payment_order_account_v1(p_reservation_id uuid,p_checkout_key uuid,p_product_id text,p_plan_id text,p_product_title text,p_plan_name text,p_receipt_bucket text,p_receipt_path text,p_receipt_mime text,p_receipt_size integer,p_receipt_sha256 text,p_duration_months integer,p_owner_hash text,p_user_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,mirpanel_community as $$
declare existing_id uuid;linked_user text;result jsonb;
begin
 if p_user_id is null or not exists(select 1 from mirpanel_community."user" where id=p_user_id and "emailVerified" and id<>'mirpanel-system-bot-v1') then raise exception 'ACCOUNT_REQUIRED' using errcode='42501';end if;
 if exists(select 1 from mirpanel_community.community_profiles where user_id=p_user_id and blocked and (ban_until is null or ban_until>clock_timestamp())) then raise exception 'ACCOUNT_BLOCKED' using errcode='42501';end if;
 perform 1 from public.payment_reservations where id=p_reservation_id for update;
 select id into existing_id from public.payment_orders where reservation_id=p_reservation_id;
 if existing_id is not null then
  select user_id into linked_user from mirpanel_community.community_order_owners where order_id=existing_id;
  if linked_user is distinct from p_user_id then raise exception 'ACCOUNT_ORDER_OWNER_MISMATCH' using errcode='42501';end if;
 end if;
 result:=public.submit_payment_order_browser(p_reservation_id,p_checkout_key,p_product_id,p_plan_id,p_product_title,p_plan_name,p_receipt_bucket,p_receipt_path,p_receipt_mime,p_receipt_size,p_receipt_sha256,p_duration_months,p_owner_hash);
 if existing_id is null then insert into mirpanel_community.community_order_owners(order_id,user_id) values((result->>'id')::uuid,p_user_id);end if;
 return result;
end$$;
revoke all on function public.submit_payment_order_account_v1(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.submit_payment_order_account_v1(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text,text) to service_role;
notify pgrst,'reload schema';
commit;
