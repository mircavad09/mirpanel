begin;

create table if not exists public.product_sale_overrides (
  product_id text primary key,
  sale_paused boolean not null
);
alter table public.product_sale_overrides enable row level security;
revoke all on public.product_sale_overrides from public, anon, authenticated;

create or replace function public.inventory_set_sale_paused(p_product text, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_product is null or p_product !~ '^[a-zA-Z0-9_-]{1,160}$' or p_paused is null then
    raise exception 'INVALID_INVENTORY';
  end if;
  perform pg_advisory_xact_lock(714025001);
  insert into product_sale_overrides(product_id, sale_paused) values (p_product, p_paused)
  on conflict (product_id) do update set sale_paused = excluded.sale_paused;
end;
$$;
revoke all on function public.inventory_set_sale_paused(text, boolean) from public, anon, authenticated;
grant execute on function public.inventory_set_sale_paused(text, boolean) to service_role;

create or replace function public.inventory_snapshot()
returns jsonb language sql stable security definer set search_path = public as $$
with tracked as (
  select product_id, scope, version, unlimited from product_inventory_policies
  union
  select distinct p.product_id, 'plan', 0, false from employee_catalog_plans p
  where inventory_tracked and not exists (select 1 from product_inventory_policies x where x.product_id = p.product_id)
)
select coalesce(jsonb_agg(jsonb_build_object(
  'productId', coalesce(p.product_id, s.product_id), 'scope', coalesce(p.scope, 'none'),
  'version', coalesce(p.version, 0), 'unlimited', coalesce(p.unlimited, false), 'salePaused', s.sale_paused,
  'available', case when p.scope = 'product' and not p.unlimited then
    (select count(*) from employee_stock_units u where u.product_id = p.product_id and u.plan_id is null and u.state = 'AVAILABLE')
  end,
  'plans', case when p.scope = 'plan' then (
    select coalesce(jsonb_agg(jsonb_build_object(
      'planKey', c.source_plan_key, 'tracked', c.inventory_tracked,
      'available', case when c.inventory_tracked then
        (select count(*) from employee_stock_units u where u.plan_id = c.id and u.state = 'AVAILABLE')
      end
    )), '[]'::jsonb) from employee_catalog_plans c where c.product_id = p.product_id
  ) else '[]'::jsonb end
)), '[]'::jsonb)
from tracked p full join product_sale_overrides s using (product_id);
$$;

create or replace function public.inventory_guard_sale()
returns trigger language plpgsql security definer set search_path = public as $$
declare products text[] := array[new.product_id];
begin
  if tg_table_name = 'payment_orders' then
    if new.product_id = '__cart__' and jsonb_typeof(new.checkout_snapshot->'items') = 'array' then
      products := array(select item->>'productId' from jsonb_array_elements(new.checkout_snapshot->'items') as item);
    end if;
  end if;

  -- Share the checkout lock so a pause and an order cannot pass one another.
  perform pg_advisory_xact_lock(714025001);
  if exists (select 1 from product_sale_overrides where product_id = any(products) and sale_paused) then
    raise exception 'PRODUCT_SALE_PAUSED';
  end if;
  return new;
end;
$$;
revoke all on function public.inventory_guard_sale() from public, anon, authenticated;
drop trigger if exists inventory_guard_sale on public.payment_reservations;
create trigger inventory_guard_sale before insert on public.payment_reservations
for each row execute function public.inventory_guard_sale();
drop trigger if exists inventory_guard_sale on public.payment_orders;
create trigger inventory_guard_sale before insert on public.payment_orders
for each row execute function public.inventory_guard_sale();

commit;
