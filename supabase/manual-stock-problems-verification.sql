select exists(select 1 from pg_tables where schemaname='public' and tablename='manual_stock_problems' and rowsecurity) as private_table;
select not has_function_privilege('anon','public.manual_stock_problem(text,uuid,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.manual_stock_problem(text,uuid,jsonb)','EXECUTE') as private_rpc;
