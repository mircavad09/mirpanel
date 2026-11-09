create table mirpanel_community.api_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  key_cipher text not null,
  test_path text not null
);

create table mirpanel_community.api_mappings (
  product_id text not null,
  plan_key text not null,
  supplier_id uuid not null references mirpanel_community.api_suppliers,
  settings jsonb not null,
  active boolean not null,
  primary key(product_id, plan_key)
);

create table mirpanel_community.api_dispatches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id),
  line_index integer not null,
  supplier_id uuid not null references mirpanel_community.api_suppliers,
  settings jsonb not null,
  state text not null default 'queued',
  external_id text,
  next_at timestamptz not null default now(),
  unique(order_id, line_index)
);
create index api_dispatch_due on mirpanel_community.api_dispatches(next_at)
  where state in ('queued','checking');
alter table mirpanel_community.api_suppliers enable row level security;
alter table mirpanel_community.api_mappings enable row level security;
alter table mirpanel_community.api_dispatches enable row level security;
revoke all on mirpanel_community.api_suppliers, mirpanel_community.api_mappings,
  mirpanel_community.api_dispatches from public, anon, authenticated;

create function mirpanel_community.enqueue_api_dispatches() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.status in ('rejected','cancelled','expired')
      or not (new.payment_confirmed is true or new.status in ('approved','completed')) then
    return new;
  end if;
  if tg_op = 'UPDATE' and (old.payment_confirmed is true or old.status in ('approved','completed')) then
    return new;
  end if;
  if new.checkout_snapshot->>'cartVersion' = '2'
      and jsonb_typeof(new.checkout_snapshot->'items') = 'array' then
    insert into mirpanel_community.api_dispatches(order_id,line_index,supplier_id,settings)
    select new.id, (l.ordinality-1)::integer, m.supplier_id, m.settings
    from jsonb_array_elements(new.checkout_snapshot->'items') with ordinality l(item,ordinality)
    join mirpanel_community.api_mappings m
      on m.product_id=l.item->>'productId' and m.plan_key=l.item->>'sourcePlanKey'
    where m.active and not (l.item ? 'renewalOrderCode')
    on conflict (order_id,line_index) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function mirpanel_community.enqueue_api_dispatches() from public;
create trigger enqueue_api_dispatches after insert or update of status,payment_confirmed
  on public.payment_orders for each row execute function mirpanel_community.enqueue_api_dispatches();
