begin;
set local lock_timeout='5s';
alter table mirpanel_community.netflix_room_units add column if not exists stock_ends_on date;
commit;
