select (select count(*) from pg_tables where schemaname='public' and tablename in ('manual_bot_rules','manual_bot_unanswered') and rowsecurity)=2 as private_tables;
select not has_function_privilege('anon','public.manual_stock_bot(text,uuid,jsonb)','execute') and not has_function_privilege('authenticated','public.manual_stock_bot(text,uuid,jsonb)','execute') as private_rpc;
