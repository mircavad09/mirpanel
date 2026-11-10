begin;
set local lock_timeout='5s';
create table if not exists mirpanel_community.admin_push_keys(
 id boolean primary key default true check(id),public_key text not null,private_cipher text not null
);
create table if not exists mirpanel_community.admin_push_devices(
 endpoint_hash text primary key,subscription_cipher text not null,owner_id text not null,
 session_hash text not null,auth_binding text not null,created_at timestamptz not null default now()
);
create table if not exists mirpanel_community.admin_topup_push(
 topup_id uuid not null references mirpanel_community.wallet_topups(id),
 endpoint_hash text not null references mirpanel_community.admin_push_devices(endpoint_hash) on delete cascade,
 state text not null default 'queued' check(state in('queued','sending','sent','failed','uncertain')),
 attempts int not null default 0,next_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(topup_id,endpoint_hash)
);
create index if not exists admin_topup_push_pending on mirpanel_community.admin_topup_push(next_at) where state='queued';
alter table mirpanel_community.admin_push_keys enable row level security;
alter table mirpanel_community.admin_push_devices enable row level security;
alter table mirpanel_community.admin_topup_push enable row level security;
revoke all on mirpanel_community.admin_push_keys,mirpanel_community.admin_push_devices,mirpanel_community.admin_topup_push from public,anon,authenticated;
create or replace function mirpanel_community.enqueue_admin_topup_push() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.status='draft' and new.status='reviewing' and new.receipt is not null then
  insert into mirpanel_community.admin_topup_push(topup_id,endpoint_hash)
   select new.id,d.endpoint_hash from mirpanel_community.admin_push_devices d
    join public.admin_sessions s on s.token_hash=d.session_hash and s.auth_binding=d.auth_binding
    join mirpanel_community.owner_identity o on o.id=true and o.user_id=d.owner_id
   where s.expires_at>clock_timestamp() on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.enqueue_admin_topup_push() from public,anon,authenticated;
drop trigger if exists enqueue_admin_topup_push on mirpanel_community.wallet_topups;
create trigger enqueue_admin_topup_push after update of status on mirpanel_community.wallet_topups
 for each row execute function mirpanel_community.enqueue_admin_topup_push();
commit;
