begin read only;
select exists(select 1 from mirpanel_community.release_manifest where object_name='public.payment_orders') as manifest_captured;
select count(*)<=1 as owner_limit from mirpanel_community.owner_identity;
select not exists(select 1 from mirpanel_community.community_group_roles where role='moderator') as no_moderator;
select count(*)=0 as no_unverified_users from mirpanel_community."user" where not "emailVerified";
select not exists(select 1 from pg_tables where schemaname='mirpanel_community' and not rowsecurity) as all_rls;
select not has_schema_privilege('anon','mirpanel_community','USAGE') and not has_schema_privilege('authenticated','mirpanel_community','USAGE') as schema_private;
commit;
