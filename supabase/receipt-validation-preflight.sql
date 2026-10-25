-- Read-only, no customer data returned. Correct Supabase project / postgres database / SQL Editor.
begin transaction read only;
select current_database() as database_name,current_user as verifier,current_setting('server_version_num')::integer as postgres_version_num,public.employee_system_ready() as employee_schema_version;
do $$declare fn text;r record;receipt_version integer;begin
 if current_setting('server_version_num')::integer<140000 then raise exception 'POSTGRES_14_PLUS_REQUIRED';end if;
 if public.employee_system_ready() not in (5,6) then raise exception 'SCHEMA_5_OR_6_REQUIRED';end if;
 foreach fn in array array['public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer)','public.employee_approve_direct(uuid,integer,text)','public.employee_order_action_v4(uuid,text,text,text,uuid,uuid,integer,jsonb)'] loop
  if to_regprocedure(fn) is null then raise exception 'RECEIPT_DEPENDENCY_MISSING: %',fn;end if;
  if not exists(select 1 from pg_proc where oid=to_regprocedure(fn) and prorettype='jsonb'::regtype and prosecdef) then raise exception 'RECEIPT_DEPENDENCY_CONTRACT_MISMATCH: %',fn;end if;
 end loop;
 for r in select * from (values
 ('payment_orders','id','uuid'),('payment_orders','reservation_id','uuid'),('payment_orders','receipt_sha256','text'),('payment_orders','status','text'),('payment_orders','receipt_deleted_at','timestamp with time zone'),('payment_orders','completed_at','timestamp with time zone'),('payment_orders','created_at','timestamp with time zone'),
 ('payment_reservations','id','uuid'),('payment_reservations','status','text'),('payment_reservations','expires_at','timestamp with time zone'),('payment_reservations','created_at','timestamp with time zone'),
 ('payment_settings','id','boolean'),('payment_audit_log','actor_type','text'),('payment_audit_log','actor_ref','text'),('payment_audit_log','action','text'),('payment_audit_log','entity_type','text'),('payment_audit_log','entity_id','text'),('payment_audit_log','metadata','jsonb')
 ) x(tab,col,typ) loop
  if not exists(select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||r.tab) and a.attname=r.col and not a.attisdropped and format_type(a.atttypid,a.atttypmod)=r.typ) then raise exception 'RECEIPT_COLUMN_MISMATCH: %.%',r.tab,r.col;end if;
 end loop;
 if not exists(select 1 from pg_attribute where attrelid='public.payment_orders'::regclass and attname='reservation_id' and attnotnull) then raise exception 'LEGACY_RESERVATION_NULLABILITY_REVIEW_REQUIRED';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.payment_orders'::regclass and confrelid='public.payment_reservations'::regclass and contype='f') then raise exception 'RESERVATION_FK_MISSING';end if;
 if not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls) or not exists(select 1 from pg_roles where rolname='anon') or not exists(select 1 from pg_roles where rolname='authenticated') then raise exception 'SUPABASE_ROLES_REVIEW_REQUIRED';end if;
 if (to_regclass('public.receipt_inspections') is null)<>(to_regclass('public.receipt_fingerprint_claims') is null) then raise exception 'PARTIAL_RECEIPT_SCHEMA';end if;
 if public.employee_system_ready()=6 then
  if to_regprocedure('public.receipt_validation_ready()') is null then raise exception 'RECEIPT_VERSION_MISSING';end if;
  execute 'select public.receipt_validation_ready()' into receipt_version;
  if receipt_version<>1 then raise exception 'RECEIPT_VERSION_MISMATCH';end if;
 end if;
end$$;
select p.oid::regprocedure::text as dependency,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition_sha256 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('employee_system_ready','submit_payment_order_v2','employee_approve_direct','employee_order_action_v4') order by 1;
select 'RECEIPT_PREFLIGHT_OK' as verification;
rollback;
