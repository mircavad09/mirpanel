begin;
set local lock_timeout='5s';
alter table mirpanel_community.customer_order_deliveries add column if not exists replacement_at timestamptz;
alter table mirpanel_community.customer_read_staff add column if not exists support boolean not null default false;
alter table mirpanel_community.customer_read_staff add column if not exists replacement boolean not null default false;
alter table mirpanel_community.customer_read_staff add column if not exists credentials boolean not null default false;
create table if not exists mirpanel_community.staff_replacement_policies(
 product_id text not null,plan_key text not null,plan_signature text not null,
 enabled boolean not null default false,account_type text not null,
 updated_by text not null,updated_at timestamptz not null default now(),
 primary key(product_id,plan_key,plan_signature));
create table if not exists mirpanel_community.staff_replacements(
 id uuid primary key,delivery_id uuid not null unique references mirpanel_community.customer_order_deliveries(id),
 order_id uuid not null references public.payment_orders(id),user_id text not null references mirpanel_community."user"(id),
 actor_id text not null references mirpanel_community."user"(id),reason text not null,
 state text not null check(state in ('waiting_stock','admin_review','completed')),
 old_unit_id uuid references mirpanel_community.ready_stock_units(id),new_unit_id uuid unique references mirpanel_community.ready_stock_units(id),
 old_cipher text,service_until date,warranty_until date,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 check((state='completed')=(new_unit_id is not null and completed_at is not null)));
create table if not exists mirpanel_community.staff_support_notes(
 id uuid primary key,user_id text not null references mirpanel_community."user"(id),actor_id text not null references mirpanel_community."user"(id),
 body text not null check(length(body) between 3 and 1000),created_at timestamptz not null default clock_timestamp());
create index if not exists staff_replacements_customer on mirpanel_community.staff_replacements(user_id,created_at desc);
alter table mirpanel_community.staff_replacements add column if not exists notice_read_at timestamptz;
alter table mirpanel_community.staff_replacements add column if not exists completed_by text references mirpanel_community."user"(id);
create index if not exists staff_support_notes_customer on mirpanel_community.staff_support_notes(user_id,created_at desc);
alter table mirpanel_community.staff_replacement_policies enable row level security;
alter table mirpanel_community.staff_replacements enable row level security;
alter table mirpanel_community.staff_support_notes enable row level security;
revoke all on mirpanel_community.staff_replacement_policies,mirpanel_community.staff_replacements,mirpanel_community.staff_support_notes from public,anon,authenticated;
commit;
