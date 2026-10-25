-- Receipt technical validation; NEVER a payment approval. Run manually after backup review.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(714026001);
do $$begin if employee_system_ready() not in (5,6) then raise exception 'SCHEMA_5_REQUIRED';end if;end$$;
lock table payment_orders,payment_reservations,payment_settings in share mode;
create schema if not exists receipt_release_20261025;
revoke all on schema receipt_release_20261025 from public,anon,authenticated,service_role;
create table if not exists receipt_release_20261025.manifest(table_name text primary key,row_count bigint not null,captured_at timestamptz not null default clock_timestamp());
create table if not exists receipt_release_20261025.functions(name text primary key,definition text not null);
insert into receipt_release_20261025.functions select p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='employee_system_ready' on conflict do nothing;
do $$declare t text;r record;n bigint;begin foreach t in array array['payment_orders','payment_reservations','payment_settings'] loop
 if to_regclass('receipt_release_20261025.'||t) is null then execute format('create table receipt_release_20261025.%I as table public.%I',t,t);end if;
 execute format('insert into receipt_release_20261025.manifest select %L,count(*),clock_timestamp() from receipt_release_20261025.%I on conflict do nothing',t,t);
end loop;if(select count(*) from receipt_release_20261025.manifest)<>3 then raise exception 'BACKUP_INCOMPLETE';end if;
for r in select * from receipt_release_20261025.manifest loop execute format('select count(*) from receipt_release_20261025.%I',r.table_name) into n;if n<>r.row_count then raise exception 'BACKUP_MISMATCH';end if;end loop;end$$;
revoke all on all tables in schema receipt_release_20261025 from public,anon,authenticated,service_role;
create table if not exists public.receipt_inspections(
 id uuid primary key default gen_random_uuid(),reservation_id uuid not null references payment_reservations(id),order_id uuid references payment_orders(id),
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),status text not null check(status in ('technical_pass','manual_review','rejected')),
 report_cipher text,phash bit(64),combination_key text,similarity_key text,"similar" boolean not null default false,version integer not null default 1,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 unique(reservation_id,sha256,version));
create table if not exists public.receipt_fingerprint_claims(
 kind text not null check(kind in ('sha256','reference')),fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),
 reservation_id uuid not null references payment_reservations(id),inspection_id uuid references receipt_inspections(id),order_id uuid references payment_orders(id),expires_at timestamptz,
 primary key(kind,fingerprint));
alter table receipt_inspections enable row level security;alter table receipt_fingerprint_claims enable row level security;
revoke all on receipt_inspections,receipt_fingerprint_claims from public,anon,authenticated,service_role;
grant select on receipt_inspections,receipt_fingerprint_claims to service_role;
create index if not exists receipt_inspection_order_idx on receipt_inspections(order_id);
create index if not exists receipt_combination_idx on receipt_inspections(combination_key) where combination_key is not null;
create index if not exists receipt_similarity_idx on receipt_inspections(similarity_key) where similarity_key is not null;
-- Import only irreversible historical SHA identities; never change/reconcile old orders.
insert into receipt_fingerprint_claims(kind,fingerprint,reservation_id,order_id)
select distinct on(receipt_sha256) 'sha256',receipt_sha256,reservation_id,id from payment_orders where receipt_sha256~'^[a-f0-9]{64}$' order by receipt_sha256,created_at,id on conflict do nothing;
alter table payment_orders add column if not exists receipt_inspection_id uuid references receipt_inspections(id),add column if not exists receipt_validation_required boolean not null default false,
 add column if not exists bank_credit_verified_at timestamptz,add column if not exists bank_credit_verified_by text;
create or replace function public.receipt_register(p_reservation uuid,p_sha text,p_status text,p_cipher text,p_keys jsonb,p_phash text default null,p_combination text default null,p_similarity text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r payment_reservations%rowtype;s receipt_inspections%rowtype;c receipt_fingerprint_claims%rowtype;k jsonb;similar_receipt boolean;begin
 perform pg_advisory_xact_lock(714026001);
 select * into r from payment_reservations where id=p_reservation for update;
 if not found or r.status<>'reserved' or r.expires_at<=clock_timestamp() then raise exception 'RECEIPT_RESERVATION_INVALID';end if;
 select * into s from receipt_inspections where reservation_id=p_reservation and sha256=p_sha and version=1;if found then return jsonb_build_object('id',s.id,'status',s.status,'similar',s."similar");end if;
 if p_status not in ('technical_pass','manual_review','rejected') or p_sha!~'^[a-f0-9]{64}$' or length(p_cipher)>12000 or p_cipher is null or jsonb_typeof(p_keys)<>'array' or jsonb_array_length(p_keys)>3 then raise exception 'INVALID_RECEIPT_INSPECTION';end if;
 if p_phash is not null and p_phash!~'^[a-f0-9]{16}$' then raise exception 'INVALID_RECEIPT_INSPECTION';end if;
 if p_combination is not null and p_combination!~'^[a-f0-9]{64}$' then raise exception 'INVALID_RECEIPT_INSPECTION';end if;
 if p_similarity is not null and p_similarity!~'^[a-f0-9]{64}$' then raise exception 'INVALID_RECEIPT_INSPECTION';end if;
 if p_status<>'rejected' and not exists(select 1 from jsonb_array_elements(p_keys) item where item->>'kind'='sha256' and item->>'key'=p_sha) then raise exception 'INVALID_RECEIPT_INSPECTION';end if;
 similar_receipt:=exists(select 1 from receipt_inspections x where x.reservation_id<>p_reservation and x.status<>'rejected' and x.combination_key=p_combination and (x.order_id is not null or x.expires_at>clock_timestamp()));
 -- pHash is a similarity signal, not proof: bank templates can legitimately look alike.
 if p_phash is not null and p_similarity is not null then similar_receipt:=similar_receipt or exists(select 1 from receipt_inspections x where x.reservation_id<>p_reservation and x.status<>'rejected' and x.phash is not null and x.similarity_key=p_similarity and bit_count(x.phash # ('x'||p_phash)::bit(64))<=8 and (x.order_id is not null or x.expires_at>clock_timestamp()));end if;
 if p_status<>'rejected' then for k in select * from jsonb_array_elements(p_keys) loop
  if k->>'kind' not in ('sha256','reference') or (k->>'key')!~'^[a-f0-9]{64}$' then raise exception 'INVALID_RECEIPT_INSPECTION';end if;
  select * into c from receipt_fingerprint_claims where kind=k->>'kind' and fingerprint=k->>'key' for update;
  if found and c.reservation_id<>p_reservation then
   if c.order_id is not null or exists(select 1 from payment_orders where reservation_id=c.reservation_id) or exists(select 1 from payment_reservations pr where pr.id=c.reservation_id and pr.status in ('reserved','reviewing') and pr.expires_at>clock_timestamp() and c.expires_at>clock_timestamp()) then raise exception 'RECEIPT_DUPLICATE';end if;
   delete from receipt_fingerprint_claims where kind=k->>'kind' and fingerprint=k->>'key';
  end if;
 end loop;end if;
 insert into receipt_inspections(reservation_id,sha256,status,report_cipher,phash,combination_key,similarity_key,"similar",expires_at)
 values(p_reservation,p_sha,case when similar_receipt and p_status='technical_pass' then 'manual_review' else p_status end,p_cipher,case when p_phash is null then null else ('x'||p_phash)::bit(64) end,p_combination,p_similarity,similar_receipt,r.expires_at+interval '1 hour') returning * into s;
 if p_status<>'rejected' then for k in select * from jsonb_array_elements(p_keys) loop
 insert into receipt_fingerprint_claims(kind,fingerprint,reservation_id,inspection_id,expires_at) values(k->>'kind',k->>'key',p_reservation,s.id,s.expires_at) on conflict(kind,fingerprint) do update set inspection_id=excluded.inspection_id,expires_at=excluded.expires_at;
 end loop;end if;
 insert into payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system','receipt-validator','receipt.technical_check','receipt_inspection',s.id::text,jsonb_build_object('status',s.status,'version',1));
 return jsonb_build_object('id',s.id,'status',s.status,'similar',s."similar");
end;$$;
create or replace function public.receipt_submit_order(p_inspection uuid,p_reservation_id uuid,p_checkout_key uuid,p_product_id text,p_plan_id text,p_product_title text,p_plan_name text,p_receipt_bucket text,p_receipt_path text,p_receipt_mime text,p_receipt_size integer,p_receipt_sha256 text,p_duration_months integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s receipt_inspections%rowtype;v jsonb;oid uuid;begin
 perform pg_advisory_xact_lock(714026001);
 select * into s from receipt_inspections where id=p_inspection for update;
 if not found or s.reservation_id<>p_reservation_id or s.sha256<>p_receipt_sha256 or s.status='rejected' or s.expires_at<=clock_timestamp() and s.order_id is null then raise exception 'RECEIPT_INSPECTION_REQUIRED';end if;
 v:=submit_payment_order_v2(p_reservation_id,p_checkout_key,p_product_id,p_plan_id,p_product_title,p_plan_name,p_receipt_bucket,p_receipt_path,p_receipt_mime,p_receipt_size,p_receipt_sha256,p_duration_months);oid:=(v->>'id')::uuid;
 if exists(select 1 from payment_orders where id=oid and receipt_inspection_id is not null and receipt_inspection_id<>s.id) then raise exception 'RECEIPT_INSPECTION_REQUIRED';end if;
 update payment_orders set receipt_inspection_id=s.id,receipt_validation_required=true where id=oid and (receipt_inspection_id is null or receipt_inspection_id=s.id);
 update receipt_inspections set order_id=oid where id=s.id;update receipt_fingerprint_claims set order_id=oid,expires_at=null where inspection_id=s.id;
 return v;
end;$$;
create or replace function public.receipt_approval_guard() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.receipt_validation_required and new.status in ('approved','completed') and old.status not in ('approved','completed') and (new.bank_credit_verified_at is null or nullif(new.bank_credit_verified_by,'') is null) then raise exception 'BANK_CREDIT_CONFIRMATION_REQUIRED';end if;return new;end;$$;
drop trigger if exists receipt_approval_guard on payment_orders;
create trigger receipt_approval_guard before update of status on payment_orders for each row execute function receipt_approval_guard();
create or replace function public.receipt_approve_direct(p_order_id uuid,p_duration_months integer,p_actor text,p_confirm boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare o payment_orders%rowtype;begin select * into o from payment_orders where id=p_order_id for update;if not found then raise exception 'ORDER_NOT_FOUND';end if;
 if o.receipt_validation_required and o.status not in ('approved','completed') then if not p_confirm or nullif(trim(p_actor),'') is null then raise exception 'BANK_CREDIT_CONFIRMATION_REQUIRED';end if;update payment_orders set bank_credit_verified_at=clock_timestamp(),bank_credit_verified_by=p_actor where id=p_order_id;end if;
 return employee_approve_direct(p_order_id,p_duration_months,p_actor);end;$$;
create or replace function public.receipt_employee_order_action(p_order uuid,p_action text,p_role text,p_actor text,p_employee uuid,p_key uuid,p_quantity integer default 1,p_details jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare o payment_orders%rowtype;begin
 if p_action='complete' and p_role<>'admin' then raise exception 'FORBIDDEN';end if;
 select * into o from payment_orders where id=p_order for update;
 if p_action='complete' and o.receipt_validation_required and o.status not in ('approved','completed') then
 if coalesce((p_details->>'bankCreditConfirmed')::boolean,false) is not true or nullif(trim(p_actor),'') is null then raise exception 'BANK_CREDIT_CONFIRMATION_REQUIRED';end if;
 update payment_orders set bank_credit_verified_at=clock_timestamp(),bank_credit_verified_by=p_actor where id=p_order;end if;
 return employee_order_action_v4(p_order,p_action,p_role,p_actor,p_employee,p_key,p_quantity,p_details);end;$$;
create or replace function public.receipt_scrub_expired() returns integer language plpgsql security definer set search_path=public as $$declare n integer;begin
 update receipt_inspections s set report_cipher=null,phash=null,combination_key=null,similarity_key=null where report_cipher is not null and (s.order_id is not null and exists(select 1 from payment_orders o where o.id=s.order_id and o.receipt_deleted_at is not null) or s.order_id is null and s.expires_at<clock_timestamp());get diagnostics n=row_count;return n;end;$$;
create or replace function public.receipt_validation_ready() returns integer language sql stable security definer set search_path=public as $$select 1;$$;
create or replace function public.employee_system_ready() returns integer language sql stable security definer set search_path=public as $$select 6;$$;
do $$declare r record;begin for r in select p.oid::regprocedure::text as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'receipt_%' loop execute 'revoke all on function '||r.name||' from public,anon,authenticated';execute 'grant execute on function '||r.name||' to service_role';end loop;end$$;
commit;
select employee_system_ready() as employee_schema_version;
select * from receipt_release_20261025.manifest order by table_name;
