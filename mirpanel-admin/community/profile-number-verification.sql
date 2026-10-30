set search_path=mirpanel_community,public;
select not exists(select 1 from "user" u left join community_member_numbers n on n.user_id=u.id where n.user_id is null) as all_accounts_numbered;
select count(*)=count(distinct member_number) and coalesce(min(member_number),1001)>=1001 as numbers_unique from community_member_numbers;
select relrowsecurity as numbers_private from pg_class where oid='community_member_numbers'::regclass;
select not has_table_privilege('anon','community_member_numbers','SELECT') and not has_table_privilege('authenticated','community_member_numbers','SELECT') as no_public_number_access;
