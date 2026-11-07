begin;
create table if not exists mirpanel_community.ready_stock_release (
  id boolean primary key default true check (id),
  enabled boolean not null default true
);
insert into mirpanel_community.ready_stock_release(id) values(true) on conflict do nothing;
create table if not exists mirpanel_community.ready_stock_plans (
  product_id text not null,
  plan_key text not null,
  plan_signature text not null,
  auto_wallet boolean not null default false,
  primary key(product_id,plan_key,plan_signature)
);
create table if not exists mirpanel_community.ready_stock_batches (
  id uuid primary key,
  fingerprint text not null,
  actor text not null,
  units integer not null check (units between 0 and 20),
  created_at timestamptz not null default now()
);
create table if not exists mirpanel_community.ready_stock_units (
  id uuid primary key,
  product_id text not null,
  plan_key text not null,
  plan_signature text not null,
  batch_id uuid not null references mirpanel_community.ready_stock_batches(id),
  message_cipher text not null,
  delivery_id uuid unique references mirpanel_community.customer_order_deliveries(id),
  created_at timestamptz not null default now(),
  foreign key (product_id,plan_key,plan_signature) references mirpanel_community.ready_stock_plans
);
create index if not exists ready_stock_free on mirpanel_community.ready_stock_units(product_id,plan_key,plan_signature,created_at,id) where delivery_id is null;
revoke all on mirpanel_community.ready_stock_release,mirpanel_community.ready_stock_plans,mirpanel_community.ready_stock_batches,mirpanel_community.ready_stock_units from public,anon,authenticated;
alter table mirpanel_community.ready_stock_release enable row level security;
alter table mirpanel_community.ready_stock_plans enable row level security;
alter table mirpanel_community.ready_stock_batches enable row level security;
alter table mirpanel_community.ready_stock_units enable row level security;
commit;
