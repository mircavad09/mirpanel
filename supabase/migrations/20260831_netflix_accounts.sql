create table if not exists public.netflix_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  active boolean not null default true,
  deleted_at timestamptz,
  last_valid_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint netflix_accounts_email_check check (email ~ '^[a-z0-9]+@gmail\.com$')
);
create index if not exists netflix_accounts_active_email_idx on public.netflix_accounts(active, email);
alter table public.netflix_accounts enable row level security;
drop policy if exists netflix_accounts_no_anon on public.netflix_accounts;
create policy netflix_accounts_no_anon on public.netflix_accounts for all to anon using (false) with check (false);
drop policy if exists netflix_accounts_no_authenticated on public.netflix_accounts;
create policy netflix_accounts_no_authenticated on public.netflix_accounts for all to authenticated using (false) with check (false);

-- The Render server uses the Supabase service role; it bypasses RLS but still
-- needs explicit table privileges. Do not grant these to anon/authenticated.
grant select, insert, update on table public.netflix_accounts to service_role;
