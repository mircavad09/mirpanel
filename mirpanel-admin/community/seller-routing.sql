create table if not exists mirpanel_community.routing_sellers(
 id uuid primary key, name text not null, email text not null unique,
 user_id text unique references mirpanel_community."user"(id), active boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists mirpanel_community.seller_invitations(
 id uuid primary key, seller_id uuid not null references mirpanel_community.routing_sellers(id),
 token_hash text not null unique, token_cipher text not null, expires_at timestamptz not null,
 accepted_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists mirpanel_community.seller_routes(
 product_id text not null, plan_key text not null, plan_signature text not null,
 enabled boolean not null default false, enabled_at timestamptz not null default now(),
 primary key(product_id,plan_key)
);
create table if not exists mirpanel_community.seller_route_members(
 product_id text not null, plan_key text not null, seller_id uuid not null references mirpanel_community.routing_sellers(id),
 primary key(product_id,plan_key,seller_id), foreign key(product_id,plan_key) references mirpanel_community.seller_routes
);
create table if not exists mirpanel_community.seller_tasks(
 id uuid primary key, order_id uuid not null references public.payment_orders(id),
 line_index integer not null check(line_index>=0), product_id text not null, plan_key text not null,
 title text not null, plan_name text not null, quantity integer not null check(quantity>0),
 state text not null default 'open' check(state in('open','claimed','needs_review','completed','closed')),
 seller_id uuid references mirpanel_community.routing_sellers(id), claim_id uuid,
 claimed_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(),
 unique(order_id,line_index)
);
create table if not exists mirpanel_community.seller_task_audience(
 task_id uuid not null references mirpanel_community.seller_tasks(id), seller_id uuid not null references mirpanel_community.routing_sellers(id),
 passed boolean not null default false, primary key(task_id,seller_id)
);
create table if not exists mirpanel_community.seller_task_audit(
 id bigserial primary key, task_id uuid references mirpanel_community.seller_tasks(id), actor text not null,
 action text not null, reason text, request_id uuid unique, at timestamptz not null default now()
);
create table if not exists mirpanel_community.seller_mail(
 event_key text primary key, seller_id uuid not null references mirpanel_community.routing_sellers(id),
 invitation_id uuid references mirpanel_community.seller_invitations(id), task_id uuid references mirpanel_community.seller_tasks(id),
 state text not null default 'queued' check(state in('queued','sending','accepted','failed','uncertain','cancelled')),
 attempts integer not null default 0, next_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), first_attempt_at timestamptz, uncertain_at timestamptz, provider_id text, reason text
);
create index if not exists seller_tasks_pending on mirpanel_community.seller_tasks(state,created_at);
create index if not exists seller_mail_due on mirpanel_community.seller_mail(next_at) where state='queued';
do $$declare n text;begin foreach n in array array['routing_sellers','seller_invitations','seller_routes','seller_route_members','seller_tasks','seller_task_audience','seller_task_audit','seller_mail'] loop
 execute format('alter table mirpanel_community.%I enable row level security',n);
 execute format('revoke all on mirpanel_community.%I from public,anon,authenticated',n);
end loop;end $$;

-- All fulfillment paths share this authority, including existing workers.
create or replace function mirpanel_community.seller_fulfillment_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare task mirpanel_community.seller_tasks;
begin
 perform pg_advisory_xact_lock(714025001);
 if tg_table_name='customer_order_deliveries' then
  select * into task from mirpanel_community.seller_tasks where order_id=new.order_id and line_index=new.line_index and state in('open','claimed','needs_review');
  if found and ((task.state in('claimed','needs_review') and (task.state<>'claimed' or new.actor<>'seller:'||task.seller_id::text)) or (task.state='open' and new.actor like '%:auto')) then raise exception 'SELLER_FULFILLMENT_OWNED';end if;
 elsif tg_table_name='employee_order_assignments' then
  if exists(select 1 from mirpanel_community.seller_tasks where order_id=new.order_id and state in('open','claimed','needs_review')) then raise exception 'SELLER_FULFILLMENT_OWNED';end if;
 elsif tg_table_name='api_dispatches' then
  if exists(select 1 from mirpanel_community.seller_tasks where order_id=new.order_id and line_index=new.line_index and state in('open','claimed','needs_review')) then raise exception 'SELLER_FULFILLMENT_OWNED';end if;
 elsif tg_table_name='api_mappings' then
  if new.active and exists(select 1 from mirpanel_community.seller_routes where product_id=new.product_id and plan_key=new.plan_key and enabled) then raise exception 'SELLER_ROUTE_ACTIVE';end if;
 elsif tg_table_name='ready_stock_plans' then
  if new.auto_wallet and exists(select 1 from mirpanel_community.seller_routes where product_id=new.product_id and plan_key=new.plan_key and enabled) then raise exception 'SELLER_ROUTE_ACTIVE';end if;
 end if;
 return new;
end $$;
revoke all on function mirpanel_community.seller_fulfillment_guard() from public,anon,authenticated;
do $$declare n text;relation regclass;begin foreach n in array array['customer_order_deliveries','api_dispatches','api_mappings','ready_stock_plans','employee_order_assignments'] loop
 relation=to_regclass(case when n='employee_order_assignments' then 'public.' else 'mirpanel_community.' end||n);
 if relation is not null then
 execute format('drop trigger if exists seller_fulfillment_guard on %s',relation);
 execute format('create trigger seller_fulfillment_guard before insert or update on %s for each row execute function mirpanel_community.seller_fulfillment_guard()',relation);
 end if;
end loop;end $$;

alter table mirpanel_community.seller_invitations add column if not exists revoked_at timestamptz;
alter table mirpanel_community.seller_mail add column if not exists provider_service text;
alter table mirpanel_community.seller_mail add column if not exists created_at timestamptz;
alter table mirpanel_community.seller_mail alter column created_at set default now();
alter table mirpanel_community.seller_mail add column if not exists accepted_at timestamptz;
