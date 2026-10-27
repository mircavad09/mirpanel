begin;
create schema if not exists admin_sessions_release_20261027;
create table if not exists admin_sessions_release_20261027.manifest(name text primary key, captured_at timestamptz not null default now(), details jsonb not null);
insert into admin_sessions_release_20261027.manifest(name,details) values('preflight',jsonb_build_object('existing_payment_orders',to_regclass('public.payment_orders') is not null,'scope','additive admin authentication only')) on conflict(name) do nothing;
create table if not exists public.admin_sessions(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 auth_binding text not null check(auth_binding ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 last_activity_at timestamptz not null default now(),
 expires_at timestamptz not null
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.admin_sessions to service_role;
revoke all on schema admin_sessions_release_20261027 from public,anon,authenticated;
create or replace function public.admin_session_action(p_action text,p_hash text,p_binding text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.admin_sessions;
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_binding !~ '^[a-f0-9]{64}$' or p_action not in('create','read','touch','revoke') then raise exception 'Invalid session request';end if;
 if p_action='create' then
  delete from public.admin_sessions where expires_at<=now();
  insert into public.admin_sessions(token_hash,auth_binding,expires_at) values(p_hash,p_binding,now()+interval '60 minutes') returning * into r;
 elsif p_action='revoke' then
  delete from public.admin_sessions where token_hash=p_hash and auth_binding=p_binding;return null;
 elsif p_action='touch' then
  update public.admin_sessions set last_activity_at=now(),expires_at=now()+interval '60 minutes'
   where token_hash=p_hash and auth_binding=p_binding and expires_at>now() returning * into r;
 else
  select * into r from public.admin_sessions where token_hash=p_hash and auth_binding=p_binding and expires_at>now();
 end if;
 if r.token_hash is null then return null;end if;
 return jsonb_build_object('expiresAt',r.expires_at);
end $$;
revoke all on function public.admin_session_action(text,text,text) from public,anon,authenticated;
grant execute on function public.admin_session_action(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
