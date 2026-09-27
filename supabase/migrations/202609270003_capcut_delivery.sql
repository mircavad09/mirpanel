begin;

create table if not exists public.capcut_accounts (
  id uuid primary key default gen_random_uuid(),
  email_cipher text not null,
  password_cipher text not null,
  expires_on date not null,
  admin_note text not null default '',
  status text not null default 'available' check (status in ('available','assigned','delivered','cancelled','retired')),
  assigned_order_id uuid unique references public.payment_orders(id),
  assigned_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.capcut_deliveries (
  order_id uuid primary key references public.payment_orders(id) on delete restrict,
  customer_phone text not null,
  token_hash text not null unique,
  token_cipher text not null,
  status text not null default 'waiting' check (status in ('waiting','approved','rejected','cancelled')),
  account_id uuid unique references public.capcut_accounts(id),
  notified_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.capcut_delivery_template (
  singleton boolean primary key default true check (singleton),
  title text not null default 'CapCut Pro hesabınız',
  login_rules text not null default '',
  prohibitions text not null default '',
  support_text text not null default 'Sualınız varsa, dəstəyə yazın.',
  footer_text text not null default 'Mirpanel',
  updated_at timestamptz not null default now()
);
insert into public.capcut_delivery_template(singleton) values(true) on conflict(singleton) do nothing;
create index if not exists capcut_accounts_available_idx on public.capcut_accounts(created_at,id) where status='available';
create index if not exists capcut_deliveries_status_idx on public.capcut_deliveries(status,created_at);

alter table public.capcut_accounts enable row level security;
alter table public.capcut_deliveries enable row level security;
alter table public.capcut_delivery_template enable row level security;
revoke all on public.capcut_accounts, public.capcut_deliveries, public.capcut_delivery_template from public,anon,authenticated;
grant all on public.capcut_accounts, public.capcut_deliveries, public.capcut_delivery_template to service_role;

create or replace function public.approve_capcut_delivery(p_order_id uuid,p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_delivery public.capcut_deliveries%rowtype; v_order public.payment_orders%rowtype; v_account public.capcut_accounts%rowtype; v_payment jsonb;
begin
  select * into v_delivery from public.capcut_deliveries where order_id=p_order_id for update;
  if not found then raise exception 'CAPCUT_DELIVERY_NOT_FOUND'; end if;
  select * into v_order from public.payment_orders where id=p_order_id for update;
  if v_order.product_id <> 'capcut' then raise exception 'CAPCUT_ORDER_REQUIRED'; end if;
  if v_delivery.status='approved' then return jsonb_build_object('status','approved','accountId',v_delivery.account_id,'idempotent',true); end if;
  if v_delivery.status <> 'waiting' or v_order.status <> 'reviewing' then raise exception 'CAPCUT_ORDER_NOT_REVIEWABLE'; end if;
  select * into v_account from public.capcut_accounts where status='available' order by created_at,id for update skip locked limit 1;
  if not found then raise exception 'CAPCUT_STOCK_EMPTY'; end if;
  v_payment:=public.approve_payment_order_v7(p_order_id,v_order.duration_months,p_actor);
  update public.capcut_accounts set status='delivered',assigned_order_id=p_order_id,assigned_at=now(),delivered_at=now(),updated_at=now() where id=v_account.id;
  update public.capcut_deliveries set status='approved',account_id=v_account.id,approved_at=now(),updated_at=now() where order_id=p_order_id;
  insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
  values('admin',left(coalesce(p_actor,'admin'),120),'capcut.delivered','order',p_order_id::text,jsonb_build_object('accountId',v_account.id));
  return jsonb_build_object('status','approved','accountId',v_account.id,'idempotent',false,'payment',v_payment);
end $$;

create or replace function public.cancel_capcut_delivery(p_order_id uuid,p_actor text default 'admin')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_delivery public.capcut_deliveries%rowtype;
begin
 select * into v_delivery from public.capcut_deliveries where order_id=p_order_id for update;
 if not found then raise exception 'CAPCUT_DELIVERY_NOT_FOUND'; end if;
 if v_delivery.status='cancelled' then return jsonb_build_object('status','cancelled','idempotent',true); end if;
 if v_delivery.account_id is not null then update public.capcut_accounts set status='cancelled',cancelled_at=now(),updated_at=now() where id=v_delivery.account_id;
 end if;
 update public.capcut_deliveries set status='cancelled',cancelled_at=now(),updated_at=now() where order_id=p_order_id;
 update public.payment_orders set status=case when status='reviewing' then 'rejected' else status end,rejection_reason='Admin tərəfindən ləğv edildi.',rejected_at=case when status='reviewing' then now() else rejected_at end,updated_at=now() where id=p_order_id;
 update public.payment_reservations set status='rejected',updated_at=now() where id=(select reservation_id from public.payment_orders where id=p_order_id);
 return jsonb_build_object('status','cancelled','idempotent',false);
end $$;

revoke execute on function public.approve_capcut_delivery(uuid,text),public.cancel_capcut_delivery(uuid,text) from public,anon,authenticated;
grant execute on function public.approve_capcut_delivery(uuid,text),public.cancel_capcut_delivery(uuid,text) to service_role;
commit;
