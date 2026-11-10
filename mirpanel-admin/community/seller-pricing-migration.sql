begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(926110202);
set local search_path=mirpanel_community,public;
create table if not exists user_seller_settings(user_id text primary key references "user"(id),enabled boolean not null,updated_by text references "user"(id),updated_at timestamptz not null default clock_timestamp());
-- Preserve pre-existing special-price accounts during the upgrade.
insert into user_seller_settings(user_id,enabled) select distinct user_id,true from user_special_prices on conflict do nothing;
alter table user_seller_settings enable row level security;
revoke all on user_seller_settings from public,anon,authenticated;
create or replace function reserve_user_price_v1(p_user text,p_method uuid,p_product text,p_plan text,p_key text,p_signature text,p_standard numeric,p_idem uuid,p_checkout uuid,p_previous uuid,p_minutes integer,p_track boolean)
returns jsonb language plpgsql security definer set search_path=mirpanel_community,public,pg_catalog as $$
declare existing public.payment_reservations%rowtype;bound text;price bigint;standard bigint;result jsonb;special boolean:=false;
begin
 if not exists(select 1 from "user" where id=p_user and "emailVerified") then raise exception 'ACCOUNT_REQUIRED';end if;
 if exists(select 1 from community_profiles where user_id=p_user and blocked and (ban_until is null or ban_until>clock_timestamp())) then raise exception 'ACCOUNT_BLOCKED';end if;
 perform pg_advisory_xact_lock(714025001);
 perform pg_advisory_xact_lock(hashtextextended(p_checkout::text,0));
 select * into existing from public.payment_reservations where idempotency_key=p_idem;
 if found then
  select user_id into bound from user_reservation_prices where reservation_id=existing.id;
  if bound is not null and bound<>p_user then raise exception 'PRICING_ACCOUNT_MISMATCH';end if;
  result:=public.inventory_reserve_payment(p_method,p_product,p_plan,existing.amount,'AZN',p_idem,p_checkout,p_previous,p_minutes,p_track);
  return result||jsonb_build_object('amount',existing.amount);
 end if;
 if p_standard<0 or p_standard<>round(p_standard,2) then raise exception 'INVALID_STANDARD_PRICE';end if;
 standard:=round(p_standard*100)::bigint;
 if exists(select 1 from user_controls_release where id and enabled) and exists(select 1 from user_seller_settings where user_id=p_user and enabled) then select cents into price from user_special_prices where user_id=p_user and product_id=p_product and plan_key=p_key and plan_signature=p_signature;end if;
 special:=price is not null;price:=coalesce(price,standard);
 result:=public.inventory_reserve_payment(p_method,p_product,p_plan,price::numeric/100,'AZN',p_idem,p_checkout,p_previous,p_minutes,p_track);
 insert into user_reservation_prices(reservation_id,user_id,standard_cents,effective_cents,rule) values((result->>'id')::uuid,p_user,standard,price,case when special then 'fixed-user-price' else 'standard' end);
 return result||jsonb_build_object('amount',price::numeric/100);
end$$;
revoke all on function reserve_user_price_v1(text,uuid,text,text,text,text,numeric,uuid,uuid,uuid,integer,boolean) from public,anon,authenticated;
commit;
