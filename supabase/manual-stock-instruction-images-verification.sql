select exists(select 1 from pg_tables where schemaname='public' and tablename='manual_stock_instruction_images' and rowsecurity) as private_table;
select not has_function_privilege('anon','public.manual_stock_instruction_image(text,uuid,uuid,text)','execute') and not has_function_privilege('authenticated','public.manual_stock_intake_images(text,uuid,jsonb,jsonb)','execute') as private_rpc;
