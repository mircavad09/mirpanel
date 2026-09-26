begin;
do $$
begin
  if exists (select 1 from public.story_categories limit 1) then
    raise exception 'Rollback dayandırıldı: əvvəlcə stories backup və media ixracını tamamlayın.';
  end if;
end $$;
drop table if exists public.story_items;
drop table if exists public.story_categories;
drop function if exists public.set_story_updated_at();
delete from storage.buckets where id = 'mirpanel-stories' and not exists (select 1 from storage.objects where bucket_id = 'mirpanel-stories');
commit;
