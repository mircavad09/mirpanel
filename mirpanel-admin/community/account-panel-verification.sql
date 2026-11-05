select exists(select 1 from pg_tables where schemaname='mirpanel_community' and tablename='account_wishlist' and rowsecurity) as secured;
select not has_table_privilege('anon','mirpanel_community.account_wishlist','SELECT,INSERT,UPDATE,DELETE') as anonymous_denied;
select exists(select 1 from pg_constraint where conrelid='mirpanel_community.account_wishlist'::regclass and contype='p') as unique_account_product;
