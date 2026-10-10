-- Product detail statistics only. No catalog/order/media UPDATE, DELETE or storage changes.
begin;
create table if not exists public.product_sales_settings (
  id smallint primary key check (id = 1),
  historical_total integer not null default 10000 check (historical_total = 10000),
  initialized_at timestamptz,
  version integer not null default 0 check (version >= 0)
);
insert into public.product_sales_settings(id) values(1) on conflict(id) do nothing;
create table if not exists public.product_sales_baselines (
  product_id text primary key check (length(product_id) between 1 and 150),
  count integer not null check(count >= 0),
  weight integer not null default 1 check(weight > 0)
);
create table if not exists public.product_sales_audit (
  id bigint generated always as identity primary key,
  actor text not null,
  changed_at timestamptz not null default now(),
  operation text not null check(operation in ('initialize','edit')),
  version integer not null,
  before_values jsonb not null,
  after_values jsonb not null
);
-- Replace only an earlier version of this feature's index, without changing order rows.
do $$
begin
  if exists(select 1 from pg_index where indexrelid = to_regclass('public.payment_orders_product_completed_sales_idx')
    and pg_get_expr(indpred, indrelid) like '%completed_at%') then
    drop index public.payment_orders_product_completed_sales_idx;
  end if;
end $$;
create index if not exists payment_orders_product_completed_sales_idx
  on public.payment_orders(product_id) where status in ('approved','completed');
alter table public.product_sales_settings enable row level security;
alter table public.product_sales_baselines enable row level security;
alter table public.product_sales_audit enable row level security;
revoke all on public.product_sales_settings, public.product_sales_baselines, public.product_sales_audit from anon, authenticated;
grant select, insert, update on public.product_sales_settings, public.product_sales_baselines to service_role;
grant select, insert on public.product_sales_audit to service_role;
grant usage, select on sequence public.product_sales_audit_id_seq to service_role;

-- Deferred guard also protects the exact total against accidental service-role table edits.
create or replace function public.product_sales_check_total() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if exists(select 1 from public.product_sales_settings where id=1 and initialized_at is not null)
     and (select coalesce(sum(count),0) from public.product_sales_baselines) <> 10000 then
    raise exception 'SALES_TOTAL_INVALID';
  end if;
  return null;
end $$;
drop trigger if exists product_sales_baseline_total_guard on public.product_sales_baselines;
create constraint trigger product_sales_baseline_total_guard after insert or update or delete on public.product_sales_baselines
  deferrable initially deferred for each row execute function public.product_sales_check_total();
drop trigger if exists product_sales_settings_total_guard on public.product_sales_settings;
create constraint trigger product_sales_settings_total_guard after insert or update on public.product_sales_settings
  deferrable initially deferred for each row execute function public.product_sales_check_total();

create or replace function public.product_sales_snapshot() returns jsonb
language sql security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'historicalTotal',s.historical_total,'initializedAt',s.initialized_at,'version',s.version,
    'distributed',(select coalesce(sum(count),0) from public.product_sales_baselines),
    'baselines',coalesce((select jsonb_agg(jsonb_build_object('product_id',b.product_id,'count',b.count) order by b.product_id) from public.product_sales_baselines b),'[]'::jsonb),
    'real',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select product_id,count(*) as count from public.payment_orders where status in ('approved','completed') group by product_id) r),'[]'::jsonb),
    'realTotal',(select count(*) from public.payment_orders where status in ('approved','completed'))
  ) from public.product_sales_settings s where s.id=1;
$$;

create or replace function public.product_sales_validate(p_allocation jsonb) returns void
language plpgsql set search_path = pg_catalog, public as $$
declare n integer; distinct_n integer; total bigint;
begin
  if jsonb_typeof(p_allocation) is distinct from 'array' or jsonb_array_length(p_allocation) not between 1 and 1000 then
    raise exception 'SALES_PRODUCTS_INVALID';
  end if;
  if exists(select 1 from jsonb_array_elements(p_allocation) x where
    jsonb_typeof(x->'product_id') is distinct from 'string' or length(x->>'product_id') not between 1 and 150 or
    jsonb_typeof(x->'count') is distinct from 'number' or (x->>'count') !~ '^[0-9]+$') then
    raise exception 'SALES_PRODUCTS_INVALID';
  end if;
  select count(*), count(distinct x->>'product_id'),sum((x->>'count')::bigint) into n,distinct_n,total
    from jsonb_array_elements(p_allocation) x;
  if n<>distinct_n then raise exception 'SALES_PRODUCTS_INVALID'; end if;
  if total<>10000 then raise exception 'SALES_TOTAL_INVALID'; end if;
end $$;

create or replace function public.product_sales_initialize(p_allocation jsonb,p_actor text) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare settings public.product_sales_settings%rowtype;
begin
  select * into settings from public.product_sales_settings where id=1 for update;
  if settings.initialized_at is not null then return false; end if;
  if p_actor is null or length(trim(p_actor))=0 then raise exception 'SALES_PRODUCTS_INVALID'; end if;
  perform public.product_sales_validate(p_allocation);
  if exists(select 1 from public.product_sales_baselines) then raise exception 'SALES_PRODUCTS_INVALID'; end if;
  insert into public.product_sales_baselines(product_id,count,weight)
    select x->>'product_id',(x->>'count')::integer,case when x->>'product_id' in ('capcut','spotify','netflix') then 5 else 1 end
      from jsonb_array_elements(p_allocation) x;
  update public.product_sales_settings set initialized_at=now(),version=1 where id=1;
  insert into public.product_sales_audit(actor,operation,version,before_values,after_values)
    values(p_actor,'initialize',1,'[]'::jsonb,p_allocation);
  return true;
end $$;

create or replace function public.product_sales_save(p_allocation jsonb,p_actor text,p_version integer) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare settings public.product_sales_settings%rowtype; previous jsonb;
begin
  select * into settings from public.product_sales_settings where id=1 for update;
  if settings.initialized_at is null then raise exception 'SALES_NOT_INITIALIZED'; end if;
  if settings.version<>p_version or p_version is null then raise exception 'SALES_VERSION_CONFLICT'; end if;
  if p_actor is null or length(trim(p_actor))=0 then raise exception 'SALES_PRODUCTS_INVALID'; end if;
  perform public.product_sales_validate(p_allocation);
  if exists(select 1 from public.product_sales_baselines b where not exists
    (select 1 from jsonb_array_elements(p_allocation) x where x->>'product_id'=b.product_id)) then
    raise exception 'SALES_PRODUCTS_INVALID';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'count',count) order by product_id),'[]'::jsonb)
    into previous from public.product_sales_baselines;
  if previous = (select jsonb_agg(jsonb_build_object('product_id',x->>'product_id','count',(x->>'count')::integer) order by x->>'product_id') from jsonb_array_elements(p_allocation) x) then return false; end if;
  insert into public.product_sales_baselines(product_id,count)
    select x->>'product_id',(x->>'count')::integer from jsonb_array_elements(p_allocation) x
    on conflict(product_id) do update set count=excluded.count;
  update public.product_sales_settings set version=version+1 where id=1;
  insert into public.product_sales_audit(actor,operation,version,before_values,after_values)
    values(p_actor,'edit',settings.version+1,previous,p_allocation);
  return true;
end $$;
revoke all on function public.product_sales_snapshot(),public.product_sales_initialize(jsonb,text),public.product_sales_save(jsonb,text,integer),public.product_sales_validate(jsonb),public.product_sales_check_total() from public,anon,authenticated;
grant execute on function public.product_sales_snapshot(),public.product_sales_initialize(jsonb,text),public.product_sales_save(jsonb,text,integer) to service_role;
commit;
