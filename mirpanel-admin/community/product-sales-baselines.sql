-- Independent admin starting counts; never alter the delivered-unit reader or sales ledger.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(714025019);
alter table public.product_sales_settings drop constraint if exists product_sales_settings_historical_total_check;
alter table public.product_sales_settings add constraint product_sales_settings_historical_total_check check(historical_total>=0);

create or replace function public.product_sales_check_total() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.product_sales_settings where id=1 and initialized_at is not null
   and historical_total<>(select coalesce(sum(count),0) from public.product_sales_baselines)) then
  raise exception 'SALES_TOTAL_INVALID';
 end if;
 return null;
end $$;

create or replace function public.product_sales_save(p_allocation jsonb,p_actor text,p_version integer) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare settings public.product_sales_settings%rowtype;previous jsonb;canonical jsonb;total bigint;
begin
 select * into settings from public.product_sales_settings where id=1 for update;
 if settings.initialized_at is null then raise exception 'SALES_NOT_INITIALIZED';end if;
 if p_version is null or settings.version<>p_version then raise exception 'SALES_VERSION_CONFLICT';end if;
 if p_actor is null or length(trim(p_actor))=0 then raise exception 'SALES_PRODUCTS_INVALID';end if;
 if jsonb_typeof(p_allocation) is distinct from 'array' or jsonb_array_length(p_allocation) not between 1 and 1000 then
  raise exception 'SALES_PRODUCTS_INVALID';
 end if;
 if exists(select 1 from jsonb_array_elements(p_allocation) x where
  jsonb_typeof(x->'product_id') is distinct from 'string' or length(x->>'product_id') not between 1 and 150 or
  jsonb_typeof(x->'count') is distinct from 'number' or (x->>'count') !~ '^[0-9]+$' or
  length(x->>'count')>10) then raise exception 'SALES_PRODUCTS_INVALID';end if;
 if (select count(*)<>count(distinct x->>'product_id') from jsonb_array_elements(p_allocation) x) then raise exception 'SALES_PRODUCTS_INVALID';end if;
 select sum((x->>'count')::bigint) into total from jsonb_array_elements(p_allocation) x;
 if total>2147483647 then raise exception 'SALES_TOTAL_INVALID';end if;
 if exists(select 1 from public.product_sales_baselines b where not exists
  (select 1 from jsonb_array_elements(p_allocation) x where x->>'product_id'=b.product_id)) then raise exception 'SALES_PRODUCTS_INVALID';end if;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'count',count) order by product_id),'[]'::jsonb)
 into previous from public.product_sales_baselines;
 select jsonb_agg(jsonb_build_object('product_id',x->>'product_id','count',(x->>'count')::integer) order by x->>'product_id')
 into canonical from jsonb_array_elements(p_allocation) x;
 if previous=canonical then return false;end if;
 insert into public.product_sales_baselines(product_id,count)
 select x->>'product_id',(x->>'count')::integer from jsonb_array_elements(canonical) x
 on conflict(product_id) do update set count=excluded.count;
 update public.product_sales_settings set version=version+1,historical_total=total where id=1;
 insert into public.product_sales_audit(actor,operation,version,before_values,after_values)
 values(p_actor,'edit',settings.version+1,previous,canonical);
 return true;
end $$;
revoke all on function public.product_sales_save(jsonb,text,integer),public.product_sales_check_total() from public,anon,authenticated;
grant execute on function public.product_sales_save(jsonb,text,integer) to service_role;
create table if not exists public.product_sales_baseline_release(id boolean primary key default true check(id));
alter table public.product_sales_baseline_release enable row level security;
revoke all on public.product_sales_baseline_release from public,anon,authenticated;
insert into public.product_sales_baseline_release values(true) on conflict do nothing;
notify pgrst,'reload schema';
commit;
