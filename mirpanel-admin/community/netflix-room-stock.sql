begin;
set local lock_timeout='5s';
create table if not exists mirpanel_community.netflix_room_groups (
 id uuid primary key,
 fingerprint text not null,
 account_key text not null,
 account_cipher text not null,
 starts_on date not null,
 ends_on date not null check (ends_on > starts_on),
 created_by text not null,
 created_at timestamptz not null default now()
);
create table if not exists mirpanel_community.netflix_room_units (
 id uuid primary key,
 group_id uuid not null references mirpanel_community.netflix_room_groups(id),
 account_key text not null,
 room_name text not null,
 room_key text not null,
 pin_cipher text not null,
 delivery_id uuid unique references mirpanel_community.customer_order_deliveries(id),
 unique(account_key,room_key)
);
alter table mirpanel_community.netflix_room_groups enable row level security;
alter table mirpanel_community.netflix_room_units enable row level security;
revoke all on mirpanel_community.netflix_room_groups,mirpanel_community.netflix_room_units from public,anon,authenticated;
commit;
