begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025002);
create table if not exists mirpanel_community.ready_stock_management (
 unit_id uuid primary key references mirpanel_community.ready_stock_units(id),
 revision integer not null default 0,
 deleted_at timestamptz,
 assignment_id uuid unique,
 user_id text references mirpanel_community."user"(id),
 paid_until date,
 plan_snapshot jsonb,
 message_cipher text,
 actor_ref text,
 assigned_at timestamptz,
 check ((assignment_id is null and user_id is null and paid_until is null and assigned_at is null) or
  (assignment_id is not null and user_id is not null and paid_until is not null and assigned_at is not null and deleted_at is null))
);
create index if not exists ready_stock_management_user on mirpanel_community.ready_stock_management(user_id,assigned_at desc,assignment_id);
alter table mirpanel_community.ready_stock_management enable row level security;
revoke all on mirpanel_community.ready_stock_management from public,anon,authenticated;
create table if not exists mirpanel_community.ready_stock_account_revisions (
 unit_id uuid not null references mirpanel_community.ready_stock_units(id),revision integer not null,stock_cipher text not null,delivery_cipher text,actor_ref text not null,created_at timestamptz not null default clock_timestamp(),primary key(unit_id,revision)
);
alter table mirpanel_community.ready_stock_account_revisions enable row level security;
revoke all on mirpanel_community.ready_stock_account_revisions from public,anon,authenticated;
commit;
