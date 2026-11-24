create table if not exists mirpanel_community.fulfillment_holds(
 order_id uuid primary key references public.payment_orders(id),
 reason text not null, actor text not null, created_at timestamptz not null default now(),
 released_at timestamptz
);
alter table mirpanel_community.fulfillment_holds enable row level security;
revoke all on mirpanel_community.fulfillment_holds from public,anon,authenticated;
create or replace function mirpanel_community.guard_held_delivery() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform pg_advisory_xact_lock(714025001);
 if exists(select 1 from mirpanel_community.fulfillment_holds where order_id=new.order_id and released_at is null) then
  raise exception 'FULFILLMENT_ON_HOLD';
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.guard_held_delivery() from public,anon,authenticated;
drop trigger if exists guard_held_delivery on mirpanel_community.customer_order_deliveries;
create trigger guard_held_delivery before insert on mirpanel_community.customer_order_deliveries for each row execute function mirpanel_community.guard_held_delivery();
do $$begin
 if to_regclass('mirpanel_community.api_dispatches') is not null then
  execute 'drop trigger if exists guard_held_delivery on mirpanel_community.api_dispatches';
  execute 'create trigger guard_held_delivery before insert or update on mirpanel_community.api_dispatches for each row execute function mirpanel_community.guard_held_delivery()';
 end if;
end $$;
