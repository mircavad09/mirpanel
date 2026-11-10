begin;
set local lock_timeout='5s';
create table if not exists mirpanel_community.netflix_sheet_customer_ids(
 delivery_id uuid primary key references mirpanel_community.customer_order_deliveries(id),
 room_id uuid not null references mirpanel_community.netflix_room_units(id),
 state text not null default 'pending' check(state in ('pending','done','blocked')),
 reason text,
 attempts integer not null default 0,
 next_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists netflix_sheet_customer_ids_due on mirpanel_community.netflix_sheet_customer_ids(next_at) where state='pending';
create index if not exists netflix_sheet_customer_ids_room on mirpanel_community.netflix_sheet_customer_ids(room_id,created_at desc);
alter table mirpanel_community.netflix_sheet_customer_ids enable row level security;
revoke all on mirpanel_community.netflix_sheet_customer_ids from public,anon,authenticated;
create or replace function mirpanel_community.queue_netflix_sheet_customer_id() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.delivery_id is not null and new.delivery_id is distinct from old.delivery_id and exists(
  select 1 from mirpanel_community.customer_order_deliveries d
  join public.payment_orders o on o.id=d.order_id
  where d.id=new.delivery_id and d.actor='wallet:auto' and o.payment_source='wallet' and o.payment_confirmed
 ) then
  insert into mirpanel_community.netflix_sheet_customer_ids(delivery_id,room_id) values(new.delivery_id,new.id)
  on conflict(delivery_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.queue_netflix_sheet_customer_id() from public,anon,authenticated;
drop trigger if exists netflix_sheet_customer_id_queue on mirpanel_community.netflix_room_units;
create trigger netflix_sheet_customer_id_queue after update of delivery_id on mirpanel_community.netflix_room_units
 for each row execute function mirpanel_community.queue_netflix_sheet_customer_id();
commit;
