begin;

create extension if not exists pgcrypto;

create table if not exists public.payment_methods (
  id uuid primary key,
  stable_code text not null unique check (stable_code ~ '^[a-z0-9_-]+$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  method_type text not null check (method_type in ('bank_card', 'wallet')),
  provider_name text not null check (char_length(provider_name) between 1 and 80),
  holder_name text not null default '' check (char_length(holder_name) <= 120),
  encrypted_number text,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  color text not null default '#151515' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'card' check (icon in ('card', 'wallet', 'bank')),
  active boolean not null default false,
  archived boolean not null default false,
  sort_order integer not null default 1 check (sort_order > 0),
  daily_limit integer not null default 5 check (daily_limit > 0 and daily_limit <= 10000),
  limit_mode text not null default 'limited' check (limit_mode in ('limited', 'unlimited')),
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_method_daily_counters (
  method_id uuid not null references public.payment_methods(id) on delete restrict,
  counter_date date not null,
  confirmed_count integer not null default 0 check (confirmed_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (method_id, counter_date)
);

create table if not exists public.payment_reservations (
  id uuid primary key default gen_random_uuid(),
  method_id uuid not null references public.payment_methods(id) on delete restrict,
  product_id text not null check (char_length(product_id) between 1 and 100),
  plan_id text not null check (char_length(plan_id) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'AZN' check (currency = 'AZN'),
  idempotency_key uuid not null unique,
  status text not null default 'reserved' check (status in ('reserved', 'reviewing', 'completed', 'rejected', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_reservations_capacity_idx
  on public.payment_reservations(method_id, status, expires_at);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique check (order_code ~ '^MP-[A-F0-9]{6}$'),
  reservation_id uuid not null unique references public.payment_reservations(id) on delete restrict,
  method_id uuid not null references public.payment_methods(id) on delete restrict,
  product_id text not null,
  product_title text not null check (char_length(product_title) between 1 and 160),
  plan_id text not null,
  plan_name text not null check (char_length(plan_name) between 1 and 160),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'AZN' check (currency = 'AZN'),
  receipt_bucket text not null,
  receipt_path text not null unique,
  receipt_mime text not null check (receipt_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  receipt_size integer not null check (receipt_size > 0 and receipt_size <= 5242880),
  receipt_sha256 text not null check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  receipt_deleted_at timestamptz,
  status text not null default 'reviewing' check (status in ('reviewing', 'approved', 'rejected', 'new_receipt_requested')),
  admin_note text not null default '' check (char_length(admin_note) <= 4000),
  rejection_reason text not null default '' check (char_length(rejection_reason) <= 2000),
  consent_accepted boolean not null check (consent_accepted),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

create index if not exists payment_orders_created_idx on public.payment_orders(created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders(status, created_at desc);

create table if not exists public.payment_review_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_receipt_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_email_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete cascade,
  recipient text not null,
  subject text not null,
  html_body text not null,
  text_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_email_queue_pending_idx
  on public.payment_email_queue(status, next_attempt_at);

create table if not exists public.payment_audit_log (
  id bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('customer', 'admin', 'system')),
  actor_ref text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_created_idx on public.payment_audit_log(created_at desc);

create table if not exists public.payment_settings (
  id boolean primary key default true check (id),
  notification_email text not null default '',
  receipt_retention_days integer not null default 90 check (receipt_retention_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

insert into public.payment_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.payment_rate_limits (
  rate_key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  expires_at timestamptz not null,
  primary key (rate_key, window_start)
);

alter table public.payment_methods enable row level security;
alter table public.payment_method_daily_counters enable row level security;
alter table public.payment_reservations enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_review_tokens enable row level security;
alter table public.payment_receipt_tokens enable row level security;
alter table public.payment_email_queue enable row level security;
alter table public.payment_audit_log enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payment_rate_limits enable row level security;

insert into public.payment_methods
  (id, stable_code, display_name, method_type, provider_name, last4, color, icon, active, sort_order)
values
  ('00000000-0000-4000-8000-000000004419', 'leobank-4419', 'LeoBank •••• 4419', 'bank_card', 'LeoBank', '4419', '#111111', 'card', false, 1),
  ('00000000-0000-4000-8000-000000004655', 'abb-4655', 'ABB •••• 4655', 'bank_card', 'ABB', '4655', '#092b5c', 'bank', false, 2),
  ('00000000-0000-4000-8000-000000007350', 'leobank-7350', 'LeoBank •••• 7350', 'bank_card', 'LeoBank', '7350', '#111111', 'card', false, 3),
  ('00000000-0000-4000-8000-000000008332', 'kapital-8332', 'Kapital Bank •••• 8332', 'bank_card', 'Kapital Bank', '8332', '#b80f19', 'bank', false, 4),
  ('00000000-0000-4000-8000-000000007663', 'abb-7663', 'ABB •••• 7663', 'bank_card', 'ABB', '7663', '#092b5c', 'bank', false, 5),
  ('00000000-0000-4000-8000-000000000909', 'm10-0909', 'M10 •••• 0909', 'wallet', 'M10', '0909', '#00a99d', 'wallet', false, 6)
on conflict (id) do nothing;

create or replace function public.payment_baku_date(at_time timestamptz default now())
returns date language sql stable as $$
  select (at_time at time zone 'Asia/Baku')::date;
$$;

create or replace function public.expire_payment_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  update payment_reservations
     set status = 'expired', updated_at = now()
   where status = 'reserved' and expires_at <= now();
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.consume_payment_rate_limit(
  p_rate_key text,
  p_window_seconds integer,
  p_max_hits integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_window_seconds < 1 or p_max_hits < 1 then raise exception 'INVALID_RATE_LIMIT'; end if;
  delete from payment_rate_limits where expires_at < now() - interval '5 minutes';
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into payment_rate_limits(rate_key, window_start, hit_count, expires_at)
  values (p_rate_key, v_window, 1, v_window + make_interval(secs => p_window_seconds))
  on conflict (rate_key, window_start) do update set hit_count = payment_rate_limits.hit_count + 1
  returning hit_count into v_count;
  return jsonb_build_object('allowed', v_count <= p_max_hits, 'count', v_count,
    'remaining', greatest(0, p_max_hits - v_count),
    'resetAt', v_window + make_interval(secs => p_window_seconds));
end;
$$;

create or replace function public.reserve_payment_method(
  p_method_id uuid,
  p_product_id text,
  p_plan_id text,
  p_amount numeric,
  p_currency text,
  p_idempotency_key uuid,
  p_minutes integer default 10
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_method payment_methods%rowtype;
  v_existing payment_reservations%rowtype;
  v_confirmed integer := 0;
  v_pending integer := 0;
  v_reservation payment_reservations%rowtype;
begin
  perform expire_payment_reservations();
  select * into v_existing from payment_reservations where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.method_id <> p_method_id or v_existing.product_id <> p_product_id or v_existing.plan_id <> p_plan_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
      'expiresAt', v_existing.expires_at, 'idempotent', true);
  end if;

  select * into v_method from payment_methods where id = p_method_id for update;
  if not found or not v_method.active or v_method.archived or v_method.encrypted_number is null then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;

  select coalesce(confirmed_count, 0) into v_confirmed
    from payment_method_daily_counters
   where method_id = p_method_id and counter_date = payment_baku_date();
  select count(*) into v_pending from payment_reservations
   where method_id = p_method_id and status in ('reserved', 'reviewing')
     and (status = 'reviewing' or expires_at > now());

  if v_method.limit_mode = 'limited' and v_confirmed + v_pending >= v_method.daily_limit then
    raise exception 'PAYMENT_METHOD_LIMIT_REACHED';
  end if;

  insert into payment_reservations(method_id, product_id, plan_id, amount, currency, idempotency_key, expires_at)
  values (p_method_id, p_product_id, p_plan_id, p_amount, p_currency, p_idempotency_key,
    now() + make_interval(mins => greatest(1, least(p_minutes, 30))))
  returning * into v_reservation;

  insert into payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
  values ('customer', 'reservation.created', 'reservation', v_reservation.id::text,
    jsonb_build_object('methodId', p_method_id, 'expiresAt', v_reservation.expires_at));

  return jsonb_build_object('id', v_reservation.id, 'status', v_reservation.status,
    'expiresAt', v_reservation.expires_at, 'idempotent', false);
end;
$$;

create or replace function public.submit_payment_order(
  p_order_code text,
  p_reservation_id uuid,
  p_product_title text,
  p_plan_name text,
  p_receipt_bucket text,
  p_receipt_path text,
  p_receipt_mime text,
  p_receipt_size integer,
  p_receipt_sha256 text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res payment_reservations%rowtype;
  v_order payment_orders%rowtype;
begin
  select * into v_res from payment_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  select * into v_order from payment_orders where reservation_id = p_reservation_id;
  if found then return jsonb_build_object('id', v_order.id, 'orderCode', v_order.order_code, 'status', v_order.status, 'idempotent', true); end if;
  if v_res.status <> 'reserved' or v_res.expires_at <= now() then
    update payment_reservations set status = 'expired', updated_at = now() where id = v_res.id and status = 'reserved';
    raise exception 'RESERVATION_EXPIRED';
  end if;

  insert into payment_orders(order_code, reservation_id, method_id, product_id, product_title,
    plan_id, plan_name, amount, currency, receipt_bucket, receipt_path, receipt_mime,
    receipt_size, receipt_sha256, consent_accepted)
  values (p_order_code, v_res.id, v_res.method_id, v_res.product_id, p_product_title,
    v_res.plan_id, p_plan_name, v_res.amount, v_res.currency, p_receipt_bucket, p_receipt_path,
    p_receipt_mime, p_receipt_size, p_receipt_sha256, true)
  returning * into v_order;
  update payment_reservations set status = 'reviewing', updated_at = now() where id = v_res.id;
  insert into payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
  values ('customer', 'order.submitted', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'methodId', v_order.method_id));
  return jsonb_build_object('id', v_order.id, 'orderCode', v_order.order_code, 'status', v_order.status, 'idempotent', false);
end;
$$;

create or replace function public.approve_payment_order(p_order_id uuid, p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order payment_orders%rowtype; v_method payment_methods%rowtype; v_count integer;
begin
  select * into v_order from payment_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'approved' then return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved', 'idempotent', true); end if;
  if v_order.status not in ('reviewing', 'new_receipt_requested') then raise exception 'ORDER_NOT_REVIEWABLE'; end if;
  select * into v_method from payment_methods where id = v_order.method_id for update;
  insert into payment_method_daily_counters(method_id, counter_date, confirmed_count)
  values (v_method.id, payment_baku_date(), 0)
  on conflict (method_id, counter_date) do nothing;
  select confirmed_count into v_count from payment_method_daily_counters
   where method_id = v_method.id and counter_date = payment_baku_date() for update;
  if v_method.limit_mode = 'limited' and v_count >= v_method.daily_limit then raise exception 'PAYMENT_METHOD_LIMIT_REACHED'; end if;
  update payment_method_daily_counters set confirmed_count = confirmed_count + 1, updated_at = now()
   where method_id = v_method.id and counter_date = payment_baku_date();
  update payment_orders set status = 'approved', approved_at = now(), rejected_at = null, updated_at = now() where id = v_order.id;
  update payment_reservations set status = 'completed', updated_at = now() where id = v_order.reservation_id;
  update payment_review_tokens set used_at = coalesce(used_at, now()) where order_id = v_order.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'order.approved', 'order', v_order.id::text, jsonb_build_object('orderCode', v_order.order_code));
  return jsonb_build_object('orderCode', v_order.order_code, 'status', 'approved', 'idempotent', false, 'confirmedCount', v_count + 1);
end;
$$;

create or replace function public.reject_payment_order(p_order_id uuid, p_reason text, p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order payment_orders%rowtype;
begin
  if char_length(trim(p_reason)) < 3 then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into v_order from payment_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'rejected' then return jsonb_build_object('orderCode', v_order.order_code, 'status', 'rejected', 'idempotent', true); end if;
  if v_order.status = 'approved' then raise exception 'ORDER_ALREADY_APPROVED'; end if;
  update payment_orders set status = 'rejected', rejection_reason = trim(p_reason), rejected_at = now(), updated_at = now() where id = v_order.id;
  update payment_reservations set status = 'rejected', updated_at = now() where id = v_order.reservation_id;
  update payment_review_tokens set used_at = coalesce(used_at, now()) where order_id = v_order.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id, metadata)
  values ('admin', p_actor, 'order.rejected', 'order', v_order.id::text,
    jsonb_build_object('orderCode', v_order.order_code, 'reason', trim(p_reason)));
  return jsonb_build_object('orderCode', v_order.order_code, 'status', 'rejected', 'idempotent', false);
end;
$$;

create or replace function public.cancel_payment_reservation(p_reservation_id uuid, p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_res payment_reservations%rowtype;
begin
  select * into v_res from payment_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_res.status in ('completed', 'rejected', 'cancelled', 'expired') then
    return jsonb_build_object('id', v_res.id, 'status', v_res.status, 'idempotent', true);
  end if;
  update payment_reservations set status = 'cancelled', updated_at = now() where id = v_res.id;
  insert into payment_audit_log(actor_type, actor_ref, action, entity_type, entity_id)
  values ('admin', p_actor, 'reservation.cancelled', 'reservation', v_res.id::text);
  return jsonb_build_object('id', v_res.id, 'status', 'cancelled', 'idempotent', false);
end;
$$;

create or replace function public.claim_payment_email()
returns setof payment_email_queue language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidate as (
    select id from payment_email_queue
     where (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'sending' and locked_at < now() - interval '10 minutes')
     order by created_at
     for update skip locked limit 1
  )
  update payment_email_queue q set status = 'sending', locked_at = now(), attempts = attempts + 1, updated_at = now()
   from candidate where q.id = candidate.id returning q.*;
end;
$$;

create or replace function public.consume_payment_review_token(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_token payment_review_tokens%rowtype;
begin
  select * into v_token from payment_review_tokens
   where token_hash = p_token_hash for update;
  if not found or v_token.used_at is not null or v_token.expires_at <= now() then
    raise exception 'REVIEW_TOKEN_INVALID';
  end if;
  update payment_review_tokens set used_at = now() where id = v_token.id;
  return jsonb_build_object('orderId', v_token.order_id, 'expiresAt', v_token.expires_at);
end;
$$;

create or replace function public.replace_payment_order_receipt(
  p_token_hash text,
  p_receipt_bucket text,
  p_receipt_path text,
  p_receipt_mime text,
  p_receipt_size integer,
  p_receipt_sha256 text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_token payment_receipt_tokens%rowtype; v_order payment_orders%rowtype; v_old_path text;
begin
  select * into v_token from payment_receipt_tokens where token_hash = p_token_hash for update;
  if not found or v_token.used_at is not null or v_token.expires_at <= now() then raise exception 'RECEIPT_TOKEN_INVALID'; end if;
  select * into v_order from payment_orders where id = v_token.order_id for update;
  if not found or v_order.status <> 'new_receipt_requested' then raise exception 'ORDER_NOT_REVIEWABLE'; end if;
  v_old_path := v_order.receipt_path;
  update payment_orders set receipt_bucket = p_receipt_bucket, receipt_path = p_receipt_path,
    receipt_mime = p_receipt_mime, receipt_size = p_receipt_size, receipt_sha256 = p_receipt_sha256,
    receipt_deleted_at = null, status = 'reviewing', updated_at = now() where id = v_order.id;
  update payment_receipt_tokens set used_at = now() where id = v_token.id;
  insert into payment_audit_log(actor_type, action, entity_type, entity_id, metadata)
  values ('customer', 'order.receipt_replaced', 'order', v_order.id::text, jsonb_build_object('orderCode', v_order.order_code));
  return jsonb_build_object('orderId', v_order.id, 'orderCode', v_order.order_code, 'oldPath', v_old_path);
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on function public.payment_baku_date(timestamptz) from public, anon, authenticated;
revoke execute on function public.expire_payment_reservations() from public, anon, authenticated;
revoke execute on function public.consume_payment_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.reserve_payment_method(uuid, text, text, numeric, text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.submit_payment_order(text, uuid, text, text, text, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.approve_payment_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.reject_payment_order(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.cancel_payment_reservation(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_payment_email() from public, anon, authenticated;
revoke execute on function public.consume_payment_review_token(text) from public, anon, authenticated;
revoke execute on function public.replace_payment_order_receipt(text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.consume_payment_rate_limit(text, integer, integer) to service_role;
grant execute on function public.payment_baku_date(timestamptz) to service_role;
grant execute on function public.expire_payment_reservations() to service_role;
grant execute on function public.reserve_payment_method(uuid, text, text, numeric, text, uuid, integer) to service_role;
grant execute on function public.submit_payment_order(text, uuid, text, text, text, text, text, integer, text) to service_role;
grant execute on function public.approve_payment_order(uuid, text) to service_role;
grant execute on function public.reject_payment_order(uuid, text, text) to service_role;
grant execute on function public.cancel_payment_reservation(uuid, text) to service_role;
grant execute on function public.claim_payment_email() to service_role;
grant execute on function public.consume_payment_review_token(text) to service_role;
grant execute on function public.replace_payment_order_receipt(text, text, text, text, integer, text) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('mirpanel-payment-receipts', 'mirpanel-payment-receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
