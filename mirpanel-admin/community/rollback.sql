begin;
-- Disable the release flag on Render first. Preserve all records and identities.
update mirpanel_community.community_config set enabled=false where id=true;
update mirpanel_community.community_group_settings set enabled=false where id=true;
revoke all on schema mirpanel_community from public,anon,authenticated;
commit;
