-- Additive v3: employee delivery is NOT payment approval or final completion.
-- No order/account/stock seed, no historical updates, no encryption key change.
begin;
do $$begin
 if public.employee_system_ready()<2 then raise exception 'EMPLOYEE_V2_REQUIRED';end if;
end$$;
create schema if not exists employee_review_release_20261021;
revoke all on schema employee_review_release_20261021 from public,anon,authenticated;
create table if not exists employee_review_release_20261021.functions(name text primary key,definition text not null);
create table if not exists employee_review_release_20261021.manifest(table_name text primary key,row_count bigint not null,captured_at timestamptz not null default clock_timestamp());
insert into employee_review_release_20261021.functions
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('employee_order_action','employee_order_list','employee_queue_count','employee_reporting_snapshot','employee_system_ready')
 on conflict(name) do nothing;
-- Frozen backup of affected operational rows; private, no plaintext export.
do $$declare t text;begin foreach t in array array['payment_orders','employee_order_assignments','employee_stock_units','employee_order_bonus_events','employee_work_audit'] loop
 if to_regclass('employee_review_release_20261021.'||t) is null then
 execute format('create table employee_review_release_20261021.%I as table public.%I',t,t);end if;
 execute format('insert into employee_review_release_20261021.manifest(table_name,row_count) select %L,count(*) from employee_review_release_20261021.%I on conflict(table_name) do nothing',t,t);
end loop;end$$;
alter table public.employee_order_assignments alter column payment_verified_at drop not null;
alter table public.employee_order_assignments
 add column if not exists employee_accepted_at timestamptz,
 add column if not exists stock_reserved_at timestamptz,
 add column if not exists employee_delivered_at timestamptz,
 add column if not exists employee_submitted_for_review_at timestamptz,
 add column if not exists admin_reviewed_at timestamptz,
 add column if not exists payment_decision text not null default 'pending',
 add column if not exists payment_note text not null default '',
 add column if not exists employee_note text not null default '',
 add column if not exists message_cipher text,
 add column if not exists message_prepared_at timestamptz,
 add column if not exists message_opened_at timestamptz;
alter table public.employee_work_audit add column if not exists review_reason text not null default '';
create index if not exists employee_pending_review_idx on public.employee_order_assignments(submitted_at,order_id) where state='DELIVERED_PENDING_ADMIN';
create or replace function public.employee_order_action_v3(p_order uuid,p_action text,p_role text,p_actor text,p_employee uuid,p_key uuid,p_quantity integer default 1,p_details jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a employee_order_assignments%rowtype; e employee_accounts%rowtype;o payment_orders%rowtype;
 ids uuid[];n integer;bonus integer;v jsonb;payload jsonb:=jsonb_build_object('order',p_order,'action',p_action,'quantity',p_quantity,'employee',p_employee,'details',p_details - 'messageCipher');saved employee_requests%rowtype;
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
 if p_role='employee' and p_action not in ('accept','verify','reserve','preview','whatsapp','sent','submit') then raise exception 'FORBIDDEN';end if;
 if p_action='verify' then
  if p_role<>'employee' or a.employee_id is distinct from p_employee or a.state not in ('EMPLOYEE_ACCEPTED','STOCK_RESERVED','RETURNED_TO_EMPLOYEE') then raise exception 'FORBIDDEN';end if;
  select * into e from employee_accounts where id=p_employee;
  if not e.active or e.employee_started_at is null or o.created_at<e.employee_started_at or a.period_id<>e.current_period_id then raise exception 'FORBIDDEN';end if;
  if p_details->>'decision' is distinct from 'verified' then raise exception 'PAYMENT_DECISION_REQUIRED';end if;
  if o.status not in ('reviewing','new_receipt_requested') or coalesce(length(trim(o.customer_name)),0)<2 or coalesce(o.customer_phone,'')!~'^[1-9][0-9]{7,14}$' or o.quantity is null or o.quantity<1 or o.canonical_plan_id is null then raise exception 'ORDER_NOT_READY';end if;
  update payment_orders set payment_verified_at=coalesce(payment_verified_at,clock_timestamp()),payment_verified_by=coalesce(payment_verified_by,'employee:'||p_actor) where id=o.id;
  update employee_order_assignments set payment_verified_at=(select payment_verified_at from payment_orders where id=o.id),payment_decision='verified',payment_note=coalesce(p_details->>'note','') where order_id=o.id;
 elsif p_action='accept' then
  if p_role<>'employee' then raise exception 'FORBIDDEN';end if;
  select * into e from employee_accounts where id=p_employee for update;
  if not found or not e.active or e.employee_started_at is null or o.created_at<e.employee_started_at
   or o.status not in ('reviewing','new_receipt_requested') or (a.order_id is not null and a.employee_id<>e.id) then raise exception 'ORDER_NOT_READY';end if;
  if a.order_id is not null then raise exception 'ORDER_ALREADY_ASSIGNED';end if;
  if o.canonical_plan_id is null or o.quantity is null or o.quantity<1 or coalesce(length(trim(o.customer_name)),0)<2 or coalesce(o.customer_phone,'')!~'^[1-9][0-9]{7,14}$' then raise exception 'ORDER_NOT_READY';end if;
  if a.order_id is null then
   insert into employee_order_assignments(order_id,employee_id,period_id,quantity,state,payment_verified_at,assigned_at,accepted_at,employee_accepted_at)
   values(o.id,e.id,e.current_period_id,o.quantity,'EMPLOYEE_ACCEPTED',o.payment_verified_at,clock_timestamp(),clock_timestamp(),clock_timestamp());
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
   if o.payment_verified_at is null or a.payment_decision<>'verified' then raise exception 'PAYMENT_VERIFICATION_REQUIRED';end if;
   select count(*) into n from employee_stock_units where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
   if p_quantity is null or p_quantity<1 or n+p_quantity>a.quantity then raise exception 'INVALID_QUANTITY';end if;
   select array_agg(id) into ids from (select id from employee_stock_units where product_id=o.product_id and plan_id=o.canonical_plan_id and state='AVAILABLE' order by created_at,id for update skip locked limit p_quantity) s;
   if coalesce(cardinality(ids),0)<>p_quantity then raise exception 'STOCK_EMPTY';end if;
   update employee_stock_units set state='RESERVED',reserved_order_id=o.id,employee_id=a.employee_id,version=version+1 where id=any(ids);
   update employee_order_assignments set state='STOCK_RESERVED',stock_reserved_at=coalesce(stock_reserved_at,clock_timestamp()) where order_id=o.id;
  elsif p_action in ('preview','whatsapp','sent','submit') then
   if p_role<>'employee' or a.state not in ('STOCK_RESERVED','RETURNED_TO_EMPLOYEE') then raise exception 'FORBIDDEN';end if;
   if o.payment_verified_at is null or a.payment_decision<>'verified' then raise exception 'PAYMENT_VERIFICATION_REQUIRED';end if;
   select count(*) into n from employee_stock_units where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
   if n<>a.quantity then raise exception 'STOCK_QUANTITY_INCOMPLETE';end if;
   if p_action in ('preview','whatsapp') then
    if coalesce(length(p_details->>'messageCipher'),0)<40 then raise exception 'MESSAGE_PREVIEW_REQUIRED';end if;
    update employee_order_assignments set message_cipher=p_details->>'messageCipher',message_prepared_at=clock_timestamp(),message_opened_at=case when p_action='whatsapp' then clock_timestamp() else message_opened_at end where order_id=o.id;
    update employee_stock_units set revealed_at=coalesce(revealed_at,clock_timestamp()) where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
   elsif p_action='sent' then
    if a.message_cipher is null then raise exception 'MESSAGE_PREVIEW_REQUIRED';end if;
    update employee_stock_units set state='DELIVERY_PENDING',delivered_at=clock_timestamp() where reserved_order_id=o.id and state='RESERVED';
    update employee_order_assignments set sent_at=clock_timestamp(),employee_delivered_at=clock_timestamp() where order_id=o.id;
   elsif p_action='submit' then
    if a.sent_at is null then raise exception 'DELIVERY_CONFIRMATION_REQUIRED';end if;
    update employee_order_assignments set state='DELIVERED_PENDING_ADMIN',submitted_at=clock_timestamp(),employee_submitted_for_review_at=clock_timestamp(),employee_note=coalesce(p_details->>'note','') where order_id=o.id;
   end if;
  elsif p_action='return' then
   if p_role<>'admin' or a.state<>'DELIVERED_PENDING_ADMIN' then raise exception 'FORBIDDEN';end if;
   if coalesce(length(trim(p_details->>'reason')),0)<3 then raise exception 'RETURN_REASON_REQUIRED';end if;
   update employee_order_assignments set state='RETURNED_TO_EMPLOYEE',returned_count=returned_count+1,sent_at=null,return_note=p_details->>'reason',admin_reviewed_at=clock_timestamp() where order_id=o.id;
  elsif p_action='complete' then
   if p_role<>'admin' or a.state<>'DELIVERED_PENDING_ADMIN' then raise exception 'FORBIDDEN';end if;
   select count(*) into n from employee_stock_units where reserved_order_id=o.id and state='DELIVERY_PENDING';
   if n<>a.quantity then raise exception 'STOCK_QUANTITY_INCOMPLETE';end if;
   -- The existing card limit/date/receipt/statistics implementation remains authoritative.
   perform set_config('mirpanel.employee_completion',o.id::text,true);
   v:=employee_approve_direct(o.id,o.duration_months,p_actor);
   update employee_order_assignments set state='COMPLETED',admin_completed_at=clock_timestamp(),admin_reviewed_at=clock_timestamp() where order_id=o.id;
   update employee_stock_units set state='DELIVERED',delivered_order_id=o.id,admin_approved_at=clock_timestamp(),version=version+1 where reserved_order_id=o.id and state='DELIVERY_PENDING';
   if (select completed_at from payment_orders where id=o.id) is null then raise exception 'ADMIN_COMPLETION_TIMESTAMP_REQUIRED';end if;
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
 insert into employee_work_audit(actor_role,actor_ref,action,order_id,stock_ids,review_reason) values(p_role,p_actor,p_action,o.id,ids,case when p_action='return' then p_details->>'reason' else '' end);
 return v;
end; $$;

create or replace function public.employee_order_list(p_employee uuid,p_tab text,p_page integer default 0)
returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(row_to_json(s)),'[]'::jsonb) from (
 select o.id,o.order_code,o.created_at,o.product_id,o.product_title,o.plan_id,o.plan_name,o.canonical_plan_id,o.quantity,o.amount,o.currency,
 o.customer_name,o.customer_phone,o.status as payment_status,o.payment_verified_at,o.payment_verified_by,
 (o.created_at<(select min(employee_started_at) from employee_accounts) and (o.customer_name is null or o.customer_phone is null or o.quantity is null or o.canonical_plan_id is null)) as can_fill_legacy,
 a.state,a.employee_id,a.accepted_at,a.assigned_at,a.submitted_at,a.admin_completed_at,a.returned_count,a.employee_accepted_at,a.stock_reserved_at,a.employee_delivered_at,a.employee_submitted_for_review_at,a.admin_reviewed_at,a.payment_decision,a.payment_note,a.employee_note,a.return_note,o.completed_at,
 (select coalesce(jsonb_agg(u.id),'[]'::jsonb) from employee_stock_units u where u.reserved_order_id=o.id) as stock_ids,e.display_name as employee_name,
 (select count(*) from employee_stock_units u where u.plan_id=o.canonical_plan_id and u.state='AVAILABLE') as available_stock,
 (select count(*) from employee_stock_units u where u.reserved_order_id=o.id and u.state in ('RESERVED','DELIVERY_PENDING')) as reserved_quantity
 from payment_orders o left join employee_order_assignments a on a.order_id=o.id left join employee_accounts e on e.id=a.employee_id
 where (p_employee is null or exists(select 1 from employee_accounts me where me.id=p_employee and me.active and me.employee_started_at is not null
  and o.created_at>=me.employee_started_at
  and ((a.order_id is null and o.status in ('reviewing','new_receipt_requested')) or (a.employee_id=me.id and a.period_id=me.current_period_id))))
 and (p_tab='all' or (p_tab='NEW' and a.order_id is null and o.status in ('reviewing','new_receipt_requested')) or a.state=p_tab
  or (p_tab='today' and a.state='COMPLETED' and (a.admin_completed_at at time zone 'Asia/Baku')::date=(now() at time zone 'Asia/Baku')::date))
 order by o.created_at desc,o.id limit 50 offset greatest(0,least(p_page,10000))*50
) s; $$;
create or replace function public.employee_queue_count(p_employee uuid) returns bigint language sql stable security definer set search_path=public as $$
 select count(*) from payment_orders o join employee_accounts e on e.id=p_employee
 where e.active and e.employee_started_at is not null and o.created_at>=e.employee_started_at
 and o.status in ('reviewing','new_receipt_requested') and not exists(select 1 from employee_order_assignments a where a.order_id=o.id);
$$;
create or replace function public.employee_reporting_snapshot(p_employee_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
with employee as (select * from public.employee_accounts where id=p_employee_id),
eligible as (
  select a.* from public.employee_order_assignments a
  join employee e on e.id=a.employee_id and e.current_period_id=a.period_id
  join public.payment_orders o on o.id=a.order_id
  where e.employee_started_at is not null and o.created_at>=e.employee_started_at
    and a.assigned_at>=e.employee_started_at
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
-- Old server/RPC callers cannot bypass the v3 rules. No overload with optional details.
create or replace function public.employee_order_action(p_order uuid,p_action text,p_role text,p_actor text,p_employee uuid,p_key uuid,p_quantity integer default 1)
returns jsonb language sql security definer set search_path=public as $$
 select employee_order_action_v3(p_order,p_action,p_role,p_actor,p_employee,p_key,p_quantity,'{}'::jsonb);
$$;
create or replace function public.employee_review_summary() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('pendingReview',count(*)) from employee_order_assignments where state='DELIVERED_PENDING_ADMIN';
$$;
create or replace function public.employee_system_ready() returns integer language sql stable security definer set search_path=public as $$select 3;$$;
revoke all on function public.employee_order_action_v3(uuid,text,text,text,uuid,uuid,integer,jsonb),public.employee_review_summary() from public,anon,authenticated;
grant execute on function public.employee_order_action_v3(uuid,text,text,text,uuid,uuid,integer,jsonb),public.employee_review_summary() to service_role;
-- Additive columns inherit the table's existing RLS. No public stock or employee access.
commit;
select public.employee_system_ready() as employee_schema_version;
select table_name,row_count,captured_at from employee_review_release_20261021.manifest order by table_name;

