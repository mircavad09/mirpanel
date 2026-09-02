-- Advance only the persistent counter. Never renumber an existing order.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- submit_payment_order_v2 updates the counter BEFORE inserting the order.
-- Use the same lock order so in-flight submissions finish before this bump,
-- while later submissions wait and then receive the advanced number.
lock table public.payment_order_number_counter in exclusive mode;
lock table public.payment_orders in share mode;

create temporary table order_counter_advance_guard on commit drop as
select count(*) as row_count,
       md5(string_agg(md5(to_jsonb(o)::text), '' order by id)) as fingerprint
from public.payment_orders o;

do $$
begin
  update public.payment_order_number_counter
     set last_number = greatest(
       last_number::numeric,
       10000::numeric,
       coalesce((select max(order_code::numeric) from public.payment_orders
                 where order_code ~ '^[0-9]+$'), 0)
     )::bigint
   where id = true;
  if not found then raise exception 'ORDER_COUNTER_UNAVAILABLE'; end if;
  if exists (select 1 from public.payment_order_number_counter
              where id = true and last_number = 9223372036854775807) then
    raise exception 'ORDER_COUNTER_EXHAUSTED';
  end if;
  if exists (
    select 1 from order_counter_advance_guard b
    cross join (
      select count(*) as row_count,
             md5(string_agg(md5(to_jsonb(o)::text), '' order by id)) as fingerprint
      from public.payment_orders o
    ) a
    where b.row_count <> a.row_count or b.fingerprint is distinct from a.fingerprint
  ) then raise exception 'EXISTING_ORDER_DATA_CHANGED'; end if;
end;
$$;

commit;
