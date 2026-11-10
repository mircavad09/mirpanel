begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025001);
alter table mirpanel_community.netflix_room_units
 add column if not exists sale_reservation_id uuid unique references public.payment_reservations(id);

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
where to_jsonb(r)->>'deleted_at' is null;

create or replace view mirpanel_community.netflix_room_sellable as
select id,group_id,room_key from mirpanel_community.netflix_room_sale_state
where not synthetic and unexpired and not held and not assigned and availability='available';
revoke all on mirpanel_community.netflix_room_sale_state,mirpanel_community.netflix_room_sellable from public,anon,authenticated;

-- Keep the existing ledger and admin pause policy for every other product.
do $$begin
 if to_regprocedure('public.inventory_snapshot_before_netflix_rooms()') is null then
  alter function public.inventory_snapshot() rename to inventory_snapshot_before_netflix_rooms;
 end if;
 if to_regprocedure('public.inventory_is_tracked_before_netflix_rooms(text,text)') is null then
  alter function public.inventory_is_tracked(text,text) rename to inventory_is_tracked_before_netflix_rooms;
 end if;
end$$;
create or replace function public.inventory_snapshot() returns jsonb language sql stable security definer
set search_path=pg_catalog,public as $$
 with base as (select public.inventory_snapshot_before_netflix_rooms() as entries)
 select coalesce((select jsonb_agg(x) from jsonb_array_elements(entries) x where x->>'productId'<>'netflix'),'[]'::jsonb)
 || jsonb_build_array(coalesce((select x from jsonb_array_elements(entries) x where x->>'productId'='netflix' limit 1),'{}'::jsonb)
 || jsonb_build_object('productId','netflix','scope','product','unlimited',false,'plans','[]'::jsonb,
 'available',(select count(*) from mirpanel_community.netflix_room_sellable))) from base;
$$;
create or replace function public.inventory_is_tracked(p_product text,p_key text) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select case when p_product='netflix' then false else public.inventory_is_tracked_before_netflix_rooms(p_product,p_key) end;
$$;
revoke all on function public.inventory_snapshot(),public.inventory_is_tracked(text,text),
 public.inventory_snapshot_before_netflix_rooms(),public.inventory_is_tracked_before_netflix_rooms(text,text) from public,anon,authenticated;
grant execute on function public.inventory_snapshot() to service_role;
revoke execute on function public.inventory_snapshot_before_netflix_rooms() from service_role;
create or replace function mirpanel_community.require_netflix_room_checkout() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if new.product_id='netflix' and (not coalesce(new.capacity_shadow,false)
   or current_setting('mirpanel.netflix_room_checkout',true) is distinct from 'true') then
  raise exception 'NETFLIX_ROOM_CHECKOUT_REQUIRED';
 end if;
 return new;
end$$;
drop trigger if exists netflix_room_checkout_guard on public.payment_reservations;
create trigger netflix_room_checkout_guard before insert on public.payment_reservations
for each row execute function mirpanel_community.require_netflix_room_checkout();
notify pgrst,'reload schema';
commit;
