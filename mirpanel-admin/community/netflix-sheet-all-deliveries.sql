begin;
set local lock_timeout='5s';
alter table mirpanel_community.netflix_sheet_customer_ids alter column room_id drop not null;
create index if not exists netflix_sheet_customer_ids_unbound
 on mirpanel_community.netflix_sheet_customer_ids(created_at desc) where room_id is null and state<>'done';
create or replace function mirpanel_community.queue_netflix_sheet_customer_id() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.delivery_id is not null and new.delivery_id is distinct from old.delivery_id and exists(
  select 1 from mirpanel_community.customer_order_deliveries d
  join public.payment_orders o on o.id=d.order_id
  where d.id=new.delivery_id and (o.payment_confirmed or o.status in ('approved','completed'))
   and o.status not in ('cancelled','rejected','expired')
 ) then
  insert into mirpanel_community.netflix_sheet_customer_ids(delivery_id,room_id) values(new.delivery_id,new.id)
  on conflict(delivery_id) do nothing;
 end if;
 return new;
end $$;
commit;
