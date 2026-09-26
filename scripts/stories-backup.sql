\copy (select * from public.story_categories order by sort_order, created_at) to 'story_categories_backup.csv' csv header
\copy (select * from public.story_items order by story_id, sort_order, created_at) to 'story_items_backup.csv' csv header
