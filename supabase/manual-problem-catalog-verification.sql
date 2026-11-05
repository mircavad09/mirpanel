select not has_function_privilege('anon','public.manual_stock_problem(text,uuid,jsonb)','execute') and not has_function_privilege('authenticated','public.manual_stock_problem(text,uuid,jsonb)','execute') as private_rpc;
select position('p_action=''products''' in pg_get_functiondef('public.manual_stock_problem(text,uuid,jsonb)'::regprocedure))>0 as problem_catalog;
