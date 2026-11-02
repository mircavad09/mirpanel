begin;
set local lock_timeout='5s';
update mirpanel_community.shop_release set enabled=false where id;
-- Preserve orders, balances, ledger, pending topups, shared receipts and refunds.
-- Do not restore old receipt/ledger constraints: legitimate new records need them.
commit;
