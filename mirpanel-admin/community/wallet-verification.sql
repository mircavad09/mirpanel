select to_regclass('mirpanel_community.wallet_accounts') is not null as accounts_ready,
to_regclass('mirpanel_community.wallet_ledger') is not null as ledger_ready,
to_regprocedure('mirpanel_community.wallet_credit(text,text,bigint,text,uuid)') is not null as credit_ready;
select not exists(select 1 from mirpanel_community.wallet_accounts a where a.cents<>(select coalesce(sum(l.cents),0) from mirpanel_community.wallet_ledger l where l.user_id=a.user_id)) as balances_match_ledger;
select exists(select 1 from pg_trigger where tgrelid='mirpanel_community.wallet_ledger'::regclass and tgname='wallet_immutable' and not tgisinternal) as immutable_trigger_ready;
