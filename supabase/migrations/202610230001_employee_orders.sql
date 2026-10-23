-- Schema 4: orders-only manual fulfillment. NO production seeds or historical updates.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(714025001);
do $$begin if public.employee_system_ready() not in (3,4) then raise exception 'EMPLOYEE_V3_REQUIRED';end if;end$$;
lock table public.payment_orders,public.employee_order_assignments,public.employee_order_bonus_events,public.employee_requests,public.employee_work_audit,public.employee_accounts,public.employee_stock_units in share mode;
create schema if not exists employee_orders_release_20261023;
revoke all on schema employee_orders_release_20261023 from public,anon,authenticated;
create table if not exists employee_orders_release_20261023.functions(name text primary key,definition text not null);
create table if not exists employee_orders_release_20261023.manifest(table_name text primary key,row_count bigint not null,captured_at timestamptz not null default clock_timestamp());
insert into employee_orders_release_20261023.functions
 select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('employee_order_action_v3','employee_order_list','employee_queue_count','employee_approve_direct','employee_system_ready') on conflict(name) do nothing;
do $$declare t text;begin foreach t in array array['payment_orders','employee_order_assignments','employee_order_bonus_events','employee_requests','employee_work_audit','employee_accounts','employee_stock_units'] loop
 if to_regclass('employee_orders_release_20261023.'||t) is null then execute format('create table employee_orders_release_20261023.%I as table public.%I',t,t);end if;
 execute format('insert into employee_orders_release_20261023.manifest(table_name,row_count) select %L,count(*) from employee_orders_release_20261023.%I on conflict(table_name) do nothing',t,t);
end loop;end$$;
do $$declare r record;n bigint;begin
 if (select count(*) from employee_orders_release_20261023.manifest)<>7 then raise exception 'BACKUP_MANIFEST_INCOMPLETE';end if;
 for r in select * from employee_orders_release_20261023.manifest loop execute format('select count(*) from employee_orders_release_20261023.%I',r.table_name) into n;if n<>r.row_count then raise exception 'BACKUP_MANIFEST_MISMATCH';end if;end loop;
end$$;
-- Keep the original routines private for compatible stock operations and rollback.
do $$declare r text;begin
 if to_regprocedure('employee_orders_release_20261023.legacy_action(uuid,text,text,text,uuid,uuid,integer,jsonb)') is null then
 select replace(definition,'public.employee_order_action_v3(','employee_orders_release_20261023.legacy_action(') into r from employee_orders_release_20261023.functions where name like '%employee_order_action_v3(%';execute r;end if;
 if to_regprocedure('employee_orders_release_20261023.legacy_approve(uuid,integer,text)') is null then
 select replace(definition,'public.employee_approve_direct(','employee_orders_release_20261023.legacy_approve(') into r from employee_orders_release_20261023.functions where name like '%employee_approve_direct(%';execute r;end if;
 if to_regprocedure('employee_orders_release_20261023.legacy_list(uuid,text,integer)') is null then
 select replace(definition,'public.employee_order_list(','employee_orders_release_20261023.legacy_list(') into r from employee_orders_release_20261023.functions where name like '%employee_order_list(%';execute r;end if;
end$$;
revoke all on all functions in schema employee_orders_release_20261023 from public,anon,authenticated,service_role;
create table if not exists public.employee_order_claims(
 order_id uuid primary key references public.payment_orders(id) on delete restrict,
 owner_role text not null check(owner_role in ('admin','employee')),
 owner_ref text not null check(length(owner_ref)>0),
 employee_id uuid references public.employee_accounts(id) on delete restrict,
 claimed_at timestamptz not null default clock_timestamp(),
 check((owner_role='employee')=(employee_id is not null))
);
alter table public.employee_order_claims enable row level security;
revoke all on public.employee_order_claims from public,anon,authenticated;
grant select on public.employee_order_claims to service_role;
create or replace function public.employee_order_action_v4(p_order uuid,p_action text,p_role text,p_actor text,p_employee uuid,p_key uuid,p_quantity integer default 1,p_details jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o payment_orders%rowtype;a employee_order_assignments%rowtype;e employee_accounts%rowtype;c employee_order_claims%rowtype;
 saved employee_requests%rowtype;v jsonb;n integer;bonus integer;
 payload jsonb:=jsonb_build_object('flow',4,'order',p_order,'action',p_action,'role',p_role,'employee',p_employee,'quantity',p_quantity,'details',p_details-'messageCipher');
begin
 if p_role is null or p_role not in ('admin','employee') or nullif(trim(p_actor),'') is null or p_key is null then raise exception 'FORBIDDEN';end if;
 if p_role='employee' and (p_employee is null or p_actor<>p_employee::text or p_action not in ('accept','verify','submit','reserve','preview','whatsapp','sent')) then raise exception 'FORBIDDEN';end if;
 if p_role='admin' and (p_employee is not null or p_action not in ('claim','complete','return','cancel')) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor||p_key::text,0));
 -- Same lock order as canonical payment approval; serializes claim and finalization.
 perform pg_advisory_xact_lock(714025001);
 select * into o from payment_orders where id=p_order for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 select * into a from employee_order_assignments where order_id=o.id for update;
 select * into c from employee_order_claims where order_id=o.id for update;
 if p_role='employee' then
 select * into e from employee_accounts where id=p_employee for update;
 if not found or not e.active or e.employee_started_at is null or o.created_at<e.employee_started_at
 or (a.order_id is not null and (a.employee_id<>e.id or a.period_id<>e.current_period_id)) then raise exception 'FORBIDDEN';end if;
 end if;
 if p_action in ('reserve','preview','whatsapp','sent','cancel') then
 payload:=jsonb_build_object('order',p_order,'action',p_action,'quantity',p_quantity,'employee',p_employee,'details',p_details-'messageCipher');
 else payload:=payload||jsonb_build_object('reviewCycle',coalesce(a.returned_count,0));end if;
 select * into saved from employee_requests where actor_ref=p_actor and request_key=p_key;
 if found then if saved.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 if o.status not in ('reviewing','new_receipt_requested') or a.state in ('COMPLETED','CANCELLED') then raise exception 'ORDER_FINALIZED';end if;
 if p_action in ('accept','claim') then
 if c.order_id is not null or a.order_id is not null then raise exception 'ORDER_ALREADY_CLAIMED';end if;
 insert into employee_order_claims(order_id,owner_role,owner_ref,employee_id) values(o.id,p_role,p_actor,p_employee) returning * into c;
 if p_role='employee' then
 insert into employee_order_assignments(order_id,employee_id,period_id,quantity,state,payment_verified_at,assigned_at,accepted_at,employee_accepted_at)
 values(o.id,e.id,e.current_period_id,coalesce(o.quantity,1),'EMPLOYEE_ACCEPTED',null,clock_timestamp(),clock_timestamp(),clock_timestamp());
 end if;
 else
 if a.order_id is null then raise exception 'ORDER_NOT_ASSIGNED';end if;
 if c.order_id is not null and (c.owner_role<>'employee' or c.employee_id<>a.employee_id) then raise exception 'FORBIDDEN';end if;
 if p_role='employee' and a.employee_id<>p_employee then raise exception 'FORBIDDEN';end if;
 if p_action='verify' then
 if a.state not in ('EMPLOYEE_ACCEPTED','STOCK_RESERVED','RETURNED_TO_EMPLOYEE') then raise exception 'INVALID_ORDER_TRANSITION';end if;
 if p_details->>'decision' is distinct from 'verified' then raise exception 'PAYMENT_DECISION_REQUIRED';end if;
 if a.payment_decision='verified' then raise exception 'PAYMENT_ALREADY_VERIFIED';end if;
 update payment_orders set payment_verified_at=coalesce(payment_verified_at,clock_timestamp()),payment_verified_by=coalesce(payment_verified_by,'employee:'||p_actor) where id=o.id;
 update employee_order_assignments set payment_verified_at=clock_timestamp(),payment_decision='verified',payment_note=coalesce(p_details->>'note','') where order_id=o.id;
 elsif p_action='submit' then
 if a.state not in ('EMPLOYEE_ACCEPTED','STOCK_RESERVED','RETURNED_TO_EMPLOYEE') then raise exception 'INVALID_ORDER_TRANSITION';end if;
 if a.payment_verified_at is null or a.payment_decision<>'verified' then raise exception 'PAYMENT_VERIFICATION_REQUIRED';end if;
 if p_details->>'delivered' is distinct from 'true' then raise exception 'DELIVERY_CONFIRMATION_REQUIRED';end if;
 select count(*) into n from employee_stock_units where reserved_order_id=o.id and state in ('RESERVED','DELIVERY_PENDING');
 if n>0 and n<>a.quantity then raise exception 'STOCK_QUANTITY_INCOMPLETE';end if;
 update employee_stock_units set state='DELIVERY_PENDING',delivered_at=clock_timestamp() where reserved_order_id=o.id and state='RESERVED';
 update employee_order_assignments set state='DELIVERED_PENDING_ADMIN',sent_at=clock_timestamp(),employee_delivered_at=clock_timestamp(),submitted_at=clock_timestamp(),employee_submitted_for_review_at=clock_timestamp(),employee_note=coalesce(p_details->>'note','') where order_id=o.id;
 elsif p_action='return' then
 if a.state<>'DELIVERED_PENDING_ADMIN' then raise exception 'INVALID_ORDER_TRANSITION';end if;
 if length(trim(coalesce(p_details->>'reason','')))<3 then raise exception 'RETURN_REASON_REQUIRED';end if;
 update employee_order_assignments set state='RETURNED_TO_EMPLOYEE',returned_count=returned_count+1,return_note=p_details->>'reason',sent_at=null,admin_reviewed_at=clock_timestamp() where order_id=o.id;
 elsif p_action='complete' then
 if a.state<>'DELIVERED_PENDING_ADMIN' then raise exception 'INVALID_ORDER_TRANSITION';end if;
 perform set_config('mirpanel.employee_completion',o.id::text,true);
 v:=employee_approve_direct(o.id,o.duration_months,p_actor);
 update employee_order_assignments set state='COMPLETED',admin_completed_at=clock_timestamp(),admin_reviewed_at=clock_timestamp() where order_id=o.id;
 update employee_stock_units set state='DELIVERED',delivered_order_id=o.id,admin_approved_at=clock_timestamp(),version=version+1 where reserved_order_id=o.id and state='DELIVERY_PENDING';
 select rate_cents into bonus from employee_salary_settings where employee_id=a.employee_id;
 insert into employee_order_bonus_events(order_id,employee_id,period_id,amount_cents,approved_by) values(o.id,a.employee_id,a.period_id,coalesce(bonus,35),p_actor) on conflict(order_id) do nothing;
 elsif p_action='cancel' then
 -- Existing schema-3 cancellation and sensitive stock disposal remain authoritative.
 return employee_orders_release_20261023.legacy_action(p_order,p_action,p_role,p_actor,p_employee,p_key,p_quantity,p_details);
 elsif p_action in ('reserve','preview','whatsapp','sent') then
 return employee_orders_release_20261023.legacy_action(p_order,p_action,p_role,p_actor,p_employee,p_key,p_quantity,p_details);
 else raise exception 'FORBIDDEN';end if;
 end if;
 select * into a from employee_order_assignments where order_id=o.id;
 v:=jsonb_build_object('ok',true,'state',a.state,'ownerRole',coalesce(c.owner_role,'employee'));
 insert into employee_requests values(p_actor,p_key,payload,v,clock_timestamp());
 insert into employee_work_audit(actor_role,actor_ref,action,order_id,review_reason) values(p_role,p_actor,p_action,o.id,case when p_action='return' then p_details->>'reason' else '' end);
 return v;
end;$$;
-- Old RPC callers use the same rules; cannot bypass null-safe review or ownership.
create or replace function public.employee_order_action_v3(p_order uuid,p_action text,p_role text,p_actor text,p_employee uuid,p_key uuid,p_quantity integer default 1,p_details jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path=public as $$select employee_order_action_v4(p_order,p_action,p_role,p_actor,p_employee,p_key,p_quantity,p_details);$$;
create or replace function public.employee_approve_direct(p_order_id uuid,p_duration_months integer,p_actor text) returns jsonb language plpgsql security definer set search_path=public as $$
declare c employee_order_claims%rowtype;v jsonb;begin
 perform pg_advisory_xact_lock(714025001);perform 1 from payment_orders where id=p_order_id for update;
 select * into c from employee_order_claims where order_id=p_order_id for update;
 if c.owner_role='employee' and current_setting('mirpanel.employee_completion',true) is distinct from p_order_id::text then raise exception 'EMPLOYEE_ADMIN_FINAL_APPROVAL_REQUIRED';end if;
 if c.owner_role='admin' and c.owner_ref<>p_actor then raise exception 'ORDER_ALREADY_CLAIMED';end if;
 v:=employee_orders_release_20261023.legacy_approve(p_order_id,p_duration_months,p_actor);return v;
end;$$;
create or replace function public.employee_order_list(p_employee uuid,p_tab text,p_page integer default 0)
returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(s.item),'[]'::jsonb) from (
 select item||jsonb_build_object('owner_role',coalesce(c.owner_role,case when a.order_id is not null then 'employee' end),'claimed_at',coalesce(c.claimed_at,a.accepted_at),'payment_method',coalesce(to_jsonb(o)->>'method_name_snapshot',(select m.display_name from payment_methods m where m.id=(to_jsonb(o)->>'method_id')::uuid),'Məlumat yoxdur'),'payment_last4',coalesce(to_jsonb(o)->>'method_last4_snapshot',(select m.last4 from payment_methods m where m.id=(to_jsonb(o)->>'method_id')::uuid))) as item
 from jsonb_array_elements(employee_orders_release_20261023.legacy_list(p_employee,case when p_tab='ADMIN_ACTIVE' then 'all' else p_tab end,p_page)) item
 join payment_orders o on o.id=(item->>'id')::uuid
 left join employee_order_assignments a on a.order_id=o.id left join employee_order_claims c on c.order_id=o.id
 where p_tab<>'ADMIN_ACTIVE' or c.owner_role='admin'
)s;$$;
create or replace function public.employee_order_workflow(p_ids uuid[]) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'state',coalesce(a.state,'NEW'),'ownerRole',coalesce(c.owner_role,case when a.order_id is not null then 'employee' end),'employeeName',e.display_name,'acceptedAt',coalesce(c.claimed_at,a.accepted_at),'deliveredAt',a.employee_delivered_at,'paymentVerifiedAt',o.payment_verified_at)),'[]'::jsonb)
 from payment_orders o left join employee_order_claims c on c.order_id=o.id left join employee_order_assignments a on a.order_id=o.id left join employee_accounts e on e.id=a.employee_id where o.id=any(p_ids);
$$;
create or replace function public.employee_system_ready() returns integer language sql stable security definer set search_path=public as $$select 4;$$;
revoke all on function public.employee_order_action_v4(uuid,text,text,text,uuid,uuid,integer,jsonb),public.employee_order_workflow(uuid[]) from public,anon,authenticated;
grant execute on function public.employee_order_action_v4(uuid,text,text,text,uuid,uuid,integer,jsonb),public.employee_order_workflow(uuid[]) to service_role;
commit;
select public.employee_system_ready() as employee_schema_version;
select * from employee_orders_release_20261023.manifest order by table_name;
