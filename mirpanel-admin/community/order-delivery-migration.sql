begin;
create table if not exists mirpanel_community.customer_order_deliveries (
  id uuid primary key,
  order_id uuid not null references public.payment_orders(id),
  line_index integer not null check (line_index >= 0),
  quantity integer not null check (quantity > 0),
  message_cipher text not null,
  actor text not null,
  delivered_at timestamptz not null default now()
);
create index if not exists customer_order_deliveries_order_idx on mirpanel_community.customer_order_deliveries(order_id);
create table if not exists mirpanel_community.customer_order_mail (
  event_key text primary key,
  order_id uuid not null references public.payment_orders(id),
  delivery_id uuid references mirpanel_community.customer_order_deliveries(id),
  state text not null default 'queued' check (state in ('queued','sending','accepted','failed','uncertain')),
  attempts integer not null default 0,
  next_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_id text,
  reason text
);
create index if not exists customer_order_mail_due_idx on mirpanel_community.customer_order_mail(next_at) where state='queued';
create table if not exists mirpanel_community.customer_order_contacts (
  order_id uuid primary key references public.payment_orders(id),
  name text, email text, phone text
);
revoke all on mirpanel_community.customer_order_deliveries, mirpanel_community.customer_order_mail, mirpanel_community.customer_order_contacts from public, anon, authenticated;
alter table mirpanel_community.customer_order_deliveries enable row level security;
alter table mirpanel_community.customer_order_mail enable row level security;
alter table mirpanel_community.customer_order_contacts enable row level security;
create or replace function mirpanel_community.snapshot_customer_order_contact() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into mirpanel_community.customer_order_contacts(order_id,name,email,phone)
  select new.order_id,u.name,u.email,p.phone from mirpanel_community."user" u
  left join mirpanel_community.community_profiles p on p.user_id=u.id where u.id=new.user_id
  on conflict do nothing;
  return new;
end
$$;
revoke all on function mirpanel_community.snapshot_customer_order_contact() from public, anon, authenticated;
drop trigger if exists snapshot_customer_order_contact on mirpanel_community.community_order_owners;
create trigger snapshot_customer_order_contact after insert on mirpanel_community.community_order_owners
for each row execute function mirpanel_community.snapshot_customer_order_contact();
create or replace function mirpanel_community.enqueue_customer_payment_mail() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.status not in ('cancelled','rejected','expired') and
     (new.payment_confirmed is true or new.status in ('approved','completed')) then
    if tg_op = 'UPDATE' then
      if old.payment_confirmed is true or old.status in ('approved','completed') then return new; end if;
    end if;
    insert into mirpanel_community.customer_order_mail(event_key,order_id)
      values ('payment:'||new.id,new.id) on conflict do nothing;
  end if;
  return new;
end
$$;
revoke all on function mirpanel_community.enqueue_customer_payment_mail() from public, anon, authenticated;
drop trigger if exists enqueue_customer_payment_mail on public.payment_orders;
create trigger enqueue_customer_payment_mail after insert or update of payment_confirmed,status on public.payment_orders
for each row execute function mirpanel_community.enqueue_customer_payment_mail();
commit;
