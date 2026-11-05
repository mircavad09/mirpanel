begin;
-- Additive links only; existing private stock and customer catalog remain untouched.
alter table public.manual_stock_products add column if not exists source_product_id text;
alter table public.manual_stock_plans add column if not exists source_plan_key text;
alter table public.manual_stock_units add column if not exists identity_fingerprint text;
alter table public.manual_stock_units add column if not exists field_names text[];
create unique index if not exists manual_stock_source_product on public.manual_stock_products(source_product_id) where source_product_id is not null;
create unique index if not exists manual_stock_source_plan on public.manual_stock_plans(product_id,source_plan_key) where source_plan_key is not null;
create unique index if not exists manual_stock_unit_identity on public.manual_stock_units(plan_id,identity_fingerprint) where identity_fingerprint is not null;
create table if not exists public.manual_stock_updates(id boolean primary key default true check(id),revision bigint not null default 1);
insert into public.manual_stock_updates values(true,1) on conflict do nothing;
alter table public.manual_stock_updates enable row level security;
revoke all on public.manual_stock_updates from public,anon,authenticated;
grant all on public.manual_stock_updates to service_role;
create or replace function public.manual_stock_changed() returns trigger language plpgsql security definer set search_path=public as $$begin update manual_stock_updates set revision=revision+1 where id;return null;end$$;
do $$declare t text;begin foreach t in array array['manual_stock_products','manual_stock_plans','manual_stock_units','manual_stock_permissions','employee_accounts']loop execute format('drop trigger if exists manual_stock_changed on public.%I',t);execute format('create trigger manual_stock_changed after insert or update or delete on public.%I for each statement execute function public.manual_stock_changed()',t);end loop;end$$;
create or replace function public.manual_stock_intake(p_actor text,p_key uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare old manual_stock_requests%rowtype; payload jsonb; pr uuid; pl uuid; item jsonb; result jsonb; n integer; variable text;
begin
 if not coalesce((select enabled from manual_stock_release where id),false) then raise exception 'MANUAL_STOCK_DISABLED';end if;
 if p_actor not like 'owner:%' or p_key is null then raise exception 'FORBIDDEN';end if;
 if coalesce(p_data->>'sourceProductId','')='' or coalesce(p_data->>'sourcePlanKey','')='' or coalesce(p_data->>'template','')='' then raise exception 'INVALID_INTAKE';end if;
 n:=jsonb_array_length(p_data->'items');if n is null or n<1 or n>100 then raise exception 'INVALID_INTAKE';end if;
 -- Random encryption IVs are excluded; authenticated semantic digest covers all inputs.
 payload:=jsonb_build_object('intakeFingerprint',p_data->>'requestFingerprint');
 perform pg_advisory_xact_lock(hashtextextended('manual-stock:'||p_actor||':'||p_key::text,0));
 select * into old from manual_stock_requests where actor=p_actor and key=p_key;
 if found then if old.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return old.result;end if;
 perform pg_advisory_xact_lock(hashtextextended('manual-source:'||(p_data->>'sourceProductId'),0));
 insert into manual_stock_products(id,name,image,source_product_id) values((p_data->>'productId')::uuid,p_data->>'productName',coalesce(p_data->>'image',''),p_data->>'sourceProductId')
 on conflict(source_product_id) where source_product_id is not null do update set name=excluded.name,image=excluded.image returning id into pr;
 for variable in select m[1] from regexp_matches(p_data->>'template','\{\{\s*(\w+)\s*\}\}','g') m loop
  if variable in ('email','username','login','password','extra') and exists(select 1 from manual_stock_units where plan_id=(p_data->>'planId')::uuid and state='AVAILABLE' and field_names is not null and not(variable=any(field_names))) then raise exception 'MISSING_TEMPLATE_DATA';end if;
 end loop;
 insert into manual_stock_plans(id,product_id,name,duration,template,source_plan_key) values((p_data->>'planId')::uuid,pr,p_data->>'planName',p_data->>'duration',p_data->>'template',p_data->>'sourcePlanKey')
 on conflict(product_id,source_plan_key) where source_plan_key is not null do update set name=excluded.name,duration=excluded.duration,template=excluded.template returning id into pl;
 -- Cipher AAD must match the resolved plan, never a renamed/index-shifted customer plan.
 if pl<>(p_data->>'planId')::uuid then raise exception 'PLAN_LINK_CONFLICT';end if;
 for item in select value from jsonb_array_elements(p_data->'items') loop
  if exists(select 1 from manual_stock_units where plan_id=pl and (fingerprint=item->>'fingerprint' or identity_fingerprint=item->>'identityFingerprint')) then raise exception 'DUPLICATE_ACCOUNT';end if;
  insert into manual_stock_units(id,plan_id,cipher,fingerprint,identity_fingerprint,field_names) values((item->>'id')::uuid,pl,item->>'cipher',item->>'fingerprint',item->>'identityFingerprint',array(select jsonb_array_elements_text(item->'fields')));
 end loop;
 result:=jsonb_build_object('ok',true,'productId',pr,'planId',pl,'saved',n);
 insert into manual_stock_audit(actor,action,entity_id,metadata) values(p_actor,'stock.intake',pl,jsonb_build_object('count',n,'productId',pr));
 insert into manual_stock_requests values(p_actor,p_key,payload,result);
 return result;
exception when unique_violation then raise exception 'DUPLICATE_ACCOUNT';
end$$;
create or replace function public.manual_stock_check_message() returns trigger language plpgsql security definer set search_path=public as $$declare fields text[];variable text;begin
 select field_names into fields from manual_stock_units where id=new.unit_id;
 if fields is not null then for variable in select m[1] from regexp_matches(new.snapshot->>'template','\{\{\s*(\w+)\s*\}\}','g') m loop
  if variable in ('email','username','login','password','extra') and not(variable=any(fields)) then raise exception 'MISSING_TEMPLATE_DATA';end if;
 end loop;end if;return new;
end$$;
drop trigger if exists manual_stock_check_message on public.manual_stock_allocations;
create trigger manual_stock_check_message before insert on public.manual_stock_allocations for each row execute function public.manual_stock_check_message();
revoke all on function public.manual_stock_check_message() from public,anon,authenticated;
create or replace function public.manual_stock_linked_unit(p_actor text,p_key uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if p_actor not like 'owner:%' then raise exception 'FORBIDDEN';end if;
 v:=manual_stock_action('unit.save',p_actor,null,p_key,p_data);
 update manual_stock_units set identity_fingerprint=p_data->>'identityFingerprint',field_names=array(select jsonb_array_elements_text(p_data->'fields')) where id=(v->>'id')::uuid;
 return v;
exception when unique_violation then raise exception 'DUPLICATE_ACCOUNT';
end$$;
revoke all on function public.manual_stock_linked_unit(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manual_stock_linked_unit(text,uuid,jsonb) to service_role;
revoke all on function public.manual_stock_intake(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manual_stock_intake(text,uuid,jsonb) to service_role;
revoke all on function public.manual_stock_changed() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
