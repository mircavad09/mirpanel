-- Run in the correct Supabase production project's SQL Editor as postgres/owner.
-- Read-only. Before app cutover, current_original_columns_match_snapshot must be true.
begin transaction read only;
select current_database() as database_name,current_user as verifier,employee_system_ready() as employee_schema_version,receipt_validation_ready() as receipt_validation_version;
select table_name,row_count,captured_at,content_sha256 from receipt_release_20261025.manifest order by table_name;
do $$declare r record;v jsonb;fn text;role_name text;tab text;begin
 if employee_system_ready()<>6 or receipt_validation_ready()<>1 then raise exception 'EXPECTED_RECEIPT_SCHEMA_6';end if;
 if(select array_agg(table_name order by table_name) from receipt_release_20261025.manifest) is distinct from array['payment_orders','payment_reservations','payment_settings'] then raise exception 'BACKUP_INCOMPLETE';end if;
 for r in select * from receipt_release_20261025.manifest loop
  v:=receipt_release_20261025.fingerprint('receipt_release_20261025',r.table_name,r.column_names);
  if (v->>'count')::bigint<>r.row_count or (v->>'sha256') is distinct from r.content_sha256 then raise exception 'BACKUP_CONTENT_MISMATCH';end if;
 end loop;
 foreach role_name in array array['anon','authenticated'] loop
  foreach tab in array array['receipt_inspections','receipt_fingerprint_claims'] loop
   if has_table_privilege(role_name,'public.'||tab,'select,insert,update,delete') then raise exception 'RECEIPT_PERMISSION_LEAK';end if;
  end loop;
  if has_schema_privilege(role_name,'receipt_release_20261025','USAGE') then raise exception 'SNAPSHOT_PERMISSION_LEAK';end if;
 end loop;
 foreach tab in array array['receipt_inspections','receipt_fingerprint_claims'] loop
  if has_table_privilege('service_role','public.'||tab,'insert,update,delete') then raise exception 'RECEIPT_DIRECT_WRITE_LEAK';end if;
  if not has_table_privilege('service_role','public.'||tab,'select') or not (select relrowsecurity from pg_class where oid=('public.'||tab)::regclass) then raise exception 'RECEIPT_RLS_MISSING';end if;
 end loop;
 foreach fn in array array['receipt_register(uuid,text,text,text,jsonb,text,text,text)','receipt_submit_order(uuid,uuid,uuid,text,text,text,text,text,text,text,integer,text,integer)','receipt_approval_guard()','receipt_approve_direct(uuid,integer,text,boolean)','receipt_employee_order_action(uuid,text,text,text,uuid,uuid,integer,jsonb)','receipt_scrub_expired()','receipt_validation_ready()'] loop
  if not has_function_privilege('service_role','public.'||fn,'execute') or has_function_privilege('anon','public.'||fn,'execute') or has_function_privilege('authenticated','public.'||fn,'execute') then raise exception 'RECEIPT_FUNCTION_PERMISSION_LEAK';end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='public.payment_orders'::regclass and tgname='receipt_approval_guard' and tgenabled='O' and not tgisinternal) then raise exception 'RECEIPT_GUARD_MISSING';end if;
 if not exists(select 1 from pg_constraint c where c.conrelid='public.receipt_inspections'::regclass and c.contype='u' and (select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num)=array['reservation_id','sha256','version'])
 or not exists(select 1 from pg_constraint c where c.conrelid='public.receipt_fingerprint_claims'::regclass and c.contype='p' and (select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num)=array['kind','fingerprint']) then raise exception 'RECEIPT_UNIQUE_GUARD_MISSING';end if;
end$$;
select m.table_name,
 receipt_release_20261025.fingerprint('public',m.table_name,m.column_names)=jsonb_build_object('count',m.row_count,'sha256',m.content_sha256) as current_original_columns_match_snapshot
from receipt_release_20261025.manifest m order by m.table_name;
select case when bool_and(receipt_release_20261025.fingerprint('public',m.table_name,m.column_names)=jsonb_build_object('count',m.row_count,'sha256',m.content_sha256)) then 'RECEIPT_VERIFY_OK' else 'RECEIPT_SOURCE_CHANGED_REVIEW_REQUIRED' end as verification from receipt_release_20261025.manifest m;
rollback;
