# Admin users / AZN wallet release — 2026-11-02

Canonical balance is `mirpanel_community.wallet_accounts.cents`; append-only
`wallet_ledger` is the audit/source of all credited funds. No pre-existing wallet
tables were found in the production schema. Missing accounts represent a real
zero balance; a failed request is never converted into a zero.

Only the existing authenticated admin gateway can invoke credit. The actor is
resolved from the existing verified owner/Google subject binding; SQL verifies
the binding again. Customer/employee credits are not exposed. Both admin CSRF
and same-origin safeguards remain. Debit, customer top-up and balance checkout
remain disabled. No payment, promo or referral event is synthesized.

`wallet_credit` runs inside a database transaction, serializes request keys,
locks the account row, updates integer cents and inserts its immutable ledger
entry together. Same-key retries return the original entry; a changed payload
with that key conflicts. 5 AZN is exactly 500 cents. Invalid/nonpositive or
sub-cent values are rejected. One request key is retained by the confirmation
dialog across errors. No success is displayed before the server accepts it.

Migration: `mirpanel-admin/community/wallet-migration.sql`.
Verification: `mirpanel-admin/community/wallet-verification.sql` (5 booleans).
Rollback: `mirpanel-admin/community/wallet-rollback.sql` disables credits without
dropping balances, history, accounts, orders or functions. Reapplying migration
does not silently re-enable a rolled-back release.

Backup: `public-community-backup.mjs --wallet` generated an ACL-restricted,
DPAPI-encrypted external dump, restored it into a separate loopback cluster,
compared baseline data/function fingerprints, applied migration twice, verified
and tested rollback data preservation. No backup is stored in Git. libpq/GSS
connection negotiation stalled on the first attempt; a bounded retry with GSS
disabled and TLS verify-full retained completed. The failed attempt credited
nobody and changed no production data.

Production migration/verification: 5/5 passed, zero wallet accounts/entries
created by migration. Existing data was retained. No test credit was issued.

Tests completed before release: 104 real-server/browser integration assertions,
21 PostgreSQL assertions including eight concurrent connections sharing one
request, exactly one 500-cent credit, one immutable entry, first/repeat migration
and data-preserving rollback. Public profile/customer regression: 214 assertions,
zero failures, including 5.00 balance display and disabled customer top-up at six
widths. Total: 339 passing assertions. Initial run hit the existing auth attempt
limiter; the final test waits for a fresh window without weakening production limits.

The admin directory preserves list/search DOM when opening/backing from detail.
Spending uses linked approved/completed AZN orders minus recorded refunds.
Activity uses existing presence only; unknown activity says unknown. Unimplemented
discount/referral tabs use empty states. Wallet payments view is empty because
this release only supports actual administrative credit entries.
