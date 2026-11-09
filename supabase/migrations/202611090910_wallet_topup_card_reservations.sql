begin;
set local lock_timeout='5s';
alter table mirpanel_community.wallet_topups
  add column if not exists card_bank text,
  add column if not exists card_last4 text,
  add column if not exists card_snapshot jsonb,
  add column if not exists preferred_method_id uuid,
  add column if not exists reserved_until timestamptz;
create index if not exists wallet_topups_card_usage
  on mirpanel_community.wallet_topups(method_id,created_at)
  where status in ('draft','reviewing','approved');
commit;
