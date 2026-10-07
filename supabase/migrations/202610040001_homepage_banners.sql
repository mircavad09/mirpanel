begin;
select pg_advisory_xact_lock(20261004, 1);
create table if not exists public.homepage_banner_settings (
  singleton boolean primary key default true check (singleton),
  initialized boolean not null default false
);
insert into public.homepage_banner_settings values (true, false)
on conflict (singleton) do nothing;
create table if not exists public.homepage_banners (
  id uuid primary key,
  media_path text unique check (media_path like 'homepage-banners/%'),
  legacy_image text,
  title text not null default '' check (char_length(title) <= 200),
  options jsonb not null default '{}'::jsonb,
  sort_order integer not null default 1 check (sort_order > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check ((media_path is not null) <> (legacy_image is not null))
);
alter table public.homepage_banners add column if not exists options jsonb not null default '{}'::jsonb;
alter table public.homepage_banner_settings enable row level security;
create index if not exists homepage_banners_public_order_idx on public.homepage_banners(active,sort_order,id);
create or replace function public.homepage_banner_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.homepage_banners'::regclass
      and tgname = 'homepage_banner_updated_at'
      and not tgisinternal
  ) then
    create trigger homepage_banner_updated_at before update on public.homepage_banners
    for each row execute function public.homepage_banner_updated_at();
  end if;
end;
$$;
alter table public.homepage_banners enable row level security;
revoke all on public.homepage_banner_settings, public.homepage_banners from anon, authenticated;
grant all on public.homepage_banner_settings, public.homepage_banners to service_role;
create or replace function public.initialize_homepage_banners(seed jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from homepage_banner_settings where singleton for update;
  if (select initialized from homepage_banner_settings where singleton) then return; end if;
  insert into homepage_banners(id,legacy_image,title,sort_order,active,options)
    select (entry->>'id')::uuid, entry->>'legacy_image', entry->>'title',
      (entry->>'sort_order')::integer, true, coalesce(entry->'options','{}'::jsonb) from jsonb_array_elements(seed) entry;
  update homepage_banner_settings set initialized = true where singleton;
end;
$$;
revoke all on function public.initialize_homepage_banners(jsonb) from public, anon, authenticated;
grant execute on function public.initialize_homepage_banners(jsonb) to service_role;
create or replace function public.reorder_homepage_banners(items jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare item jsonb; position integer := 0;
begin
  perform 1 from homepage_banner_settings where singleton for update;
  perform 1 from homepage_banners order by id for update;
  if jsonb_array_length(items) <> (select count(*) from homepage_banners) then
    raise exception 'Banner siyahısı dəyişib. Siyahını yeniləyin.';
  end if;
  for item in select * from jsonb_array_elements(items) loop
    position := position + 1;
    if not exists(select 1 from homepage_banners where id=(item->>'id')::uuid and updated_at=(item->>'version')::timestamptz) then
      raise exception 'Banner başqa pəncərədə dəyişib. Siyahını yeniləyin.';
    end if;
    update homepage_banners set sort_order=position where id=(item->>'id')::uuid;
  end loop;
end;
$$;
revoke all on function public.reorder_homepage_banners(jsonb) from public, anon, authenticated;
grant execute on function public.reorder_homepage_banners(jsonb) to service_role;
commit;
