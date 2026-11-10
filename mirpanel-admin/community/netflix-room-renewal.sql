begin;
set local lock_timeout='5s';
-- Preserve each existing group as its own account; never deduplicate by email.
alter table mirpanel_community.netflix_room_units add column if not exists availability text not null default 'review'
 check(availability in ('review','available'));
alter table mirpanel_community.netflix_room_units alter column availability set default 'available';
create table if not exists mirpanel_community.netflix_room_password_events(
 id uuid primary key,group_id uuid not null references mirpanel_community.netflix_room_groups(id),
 actor text not null,created_at timestamptz not null default now()
);
create table if not exists mirpanel_community.netflix_room_delivery_credentials(
 delivery_id uuid primary key references mirpanel_community.customer_order_deliveries(id),
 suppress_message boolean not null default false
);
create table if not exists mirpanel_community.netflix_room_assignment_history(
 id uuid primary key,room_id uuid not null references mirpanel_community.netflix_room_units(id),
 delivery_id uuid references mirpanel_community.customer_order_deliveries(id),
 actor text not null,ends_on date,created_at timestamptz not null default now()
);
alter table mirpanel_community.netflix_room_password_events enable row level security;
alter table mirpanel_community.netflix_room_delivery_credentials enable row level security;
alter table mirpanel_community.netflix_room_assignment_history enable row level security;
revoke all on mirpanel_community.netflix_room_password_events,mirpanel_community.netflix_room_delivery_credentials,
 mirpanel_community.netflix_room_assignment_history from public,anon,authenticated;
commit;
