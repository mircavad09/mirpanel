begin;

create table if not exists public.story_categories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  cover_path text not null check (cover_path like 'covers/%'),
  sort_order integer not null default 1 check (sort_order > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_items (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.story_categories(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_path text not null check (media_path like 'items/%'),
  caption text not null default '' check (char_length(caption) <= 240),
  sort_order integer not null default 1 check (sort_order > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_categories_public_order_idx on public.story_categories(active, sort_order, created_at);
create index if not exists story_items_story_order_idx on public.story_items(story_id, active, sort_order, created_at);

create or replace function public.set_story_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists story_categories_updated_at on public.story_categories;
create trigger story_categories_updated_at before update on public.story_categories for each row execute function public.set_story_updated_at();
drop trigger if exists story_items_updated_at on public.story_items;
create trigger story_items_updated_at before update on public.story_items for each row execute function public.set_story_updated_at();

alter table public.story_categories enable row level security;
alter table public.story_items enable row level security;
revoke all on public.story_categories from anon, authenticated;
revoke all on public.story_items from anon, authenticated;
grant select, insert, update, delete on public.story_categories to service_role;
grant select, insert, update, delete on public.story_items to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mirpanel-stories', 'mirpanel-stories', false, 26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
