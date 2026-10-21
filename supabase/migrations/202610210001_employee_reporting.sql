-- Foundation only. No accounts, legacy assignments, stock, wages or fake orders are seeded.
begin;
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
commit;
