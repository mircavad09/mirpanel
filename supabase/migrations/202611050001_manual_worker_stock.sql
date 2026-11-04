begin;
-- Separate manual stock; no customer stock, orders, payments or payroll backfill.
alter table public.employee_accounts add column if not exists manual_only boolean not null default false;
create table if not exists public.manual_stock_release(id boolean primary key default true check(id),enabled boolean not null default true);
insert into public.manual_stock_release values(true,true) on conflict do nothing;
create table if not exists public.manual_stock_products(id uuid primary key,name text not null,image text not null default '',active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.manual_stock_plans(id uuid primary key,product_id uuid not null references public.manual_stock_products(id),name text not null,duration text not null default '',template text not null,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.manual_stock_permissions(employee_id uuid not null references public.employee_accounts(id),product_id uuid not null references public.manual_stock_products(id),primary key(employee_id,product_id));
create table if not exists public.manual_stock_units(id uuid primary key,plan_id uuid not null references public.manual_stock_plans(id),cipher text not null,fingerprint text not null,state text not null default 'AVAILABLE' check(state in ('AVAILABLE','TAKEN','QUARANTINED','DISABLED')),taken_by uuid references public.employee_accounts(id),taken_at timestamptz,allocation_id uuid,created_at timestamptz not null default now(),unique(plan_id,fingerprint));
create index if not exists manual_stock_available on public.manual_stock_units(plan_id,created_at,id) where state='AVAILABLE';
create table if not exists public.manual_stock_allocations(id uuid primary key,employee_id uuid not null references public.employee_accounts(id),unit_id uuid not null references public.manual_stock_units(id),plan_id uuid not null references public.manual_stock_plans(id),request_key uuid not null,snapshot jsonb not null,secret_cipher text not null,created_at timestamptz not null default now(),recalled_at timestamptz,acknowledged_at timestamptz,unique(employee_id,request_key));
create table if not exists public.manual_stock_requests(actor text not null,key uuid not null,payload jsonb not null,result jsonb not null,primary key(actor,key));
create table if not exists public.manual_stock_audit(id bigint generated always as identity primary key,actor text not null,action text not null,entity_id uuid,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table if not exists public.manual_stock_sessions(token_hash text primary key,employee_id uuid not null references public.employee_accounts(id),version integer not null,expires_at timestamptz not null,created_at timestamptz not null default now());
create or replace function public.manual_stock_audit_immutable() returns trigger language plpgsql as $$begin raise exception 'AUDIT_IMMUTABLE';end$$;
drop trigger if exists manual_stock_audit_immutable on public.manual_stock_audit;
create trigger manual_stock_audit_immutable before update or delete on public.manual_stock_audit for each row execute function public.manual_stock_audit_immutable();
create or replace function public.manual_stock_action(p_action text,p_actor text,p_employee uuid default null,p_key uuid default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; old manual_stock_requests%rowtype; u manual_stock_units%rowtype; a manual_stock_allocations%rowtype; p manual_stock_plans%rowtype; x uuid; y uuid; label text; payload jsonb:=jsonb_build_object('fingerprint',md5(jsonb_build_object('action',p_action,'data',p_data-'cipher'-'passwordHash')::text));
begin
 if not coalesce((select enabled from manual_stock_release where id),false) then raise exception 'MANUAL_STOCK_DISABLED';end if;
 if p_employee is not null then
  perform 1 from employee_accounts where id=p_employee and active for update;if not found then raise exception 'FORBIDDEN';end if;
  if p_action not in ('catalog','history','claim','allocation','acknowledge') then raise exception 'FORBIDDEN';end if;
 end if;
 if p_action='catalog' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'image',r.image,'active',r.active,'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',pl.id,'name',pl.name,'duration',pl.duration,'active',pl.active,'template',case when p_employee is null then pl.template else null end,'available',(select count(*) from manual_stock_units s where s.plan_id=pl.id and s.state='AVAILABLE')) order by pl.created_at,pl.id),'[]') from manual_stock_plans pl where pl.product_id=r.id and (p_employee is null or pl.active))) order by r.created_at,r.id),'[]') into v from manual_stock_products r where p_employee is null or (r.active and exists(select 1 from manual_stock_permissions m where m.product_id=r.id and m.employee_id=p_employee));return v;
 elsif p_action='history' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v from (select al.id,al.employee_id,e.display_name employee_name,al.snapshot->>'productName' product_name,al.snapshot->>'planName' plan_name,al.created_at,al.recalled_at from manual_stock_allocations al join employee_accounts e on e.id=al.employee_id where p_employee is null or al.employee_id=p_employee order by al.created_at desc,al.id limit 100)t;return v;
 elsif p_action='allocation' then
  select * into a from manual_stock_allocations where id=(p_data->>'id')::uuid and (p_employee is null or employee_id=p_employee);if not found then raise exception 'FORBIDDEN';end if;
  insert into manual_stock_audit(actor,action,entity_id)values(p_actor,'allocation.viewed',a.id);
  return to_jsonb(a)||jsonb_build_object('remaining',(select count(*) from manual_stock_units where plan_id=a.plan_id and state='AVAILABLE'));
 elsif p_action='units' and p_employee is null then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v from (select id,plan_id,state,taken_by,taken_at,allocation_id,created_at from manual_stock_units where plan_id=(p_data->>'planId')::uuid order by created_at desc,id limit 200)t;return v;
 elsif p_action='unit' and p_employee is null then
  select * into u from manual_stock_units where id=(p_data->>'id')::uuid;if not found then raise exception 'NOT_FOUND';end if;insert into manual_stock_audit(actor,action,entity_id)values(p_actor,'unit.viewed',u.id);return to_jsonb(u);
 elsif p_action='permissions' and p_employee is null then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v from (select employee_id,product_id from manual_stock_permissions order by employee_id,product_id)t;return v;
 elsif p_action='audit' and p_employee is null then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v from(select * from manual_stock_audit order by id desc limit 100)t;return v;
 end if;
 if p_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('manual-stock:'||p_actor||':'||p_key::text,0));
 select * into old from manual_stock_requests where actor=p_actor and key=p_key;
 if found then if old.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return old.result;end if;
 if p_action='claim' and p_employee is not null then
  select pl.* into p from manual_stock_plans pl join manual_stock_products pr on pr.id=pl.product_id join manual_stock_permissions pm on pm.product_id=pr.id and pm.employee_id=p_employee where pl.id=(p_data->>'planId')::uuid and pl.active and pr.active for share of pl,pr,pm;
  if not found then raise exception 'FORBIDDEN';end if;
  select * into a from manual_stock_allocations where employee_id=p_employee and acknowledged_at is null and recalled_at is null order by created_at desc limit 1;
  if found then if a.plan_id<>p.id then raise exception 'OPEN_ALLOCATION_EXISTS';end if;x:=a.id;y:=a.unit_id;
  else
   select * into u from manual_stock_units where plan_id=p.id and state='AVAILABLE' order by created_at,id for update skip locked limit 1;if not found then raise exception 'STOCK_EMPTY';end if;
   x:=gen_random_uuid();select name into label from manual_stock_products where id=p.product_id;
   insert into manual_stock_allocations(id,employee_id,unit_id,plan_id,request_key,snapshot,secret_cipher)values(x,p_employee,u.id,p.id,p_key,jsonb_build_object('productName',label,'planName',p.name,'duration',p.duration,'template',p.template),u.cipher);
   update manual_stock_units set state='TAKEN',taken_by=p_employee,taken_at=clock_timestamp(),allocation_id=x where id=u.id;y:=u.id;
  end if;
  v:=jsonb_build_object('id',x);
 elsif p_action='acknowledge' and p_employee is not null then
  x:=(p_data->>'id')::uuid;update manual_stock_allocations set acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) where id=x and employee_id=p_employee;if not found then raise exception 'FORBIDDEN';end if;v:=jsonb_build_object('ok',true,'id',x);
 elsif p_employee is null then
  x:=(p_data->>'id')::uuid;
  if p_action='account.create' then
   insert into employee_accounts(id,login,display_name,password_hash,manual_only)values(x,p_data->>'login',p_data->>'name',p_data->>'passwordHash',true);
  elsif p_action='account.control' then
   if p_data->>'operation' not in ('enable','disable','revoke')then raise exception 'FORBIDDEN';end if;
   update employee_accounts set active=case p_data->>'operation' when 'enable' then true when 'disable' then false else active end,session_version=session_version+1 where id=x and manual_only;if not found then raise exception 'FORBIDDEN';end if;
  elsif p_action='product.save' then
   insert into manual_stock_products(id,name,image,active)values(x,p_data->>'name',coalesce(p_data->>'image',''),coalesce((p_data->>'active')::boolean,true))on conflict(id)do update set name=excluded.name,image=excluded.image,active=excluded.active;
  elsif p_action='plan.save' then
   insert into manual_stock_plans(id,product_id,name,duration,template,active)values(x,(p_data->>'productId')::uuid,p_data->>'name',p_data->>'duration',p_data->>'template',coalesce((p_data->>'active')::boolean,true))on conflict(id)do update set name=excluded.name,duration=excluded.duration,template=excluded.template,active=excluded.active;
  elsif p_action='permission.save' then
   perform 1 from employee_accounts where id=(p_data->>'employeeId')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
   if (p_data->>'allowed')::boolean then insert into manual_stock_permissions values((p_data->>'employeeId')::uuid,(p_data->>'productId')::uuid)on conflict do nothing;else delete from manual_stock_permissions where employee_id=(p_data->>'employeeId')::uuid and product_id=(p_data->>'productId')::uuid;end if;
   x:=(p_data->>'employeeId')::uuid;
  elsif p_action='unit.save' then
   select * into u from manual_stock_units where id=x for update;
   if found then
    if u.state not in ('AVAILABLE','QUARANTINED','DISABLED') or u.plan_id<>(p_data->>'planId')::uuid then raise exception 'UNIT_NOT_EDITABLE';end if;
    if u.state='QUARANTINED' and coalesce((p_data->>'release')::boolean,false) and (not coalesce((p_data->>'confirmed')::boolean,false) or u.fingerprint=p_data->>'fingerprint')then raise exception 'NEW_CREDENTIALS_REQUIRED';end if;
    update manual_stock_units set cipher=p_data->>'cipher',fingerprint=p_data->>'fingerprint',state=case when coalesce((p_data->>'release')::boolean,false)then 'AVAILABLE' else state end where id=x;
   else insert into manual_stock_units(id,plan_id,cipher,fingerprint)values(x,(p_data->>'planId')::uuid,p_data->>'cipher',p_data->>'fingerprint');end if;
  elsif p_action='unit.disable' then
   update manual_stock_units set state='DISABLED' where id=x and state='AVAILABLE';if not found then raise exception 'UNIT_NOT_EDITABLE';end if;
  elsif p_action='allocation.recall' then
   if not coalesce((p_data->>'confirmed')::boolean,false)then raise exception 'CONFIRMATION_REQUIRED';end if;
   select * into a from manual_stock_allocations where id=x for update;if not found then raise exception 'NOT_FOUND';end if;
   if a.recalled_at is null then update manual_stock_units set state='QUARANTINED' where id=a.unit_id and allocation_id=a.id and state='TAKEN';update manual_stock_allocations set recalled_at=clock_timestamp()where id=x;end if;
   y:=a.unit_id;
  else raise exception 'FORBIDDEN';end if;
  v:=jsonb_build_object('id',x,'ok',true);
 else raise exception 'FORBIDDEN';end if;
 -- Never persist secrets/ciphertext, template text or customer data in the audit/idempotency payload.
 insert into manual_stock_audit(actor,action,entity_id,metadata)values(p_actor,p_action,coalesce(y,x),jsonb_build_object('employeeId',p_employee,'allocationId',case when p_action='claim' then x end,'operation',case when p_action='account.control' then p_data->>'operation' end));
 insert into manual_stock_requests values(p_actor,p_key,payload,v);
 return v;
end$$;
-- Compare request digests on retry (including encrypted unit updates, without storing them twice).
-- This function wrapper is intentionally not exposed to browser database roles.
do $$declare t text;begin foreach t in array array['manual_stock_release','manual_stock_products','manual_stock_plans','manual_stock_permissions','manual_stock_units','manual_stock_allocations','manual_stock_requests','manual_stock_audit','manual_stock_sessions']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
revoke all on function public.manual_stock_action(text,text,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.manual_stock_action(text,text,uuid,uuid,jsonb)to service_role;
grant usage,select on sequence public.manual_stock_audit_id_seq to service_role;
notify pgrst,'reload schema';
commit;
