begin;
set local lock_timeout='5s';
create table if not exists mirpanel_community.netflix_room_legacy (
 id uuid primary key,
 room_id uuid not null unique references mirpanel_community.netflix_room_units(id),
 user_id text not null references mirpanel_community."user"(id),
 paid_until date not null,
 product_title text not null,
 image text not null default '',
 message_cipher text not null,
 actor_id text not null references mirpanel_community."user"(id),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists netflix_room_legacy_user on mirpanel_community.netflix_room_legacy(user_id,created_at desc,id);
alter table mirpanel_community.netflix_room_units add column if not exists legacy_assignment_id uuid unique references mirpanel_community.netflix_room_legacy(id);
alter table mirpanel_community.netflix_room_units drop constraint if exists netflix_room_single_assignment;
alter table mirpanel_community.netflix_room_units add constraint netflix_room_single_assignment check(delivery_id is null or legacy_assignment_id is null);
alter table mirpanel_community.netflix_room_legacy enable row level security;
revoke all on mirpanel_community.netflix_room_legacy from public,anon,authenticated;
commit;
