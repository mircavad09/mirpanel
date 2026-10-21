-- Full reviewed release: backup + reporting + panel. Run as database owner in Supabase SQL Editor.
-- Does not create employees, stock, payroll, orders or historical allocations.
begin isolation level repeatable read;
DO $preflight$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='approve_payment_order_v7' AND pronargs=3)
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='submit_payment_order_v2' AND pronargs=12)
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='reject_payment_order' AND pronargs=3)
 THEN RAISE EXCEPTION 'EMPLOYEE_LEGACY_PAYMENT_PREREQUISITES_MISSING'; END IF;
END $preflight$;
-- Run before DDL, in a REPEATABLE READ transaction. No live business row is edited.
-- Freeze a private, idempotent backup; never overwrite an existing snapshot.
create schema if not exists employee_pre_release_20261021;
revoke all on schema employee_pre_release_20261021 from public,anon,authenticated,service_role;
create table if not exists employee_pre_release_20261021.manifest(
 table_name text primary key,rows_copied bigint not null,fingerprint text not null,backed_up_at timestamptz not null default now());
do $$ declare t text;n bigint;h text;source_n bigint;source_h text;
begin
 foreach t in array array['payment_orders','payment_reservations','capcut_accounts','capcut_deliveries','netflix_accounts',
 'employee_accounts','employee_reporting_periods','employee_order_assignments','employee_order_bonus_events',
 'employee_salary_settings','employee_payroll_paid','employee_stock_units','employee_work_audit',
 'employee_reporting_audit','employee_catalog_plans','employee_requests'] loop
  if to_regclass('public.'||t) is not null then
   if to_regclass('employee_pre_release_20261021.'||t) is null then
    execute format('create table employee_pre_release_20261021.%I as table public.%I',t,t);
    execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from public.%I x',t) into source_n,source_h;
    execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from employee_pre_release_20261021.%I x',t) into n,h;
    if n<>source_n or h<>source_h then raise exception 'EMPLOYEE_BACKUP_VERIFICATION_FAILED';end if;
    insert into employee_pre_release_20261021.manifest(table_name,rows_copied,fingerprint) values(t,n,h);
   else
    execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from employee_pre_release_20261021.%I x',t) into n,h;
    if not exists(select 1 from employee_pre_release_20261021.manifest m where m.table_name=t and m.rows_copied=n and m.fingerprint=h) then raise exception 'EMPLOYEE_BACKUP_MANIFEST_MISMATCH';end if;
   end if;
   execute format('revoke all on employee_pre_release_20261021.%I from public,anon,authenticated,service_role',t);
  end if;
 end loop;
end $$;
revoke all on employee_pre_release_20261021.manifest from public,anon,authenticated,service_role;

-- Foundation only. No accounts, legacy assignments, stock, wages or fake orders are seeded.

create table if not exists public.employee_accounts (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'employee' check(role='employee'),
  login text not null unique,
  display_name text not null,
  password_hash text not null,
  active boolean not null default false,
  employee_started_at timestamptz,
  current_period_id uuid,
  session_version integer not null default 1 check(session_version>0),
  created_at timestamptz not null default now(),
  check((employee_started_at is null)=(current_period_id is null))
);
create table if not exists public.employee_reporting_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_accounts(id) on delete restrict,
  employee_started_at timestamptz not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique(employee_id,id)
);
create table if not exists public.employee_order_assignments (
  order_id uuid primary key references public.payment_orders(id) on delete restrict,
  employee_id uuid not null references public.employee_accounts(id) on delete restrict,
  period_id uuid not null,
  quantity integer not null check(quantity>0),
  state text not null default 'NEW' check(state in
    ('NEW','EMPLOYEE_ACCEPTED','STOCK_RESERVED','DELIVERED_PENDING_ADMIN','RETURNED_TO_EMPLOYEE','COMPLETED','CANCELLED')),
  payment_verified_at timestamptz not null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  submitted_at timestamptz,
  admin_completed_at timestamptz,
  foreign key(employee_id,period_id) references public.employee_reporting_periods(employee_id,id) on delete restrict,
  check(state<>'COMPLETED' or (accepted_at is not null and admin_completed_at is not null))
);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.employee_accounts'::regclass and conname='employee_current_period_fk') then
    alter table public.employee_accounts add constraint employee_current_period_fk
      foreign key(id,current_period_id) references public.employee_reporting_periods(employee_id,id) on delete restrict;
  end if;
end $$;
create table if not exists public.employee_order_bonus_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.employee_order_assignments(order_id) on delete restrict,
  employee_id uuid not null references public.employee_accounts(id) on delete restrict,
  period_id uuid not null,
  amount_cents integer not null check(amount_cents>=0),
  approved_by text not null,
  created_at timestamptz not null default now(),
  foreign key(employee_id,period_id) references public.employee_reporting_periods(employee_id,id) on delete restrict
);
create table if not exists public.employee_reporting_audit (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_accounts(id) on delete restrict,
  period_id uuid not null references public.employee_reporting_periods(id) on delete restrict,
  action text not null check(action in ('reporting.started','reporting.period_changed')),
  actor_ref text not null,
  created_at timestamptz not null default now()
);
create index if not exists employee_assignments_period_idx on public.employee_order_assignments(employee_id,period_id,accepted_at);

-- Only the authenticated ADMIN server endpoint may invoke this service-role RPC.
-- No client timestamp parameter exists. A retry cannot restart the reporting period.
create or replace function public.employee_start_reporting(p_employee_id uuid,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.employee_accounts%rowtype; v_period uuid; v_start timestamptz;
begin
  if nullif(trim(p_actor),'') is null then raise exception 'ADMIN_ACTOR_REQUIRED'; end if;
  select * into v from public.employee_accounts where id=p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v.employee_started_at is not null then
    return jsonb_build_object('employeeStartedAt',v.employee_started_at,'periodId',v.current_period_id,'idempotent',true);
  end if;
  v_start:=clock_timestamp();
  insert into public.employee_reporting_periods(employee_id,employee_started_at,created_by)
    values(v.id,v_start,left(p_actor,120)) returning id into v_period;
  update public.employee_accounts set employee_started_at=v_start,current_period_id=v_period,active=true,
    session_version=session_version+1 where id=v.id;
  insert into public.employee_reporting_audit(employee_id,period_id,action,actor_ref)
    values(v.id,v_period,'reporting.started',left(p_actor,120));
  return jsonb_build_object('employeeStartedAt',v_start,'periodId',v_period,'idempotent',false);
end; $$;

-- Defense in depth: a ledger write cannot grant a bonus for an old/unconfirmed order.
create or replace function public.employee_validate_bonus() returns trigger
language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.employee_accounts e
    join public.employee_order_assignments a on a.employee_id=e.id
    join public.payment_orders o on o.id=a.order_id
    where a.order_id=new.order_id and e.id=new.employee_id and a.period_id=new.period_id
      and e.current_period_id=new.period_id and e.employee_started_at is not null
      and o.created_at>=e.employee_started_at and a.assigned_at>=e.employee_started_at
      and a.accepted_at>=e.employee_started_at and a.payment_verified_at>=e.employee_started_at
      and a.state='COMPLETED' and a.admin_completed_at>=e.employee_started_at
      and o.status in ('approved','completed')) then raise exception 'EMPLOYEE_BONUS_NOT_ELIGIBLE'; end if;
  return new;
end; $$;
drop trigger if exists employee_bonus_eligibility on public.employee_order_bonus_events;
create trigger employee_bonus_eligibility before insert or update on public.employee_order_bonus_events
  for each row execute function public.employee_validate_bonus();

create or replace function public.employee_reporting_snapshot(p_employee_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
with employee as (select * from public.employee_accounts where id=p_employee_id),
eligible as (
  select a.* from public.employee_order_assignments a
  join employee e on e.id=a.employee_id and e.current_period_id=a.period_id
  join public.payment_orders o on o.id=a.order_id
  where e.employee_started_at is not null and o.created_at>=e.employee_started_at
    and a.assigned_at>=e.employee_started_at and a.payment_verified_at>=e.employee_started_at
), accepted as (
  select a.* from eligible a join employee e on true where a.accepted_at>=e.employee_started_at
), completed as (
  select a.* from accepted a join employee e on true join public.payment_orders o on o.id=a.order_id
  where a.state='COMPLETED' and a.admin_completed_at>=e.employee_started_at and o.status in ('approved','completed')
), bonuses as (
  select b.* from public.employee_order_bonus_events b join completed c on c.order_id=b.order_id
    and c.employee_id=b.employee_id and c.period_id=b.period_id
)
select jsonb_build_object(
  'employeeStartedAt',(select employee_started_at from employee),
  'newOrders',(select count(*) from eligible where state='NEW'),
  'totalOrders',(select count(*) from accepted),
  'totalQuantity',(select coalesce(sum(quantity),0) from accepted),
  'pendingAdmin',(select count(*) from accepted where state='DELIVERED_PENDING_ADMIN'),
  'approvedOrders',(select count(*) from completed),
  'completedToday',(select count(*) from completed where (admin_completed_at at time zone 'Asia/Baku')::date=(now() at time zone 'Asia/Baku')::date),
  'orderBonusCents',(select coalesce(sum(amount_cents),0) from bonuses),
  'calculatedEarningsCents',(select coalesce(sum(amount_cents),0) from bonuses)
); $$;

alter table public.employee_accounts enable row level security;
alter table public.employee_reporting_periods enable row level security;
alter table public.employee_order_assignments enable row level security;
alter table public.employee_order_bonus_events enable row level security;
alter table public.employee_reporting_audit enable row level security;
revoke all on public.employee_accounts,public.employee_reporting_periods,public.employee_order_assignments,
  public.employee_order_bonus_events,public.employee_reporting_audit from public,anon,authenticated;
grant select,insert,update on public.employee_accounts,public.employee_reporting_periods,public.employee_order_assignments,
  public.employee_order_bonus_events to service_role;
revoke all on public.employee_reporting_audit from service_role;
grant select,insert on public.employee_reporting_audit to service_role;
revoke all on function public.employee_start_reporting(uuid,text),public.employee_reporting_snapshot(uuid),public.employee_validate_bonus() from public,anon,authenticated;
grant execute on function public.employee_start_reporting(uuid,text),public.employee_reporting_snapshot(uuid) to service_role;

-- Additive: do not backfill customers, rewrite old orders, or seed production employees/stock.
alter table public.payment_orders add column if not exists customer_name text,
 add column if not exists customer_phone text, add column if not exists quantity integer,
 add column if not exists canonical_plan_id uuid, add column if not exists checkout_snapshot jsonb,
 add column if not exists payment_verified_at timestamptz, add column if not exists payment_verified_by text,
 add column if not exists cost_price_snapshot numeric, add column if not exists profit_snapshot numeric,
 add column if not exists profit_margin_snapshot numeric;
create table if not exists public.employee_catalog_plans(
 id uuid primary key default gen_random_uuid(),product_id text not null,source_plan_key text not null,
 signature text not null,label text not null,inventory_tracked boolean not null default false,
 low_stock integer not null default 3 check(low_stock>=0),message_template text not null default '',
 unique(product_id,source_plan_key),unique(product_id,id));
create table if not exists public.employee_stock_units(
 id uuid primary key,product_id text not null,plan_id uuid not null references public.employee_catalog_plans(id),
 secret_cipher text not null,fingerprint text not null,note text not null default '',
 state text not null default 'AVAILABLE' check(state in ('AVAILABLE','RESERVED','DELIVERY_PENDING','DELIVERED','INVALID','DISABLED')),
 reserved_order_id uuid references public.payment_orders(id),delivered_order_id uuid references public.payment_orders(id),
 employee_id uuid references public.employee_accounts(id),revealed_at timestamptz,delivered_at timestamptz,admin_approved_at timestamptz,
 version integer not null default 1,created_at timestamptz not null default now(),unique(product_id,plan_id,fingerprint),
 foreign key(product_id,plan_id) references public.employee_catalog_plans(product_id,id),
 check(state<>'AVAILABLE' or (reserved_order_id is null and delivered_order_id is null)),
 check(state not in ('RESERVED','DELIVERY_PENDING') or (reserved_order_id is not null and employee_id is not null)),
 check(state<>'DELIVERED' or (delivered_order_id=reserved_order_id and delivered_order_id is not null and admin_approved_at is not null)));
create index if not exists employee_stock_available_idx on public.employee_stock_units(product_id,plan_id,created_at,id) where state='AVAILABLE';
create index if not exists employee_stock_order_idx on public.employee_stock_units(reserved_order_id);
alter table public.employee_order_assignments add column if not exists returned_count integer not null default 0,
 add column if not exists return_note text not null default '',add column if not exists sent_at timestamptz;
create table if not exists public.employee_work_audit(
 id uuid primary key default gen_random_uuid(),actor_role text not null check(actor_role in ('admin','employee')),
 actor_ref text not null,action text not null,order_id uuid,stock_ids uuid[],created_at timestamptz not null default now());
create table if not exists public.employee_requests(
 actor_ref text not null,request_key uuid not null,payload jsonb not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_ref,request_key));
create table if not exists public.employee_salary_settings(
 employee_id uuid primary key references public.employee_accounts(id),salary_cents integer not null default 50000 check(salary_cents>=0),
 rate_cents integer not null default 35 check(rate_cents>=0),quality_cents integer not null default 5000 check(quality_cents>=0));
create table if not exists public.employee_payroll_paid(
 employee_id uuid not null references public.employee_accounts(id),month date not null,amount_cents bigint not null check(amount_cents>=0),
 paid_by text not null,paid_at timestamptz not null default now(),primary key(employee_id,month));

create or replace function public.employee_plan_resolve(p_product text,p_key text,p_signature text,p_label text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v employee_catalog_plans%rowtype;
begin
 insert into employee_catalog_plans(product_id,source_plan_key,signature,label) values(p_product,p_key,p_signature,p_label)
 on conflict(product_id,source_plan_key) do nothing;
 select * into v from employee_catalog_plans where product_id=p_product and source_plan_key=p_key for update;
 if v.signature<>p_signature then raise exception 'PLAN_MAPPING_REVIEW_REQUIRED'; end if;
 return v.id;
end; $$;

-- The existing reserve/submit/approve functions remain the authority for card capacity and receipts.
create or replace function public.employee_submit_checkout(p_args jsonb,p_customer jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; o payment_orders%rowtype; r payment_reservations%rowtype; q integer; pid uuid;
begin
 perform pg_advisory_xact_lock(714025001);
 q:=(p_customer->>'quantity')::integer;
 if q is null or q<1 or q>100 or coalesce(length(trim(p_customer->>'name')),0) not between 2 and 120
 or coalesce(p_customer->>'phone','')!~'^[1-9][0-9]{7,14}$' or p_customer->>'unitPrice' is null
 or (p_customer->>'unitPrice')::numeric<0 then raise exception 'CUSTOMER_DETAILS_REQUIRED'; end if;
 select * into r from payment_reservations where id=(p_args->>'p_reservation_id')::uuid for update;
 if not found or r.amount<>round((p_customer->>'unitPrice')::numeric*q,2) then raise exception 'CHECKOUT_AMOUNT_MISMATCH'; end if;
 pid:=employee_plan_resolve(p_args->>'p_product_id',coalesce(p_customer->>'sourcePlanKey',p_args->>'p_plan_id'),p_customer->>'signature',p_args->>'p_plan_name');
 v:=submit_payment_order_v2((p_args->>'p_reservation_id')::uuid,(p_args->>'p_checkout_key')::uuid,
 p_args->>'p_product_id',p_args->>'p_plan_id',p_args->>'p_product_title',p_args->>'p_plan_name',p_args->>'p_receipt_bucket',
 p_args->>'p_receipt_path',p_args->>'p_receipt_mime',(p_args->>'p_receipt_size')::integer,p_args->>'p_receipt_sha256',(p_args->>'p_duration_months')::integer);
 select * into o from payment_orders where id=(v->>'id')::uuid for update;
 if o.customer_name is not null then
  if o.customer_name<>trim(p_customer->>'name') or o.customer_phone<>p_customer->>'phone' or o.quantity<>q then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 else
  update payment_orders set customer_name=trim(p_customer->>'name'),customer_phone=p_customer->>'phone',quantity=q,canonical_plan_id=pid,
   checkout_snapshot=jsonb_build_object('productId',o.product_id,'planId',pid,'productName',o.product_title,'planName',o.plan_name,
   'unitPrice',(p_customer->>'unitPrice')::numeric,'quantity',q,'amount',o.amount) where id=o.id;
 end if;
 return v;
end; $$;

create or replace function public.employee_add_stock(p_product text,p_plan uuid,p_items jsonb,p_actor text,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved employee_requests%rowtype; payload jsonb; result jsonb; it jsonb;
begin
 payload:=jsonb_build_object('product',p_product,'plan',p_plan,'items',(select jsonb_agg(value-'cipher') from jsonb_array_elements(p_items)));
 perform pg_advisory_xact_lock(hashtextextended(p_actor||p_key::text,0));
 select * into saved from employee_requests where actor_ref=p_actor and request_key=p_key;
 if found then if saved.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;return saved.result;end if;
 if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'INVALID_STOCK_BATCH'; end if;
 if not exists(select 1 from employee_catalog_plans where id=p_plan and product_id=p_product) then raise exception 'PLAN_MISMATCH';end if;
 for it in select * from jsonb_array_elements(p_items) loop
  insert into employee_stock_units(id,product_id,plan_id,secret_cipher,fingerprint,note) values((it->>'id')::uuid,p_product,p_plan,it->>'cipher',it->>'fingerprint',coalesce(it->>'note',''));
 end loop;
 update employee_catalog_plans set inventory_tracked=true where id=p_plan;
 result:=jsonb_build_object('added',jsonb_array_length(p_items));
 -- Do not persist encrypted/plaintext stock payloads in idempotency/audit metadata.
 insert into employee_requests values(p_actor,p_key,payload,result,now());
 insert into employee_work_audit(actor_role,actor_ref,action) values('admin',p_actor,'stock.added');
 return result;
end; $$;

create or replace function public.employee_order_action(p_order uuid,p_action text,p_role text,p_actor text,p_employee uuid,p_key uuid,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a employee_order_assignments%rowtype; e employee_accounts%rowtype;o payment_orders%rowtype;
 ids uuid[];n integer;bonus integer;v jsonb;payload jsonb:=jsonb_build_object('order',p_order,'action',p_action,'quantity',p_quantity,'employee',p_employee);saved employee_requests%rowtype;
begin
 if p_role is null or p_role not in ('admin','employee') or p_key is null then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor||p_key::text,0));
 select * into saved from employee_requests where actor_ref=p_actor and request_key=p_key;
 if found then if saved.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 -- Same lock order as the legacy approval function; no counter/order deadlock.
 perform pg_advisory_xact_lock(714025001);
 select * into o from payment_orders where id=p_order for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 select * into a from employee_order_assignments where order_id=p_order for update;
 if p_action='verify' then
  if p_role<>'admin' then raise exception 'FORBIDDEN';end if;
  if o.status not in ('reviewing','new_receipt_requested') or coalesce(length(trim(o.customer_name)),0)<2 or coalesce(o.customer_phone,'')!~'^[1-9][0-9]{7,14}$' or o.quantity is null or o.quantity<1 or o.canonical_plan_id is null then raise exception 'ORDER_NOT_READY';end if;
  update payment_orders set payment_verified_at=coalesce(payment_verified_at,clock_timestamp()),payment_verified_by=coalesce(payment_verified_by,p_actor) where id=o.id;
 elsif p_action='accept' then
  if p_role<>'employee' then raise exception 'FORBIDDEN';end if;
  select * into e from employee_accounts where id=p_employee for update;
  if not found or not e.active or e.employee_started_at is null or o.created_at<e.employee_started_at or o.payment_verified_at is null
   or o.status not in ('reviewing','new_receipt_requested') or (a.order_id is not null and a.employee_id<>e.id) then raise exception 'ORDER_NOT_READY';end if;
  if a.order_id is not null then raise exception 'ORDER_ALREADY_ASSIGNED';end if;
  if (select count(*) from employee_stock_units where plan_id=o.canonical_plan_id and state='AVAILABLE')<o.quantity then raise exception 'ORDER_NOT_READY';end if;
  if a.order_id is null then
   insert into employee_order_assignments(order_id,employee_id,period_id,quantity,state,payment_verified_at,assigned_at,accepted_at)
   values(o.id,e.id,e.current_period_id,o.quantity,'EMPLOYEE_ACCEPTED',o.payment_verified_at,clock_timestamp(),clock_timestamp());
  end if;
 else
  if a.order_id is null then raise exception 'ORDER_NOT_ASSIGNED';end if;
  if p_role='employee' then
   select * into e from employee_accounts where id=p_employee;
   if not e.active or e.employee_started_at is null or a.employee_id<>e.id or a.period_id<>e.current_period_id or o.created_at<e.employee_started_at then raise exception 'FORBIDDEN';end if;
  end if;
  if a.state in ('COMPLETED','CANCELLED') then raise exception 'ORDER_FINALIZED';end if;
  if p_action='reserve' then
   if p_role<>'employee' or a.state not in ('EMPLOYEE_ACCEPTED','STOCK_RESERVED','RETURNED_TO_EMPLOYEE') then raise exception 'FORBIDDEN';end if;
   select count(*) into n from employee_stock_units where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
   if p_quantity is null or p_quantity<1 or n+p_quantity>a.quantity then raise exception 'INVALID_QUANTITY';end if;
   select array_agg(id) into ids from (select id from employee_stock_units where product_id=o.product_id and plan_id=o.canonical_plan_id and state='AVAILABLE' order by created_at,id for update skip locked limit p_quantity) s;
   if coalesce(cardinality(ids),0)<>p_quantity then raise exception 'STOCK_EMPTY';end if;
   update employee_stock_units set state='RESERVED',reserved_order_id=o.id,employee_id=a.employee_id,version=version+1 where id=any(ids);
   update employee_order_assignments set state='STOCK_RESERVED' where order_id=o.id;
  elsif p_action in ('preview','whatsapp','sent','submit') then
   if p_role<>'employee' or a.state not in ('STOCK_RESERVED','RETURNED_TO_EMPLOYEE') then raise exception 'FORBIDDEN';end if;
   select count(*) into n from employee_stock_units where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
   if n<>a.quantity then raise exception 'STOCK_QUANTITY_INCOMPLETE';end if;
   if p_action in ('preview','whatsapp') then update employee_stock_units set revealed_at=coalesce(revealed_at,clock_timestamp()) where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
   elsif p_action='sent' then
    update employee_stock_units set state='DELIVERY_PENDING',delivered_at=clock_timestamp() where reserved_order_id=o.id and state='RESERVED';
    update employee_order_assignments set sent_at=clock_timestamp() where order_id=o.id;
   elsif p_action='submit' then
    if a.sent_at is null then raise exception 'DELIVERY_CONFIRMATION_REQUIRED';end if;
    update employee_order_assignments set state='DELIVERED_PENDING_ADMIN',submitted_at=clock_timestamp() where order_id=o.id;
   end if;
  elsif p_action='return' then
   if p_role<>'admin' or a.state<>'DELIVERED_PENDING_ADMIN' then raise exception 'FORBIDDEN';end if;
   update employee_order_assignments set state='RETURNED_TO_EMPLOYEE',returned_count=returned_count+1,sent_at=null where order_id=o.id;
  elsif p_action='complete' then
   if p_role<>'admin' or a.state<>'DELIVERED_PENDING_ADMIN' then raise exception 'FORBIDDEN';end if;
   select count(*) into n from employee_stock_units where reserved_order_id=o.id and state='DELIVERY_PENDING';
   if n<>a.quantity then raise exception 'STOCK_QUANTITY_INCOMPLETE';end if;
   -- The existing card limit/date/receipt/statistics implementation remains authoritative.
   perform set_config('mirpanel.employee_completion',o.id::text,true);
   v:=employee_approve_direct(o.id,o.duration_months,p_actor);
   update employee_order_assignments set state='COMPLETED',admin_completed_at=clock_timestamp() where order_id=o.id;
   update employee_stock_units set state='DELIVERED',delivered_order_id=o.id,admin_approved_at=clock_timestamp(),version=version+1 where reserved_order_id=o.id and state='DELIVERY_PENDING';
   select rate_cents into bonus from employee_salary_settings where employee_id=a.employee_id;
   insert into employee_order_bonus_events(order_id,employee_id,period_id,amount_cents,approved_by)
    values(o.id,a.employee_id,a.period_id,coalesce(bonus,35),p_actor) on conflict(order_id) do nothing;
  elsif p_action='cancel' then
   if p_role<>'admin' then raise exception 'FORBIDDEN';end if;
   perform set_config('mirpanel.employee_cancellation',o.id::text,true);
   perform reject_payment_order(o.id,'Admin tərəfindən ləğv edildi.',p_actor);
   update employee_order_assignments set state='CANCELLED' where order_id=o.id;
   update employee_stock_units set state=case when revealed_at is null then 'AVAILABLE' else 'DISABLED' end,
    employee_id=case when revealed_at is null then null else employee_id end,
    reserved_order_id=case when revealed_at is null then null else reserved_order_id end,version=version+1 where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
  else raise exception 'FORBIDDEN';end if;
 end if;
 select state into a.state from employee_order_assignments where order_id=o.id;
 v:=jsonb_build_object('ok',true,'state',a.state,'stockIds',ids);
 insert into employee_requests values(p_actor,p_key,payload,v,now());
 insert into employee_work_audit(actor_role,actor_ref,action,order_id,stock_ids) values(p_role,p_actor,p_action,o.id,ids);
 return v;
end; $$;

-- No legacy admin/batch/email approval may bypass fulfillment for enrolled orders.
create or replace function public.employee_guard_completion() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status in ('rejected','cancelled') and old.status is distinct from new.status
 and exists(select 1 from employee_order_assignments where order_id=new.id and state not in ('CANCELLED','COMPLETED'))
 and current_setting('mirpanel.employee_cancellation',true) is distinct from new.id::text then raise exception 'EMPLOYEE_ADMIN_CANCELLATION_REQUIRED';end if;
 if new.status in ('approved','completed') and old.status not in ('approved','completed')
 and exists(select 1 from employee_order_assignments where order_id=new.id and state<>'COMPLETED')
 and current_setting('mirpanel.employee_completion',true) is distinct from new.id::text then raise exception 'EMPLOYEE_ADMIN_FINAL_APPROVAL_REQUIRED';end if;
 return new;
end; $$;
drop trigger if exists employee_payment_completion_guard on public.payment_orders;
create trigger employee_payment_completion_guard before update of status on public.payment_orders for each row execute function public.employee_guard_completion();

-- Idempotent, confirmed restart creates a NEW period; it never deletes old orders/bonuses.
create or replace function public.employee_restart_reporting(p_id uuid,p_actor text,p_confirmation text,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v uuid;t timestamptz:=clock_timestamp();r jsonb;
begin
 if p_confirmation<>'YENİ HESABAT DÖVRÜ' or p_key is null then raise exception 'CONFIRMATION_REQUIRED';end if;
 perform 1 from employee_accounts where id=p_id for update;if not found then raise exception 'EMPLOYEE_NOT_FOUND';end if;
 select result into r from employee_requests where actor_ref=p_actor and request_key=p_key;if found then return r;end if;
 if exists(select 1 from employee_order_assignments where employee_id=p_id and state not in ('COMPLETED','CANCELLED')) then raise exception 'OPEN_ORDERS_EXIST';end if;
 insert into employee_reporting_periods(employee_id,employee_started_at,created_by) values(p_id,t,p_actor) returning id into v;
 update employee_accounts set employee_started_at=t,current_period_id=v,session_version=session_version+1 where id=p_id;
 insert into employee_reporting_audit(employee_id,period_id,action,actor_ref) values(p_id,v,'reporting.period_changed',p_actor);
 r:=jsonb_build_object('employeeStartedAt',t,'periodId',v);
 insert into employee_requests values(p_actor,p_key,jsonb_build_object('restart',p_id),r,now());return r;
end; $$;

create or replace function public.employee_order_list(p_employee uuid,p_tab text,p_page integer default 0)
returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(row_to_json(s)),'[]'::jsonb) from (
 select o.id,o.order_code,o.created_at,o.product_id,o.product_title,o.plan_id,o.plan_name,o.canonical_plan_id,o.quantity,o.amount,o.currency,
 o.customer_name,o.customer_phone,o.status as payment_status,o.payment_verified_at,o.payment_verified_by,
 (o.created_at<(select min(employee_started_at) from employee_accounts) and (o.customer_name is null or o.customer_phone is null or o.quantity is null or o.canonical_plan_id is null)) as can_fill_legacy,
 a.state,a.employee_id,a.accepted_at,a.assigned_at,a.submitted_at,a.admin_completed_at,a.returned_count,e.display_name as employee_name,
 (select count(*) from employee_stock_units u where u.plan_id=o.canonical_plan_id and u.state='AVAILABLE') as available_stock,
 (select count(*) from employee_stock_units u where u.reserved_order_id=o.id and u.state in ('RESERVED','DELIVERY_PENDING')) as reserved_quantity
 from payment_orders o left join employee_order_assignments a on a.order_id=o.id left join employee_accounts e on e.id=a.employee_id
 where (p_employee is null or exists(select 1 from employee_accounts me where me.id=p_employee and me.active and me.employee_started_at is not null
  and o.created_at>=me.employee_started_at and o.payment_verified_at is not null
  and ((a.order_id is null and o.status in ('reviewing','new_receipt_requested')) or (a.employee_id=me.id and a.period_id=me.current_period_id))))
 and (p_tab='all' or (p_tab='NEW' and a.order_id is null and o.status in ('reviewing','new_receipt_requested')) or a.state=p_tab
  or (p_tab='today' and a.state='COMPLETED' and (a.admin_completed_at at time zone 'Asia/Baku')::date=(now() at time zone 'Asia/Baku')::date))
 order by o.created_at desc,o.id limit 50 offset greatest(0,least(p_page,10000))*50
) s; $$;

create or replace function public.employee_inventory_counts() returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(row_to_json(s)),'[]'::jsonb) from (
 select p.id as plan_id,p.product_id,p.source_plan_key,p.label,p.signature,p.inventory_tracked,p.low_stock,
 count(u.id) filter(where u.state='AVAILABLE') as available,
 count(u.id) filter(where u.state='RESERVED') as reserved,
 count(u.id) filter(where u.state='DELIVERY_PENDING') as pending
 from employee_catalog_plans p left join employee_stock_units u on u.plan_id=p.id group by p.id
) s; $$;

create or replace function public.employee_monthly_pay(p_employee uuid,p_month date)
returns jsonb language sql stable security definer set search_path=public as $$
with e as (select * from employee_accounts where id=p_employee),a as (
 select a.* from employee_order_assignments a join payment_orders o on o.id=a.order_id join e on a.employee_id=e.id and a.period_id=e.current_period_id
 where o.created_at>=e.employee_started_at and a.accepted_at>=e.employee_started_at and a.assigned_at>=e.employee_started_at
 and a.state='COMPLETED' and o.status in ('approved','completed')
 and (a.admin_completed_at at time zone 'Asia/Baku')::date>=date_trunc('month',p_month)::date
 and (a.admin_completed_at at time zone 'Asia/Baku')::date<(date_trunc('month',p_month)+interval '1 month')::date
), m as (select count(*) as approved,(select count(distinct w.order_id) from employee_work_audit w
 join employee_order_assignments z on z.order_id=w.order_id join payment_orders po on po.id=z.order_id
 join e on e.id=z.employee_id and e.current_period_id=z.period_id
 where w.action='return' and po.created_at>=e.employee_started_at and z.accepted_at>=e.employee_started_at
 and (w.created_at at time zone 'Asia/Baku')::date>=date_trunc('month',p_month)::date
 and (w.created_at at time zone 'Asia/Baku')::date<(date_trunc('month',p_month)+interval '1 month')::date) as returned,
 coalesce(avg(extract(epoch from(admin_completed_at-accepted_at))),0) as seconds from a),b as (
 select coalesce(sum(b.amount_cents),0) as bonus from employee_order_bonus_events b join a on a.order_id=b.order_id
),s as (select coalesce(c.salary_cents,50000) as salary,coalesce(c.rate_cents,35) as rate,coalesce(c.quality_cents,5000) as quality
 from e left join employee_salary_settings c on c.employee_id=e.id),v as (
 select m.*,case when exists(select 1 from e where employee_started_at is not null and employee_started_at<(date_trunc('month',p_month)+interval '1 month')) then s.salary else 0 end as salary,
 s.rate,b.bonus,case when m.approved>0 and m.returned*100<m.approved then s.quality else 0 end as quality from m,b,s
)
select jsonb_build_object('month',date_trunc('month',p_month)::date,'approved',coalesce(v.approved,0),'returned',coalesce(v.returned,0),
 'errorPercent',case when v.approved>0 then round(v.returned*100.0/v.approved,2) else 0 end,'averageSeconds',coalesce(v.seconds,0),
 'salaryCents',coalesce(v.salary,0),'configuredSalaryCents',coalesce((select salary from s),50000),'qualityRateCents',coalesce((select quality from s),5000),'rateCents',coalesce(v.rate,35),'orderBonusCents',coalesce(v.bonus,0),'qualityCents',coalesce(v.quality,0),
 'previewTotalCents',coalesce(v.salary+v.bonus+v.quality,0),'paid',exists(select 1 from employee_payroll_paid p where p.employee_id=p_employee and p.month=date_trunc('month',p_month)::date),
 'paidHistory',(select coalesce(jsonb_agg(row_to_json(h)),'[]'::jsonb) from (select month,amount_cents,paid_at from employee_payroll_paid where employee_id=p_employee order by month desc limit 12)h)) from v;
$$;

create or replace function public.employee_approve_direct(p_order_id uuid,p_duration_months integer,p_actor text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 v:=approve_payment_order_v7(p_order_id,p_duration_months,p_actor);
 if coalesce((v->>'idempotent')::boolean,false)=false then
  update payment_orders set profit_snapshot=amount-cost_price_snapshot*quantity,
   profit_margin_snapshot=round((amount-cost_price_snapshot*quantity)*100/nullif(amount,0),2),
   cost_price_snapshot=cost_price_snapshot*quantity
   where id=p_order_id and quantity>1 and cost_price_snapshot is not null;
 end if;return v;
end; $$;
create or replace function public.employee_queue_count(p_employee uuid) returns bigint language sql stable security definer set search_path=public as $$
 select count(*) from payment_orders o join employee_accounts e on e.id=p_employee
 where e.active and e.employee_started_at is not null and o.created_at>=e.employee_started_at and o.payment_verified_at is not null
 and o.status in ('reviewing','new_receipt_requested') and not exists(select 1 from employee_order_assignments a where a.order_id=o.id);
$$;
create or replace function public.employee_account_control(p_id uuid,p_action text,p_actor text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a employee_accounts%rowtype;
begin
 select * into a from employee_accounts where id=p_id for update;if not found then raise exception 'EMPLOYEE_NOT_FOUND';end if;
 if p_action not in ('disable','revoke','enable') or (p_action='enable' and a.employee_started_at is null) then raise exception 'FORBIDDEN';end if;
 update employee_accounts set active=case when p_action='disable' then false when p_action='enable' then true else active end,session_version=session_version+1 where id=p_id;
 insert into employee_work_audit(actor_role,actor_ref,action) values('admin',p_actor,'account.'||p_action);return '{"ok":true}'::jsonb;
end; $$;
create or replace function public.employee_stock_alerts() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(row_to_json(s)),'[]'::jsonb) from (select o.order_code,o.product_title,o.plan_name,max(w.created_at) as created_at
 from employee_work_audit w join payment_orders o on o.id=w.order_id
 where w.action='stock.empty' and (select count(*) from employee_stock_units u where u.plan_id=o.canonical_plan_id and u.state='AVAILABLE')<o.quantity
 and not exists(select 1 from employee_order_assignments a where a.order_id=o.id and a.state in ('COMPLETED','CANCELLED'))
 group by o.order_code,o.product_title,o.plan_name order by max(w.created_at) desc limit 20) s;
$$;
create or replace function public.employee_plan_review(p_product text,p_key text,p_signature text,p_label text,p_actor text)
returns uuid language plpgsql security definer set search_path=public as $$
declare old_id uuid;new_id uuid;
begin
 select id into old_id from employee_catalog_plans where product_id=p_product and source_plan_key=p_key for update;
 if found then
  update employee_catalog_plans set source_plan_key=p_key||':archived:'||id::text where id=old_id;
 end if;
 insert into employee_catalog_plans(product_id,source_plan_key,signature,label) values(p_product,p_key,p_signature,p_label) returning id into new_id;
 insert into employee_work_audit(actor_role,actor_ref,action) values('admin',p_actor,'plan.mapping.reviewed');
 return new_id;
end; $$;
create or replace function public.employee_fill_legacy(p_order uuid,p_plan uuid,p_customer jsonb,p_actor text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o payment_orders%rowtype;cutoff timestamptz;q integer;
begin
 select * into o from payment_orders where id=p_order for update;if not found then raise exception 'ORDER_NOT_FOUND';end if;
 select min(employee_started_at) into cutoff from employee_accounts;
 if cutoff is null or o.created_at>=cutoff then raise exception 'LEGACY_ORDER_REQUIRED';end if;
 q:=(p_customer->>'quantity')::integer;
 if q is null or q<1 or q>100 or coalesce(length(trim(p_customer->>'name')),0)<2 or coalesce(p_customer->>'phone','')!~'^[1-9][0-9]{7,14}$'
  or not exists(select 1 from employee_catalog_plans where id=p_plan and product_id=o.product_id) then raise exception 'INVALID_LEGACY_DETAILS';end if;
 if (o.customer_name is not null and o.customer_name<>p_customer->>'name') or (o.customer_phone is not null and o.customer_phone<>p_customer->>'phone')
 or (o.quantity is not null and o.quantity<>q) or (o.canonical_plan_id is not null and o.canonical_plan_id<>p_plan) then raise exception 'LEGACY_DETAILS_CONFLICT';end if;
 if o.customer_name is not null and o.customer_phone is not null and o.quantity is not null and o.canonical_plan_id is not null then return '{"ok":true,"idempotent":true}'::jsonb;end if;
 update payment_orders set customer_name=coalesce(customer_name,p_customer->>'name'),customer_phone=coalesce(customer_phone,p_customer->>'phone'),
 quantity=coalesce(quantity,q),canonical_plan_id=coalesce(canonical_plan_id,p_plan) where id=o.id;
 insert into employee_work_audit(actor_role,actor_ref,action,order_id) values('admin',p_actor,'legacy.details.completed',o.id);
 return '{"ok":true}'::jsonb;
end; $$;
create or replace function public.employee_system_ready() returns integer language sql stable security definer set search_path=public as $$select 2;$$;
do $$ declare tab text;f record;begin
 foreach tab in array array['employee_catalog_plans','employee_stock_units','employee_work_audit','employee_requests','employee_salary_settings','employee_payroll_paid'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select,insert,update on public.%I to service_role',tab);
 end loop;
 revoke update on public.employee_work_audit from service_role;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('employee_plan_resolve','employee_submit_checkout','employee_add_stock','employee_order_action','employee_guard_completion','employee_restart_reporting','employee_order_list','employee_inventory_counts','employee_monthly_pay','employee_queue_count','employee_account_control','employee_approve_direct','employee_system_ready','employee_stock_alerts','employee_plan_review','employee_fill_legacy') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
select table_name,rows_copied,backed_up_at from employee_pre_release_20261021.manifest order by table_name;
select public.employee_system_ready() as employee_schema_version;
