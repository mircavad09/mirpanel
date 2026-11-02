select to_regclass('mirpanel_community.shop_checkouts') is not null as checkouts,
to_regclass('mirpanel_community.shop_lines') is not null as lines,
to_regclass('mirpanel_community.wallet_topups') is not null as topups,
to_regprocedure('mirpanel_community.shop_wallet_refund()') is not null as refund_guard;
select not exists(select 1 from mirpanel_community.wallet_accounts where cents<0) as balances_nonnegative,
not exists(select 1 from mirpanel_community.wallet_ledger where after_cents<>before_cents+cents) as ledger_consistent;
