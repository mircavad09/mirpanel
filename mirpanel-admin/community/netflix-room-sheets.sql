begin;
set local lock_timeout='5s';
create table if not exists mirpanel_community.netflix_room_sheet_sync (
 room_id uuid primary key references mirpanel_community.netflix_room_units(id) on delete cascade,
 target text not null,
 sent jsonb,
 retry_at timestamptz not null default '-infinity',
 failures int not null default 0
);
alter table mirpanel_community.netflix_room_sheet_sync enable row level security;
revoke all on mirpanel_community.netflix_room_sheet_sync from public,anon,authenticated;
commit;
