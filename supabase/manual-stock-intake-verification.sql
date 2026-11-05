select exists(select 1 from pg_tables where schemaname='public' and tablename='manual_stock_updates' and rowsecurity) as private_updates;
select not has_function_privilege('anon','public.manual_stock_intake(text,uuid,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.manual_stock_intake(text,uuid,jsonb)','EXECUTE') as private_intake;
select exists(select 1 from pg_indexes where schemaname='public' and indexname='manual_stock_source_plan') as unique_links;
select exists(select 1 from pg_indexes where schemaname='public' and indexname='manual_stock_unit_identity') as duplicate_guard;
select not exists(select 1 from public.manual_stock_plans where source_plan_key is not null group by product_id,source_plan_key having count(*)>1) as mapping_consistency;
