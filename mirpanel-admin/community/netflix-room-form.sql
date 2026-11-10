begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
alter table mirpanel_community.netflix_room_units add column if not exists deleted_at timestamptz;
create unique index if not exists netflix_room_active_account_name
 on mirpanel_community.netflix_room_units(account_key,room_key) where deleted_at is null;
alter table mirpanel_community.netflix_room_units drop constraint if exists netflix_room_units_account_key_room_key_key;

create or replace view mirpanel_community.netflix_room_sale_state as
select r.id,r.group_id,r.room_key,
 g.created_by like 'synthetic:%' synthetic,
 coalesce(r.stock_ends_on,g.ends_on)>public.payment_baku_date() unexpired,
 coalesce(p.status='reserved' and p.expires_at>now()
  or p.status='reviewing' and o.status not in ('cancelled','rejected','expired'),false) held,
 r.delivery_id is not null or r.legacy_assignment_id is not null assigned,
 r.availability
from mirpanel_community.netflix_room_units r
join mirpanel_community.netflix_room_groups g on g.id=r.group_id
left join public.payment_reservations p on p.id=r.sale_reservation_id
left join mirpanel_community.shop_lines l on l.reservation_id=p.id
left join public.payment_orders o on o.id=l.order_id
where r.deleted_at is null;
commit;
