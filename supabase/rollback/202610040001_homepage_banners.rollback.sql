-- Before running: export BOTH homepage banner tables and download the
-- homepage-banners/ prefix from the existing private stories bucket.
-- Only the new banner structures are removed; no storage objects are deleted.
begin;
drop function if exists public.initialize_homepage_banners(jsonb);
drop table if exists public.homepage_banners;
drop function if exists public.homepage_banner_updated_at();
drop table if exists public.homepage_banner_settings;
commit;
