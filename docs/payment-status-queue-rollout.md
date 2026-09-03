# Payment status / standby regression release

Migration: `202609030002_payment_method_status_queue_regression.sql`.

Only two existing database functions change. The public API, frontend, receipt
validation, finance reports and reservation identity contracts remain unchanged.
Capacity remains a count of confirmed payments plus temporary reservations/reviews;
temporary occupancy does not trigger a limit replacement.

## Evidence and tests

The previous snapshot ordered every active slot together, so a busy card could
precede a selectable card. Standby eligibility also ignored live holds. The new
snapshot orders selectable / busy / exhausted / other at the server. Promotion
prefers the same provider, then another eligible card, excluding live-held,
manual-disabled, deleted and exhausted standby cards. Four-slot membership still
includes busy cards; do not open a fifth card simply because a member is busy.

The screenshot alone does not prove a missing replacement: the initial public
snapshot already contained four active/busy members. A later read-only database
check found same-bank replacements active and the former cards fully consumed.

Synthetic validation: 69 PGlite checks; 78 real Supabase PostgreSQL checks with
12 independent backends, 24 competing reservations and 12 idempotent retries.
Includes held-standby exclusion, same-bank/fallback/M10 promotion, 14 cards,
exhaustion, expiry, Baku midnight, unchanged reservation identity, release backup,
rollback and reapplication. Browser fixtures cover 320/390/768/1440 px, no
overflow or console errors and no reservation writes during queue checks.
Chromium viewport tests are not physical iPhone/Android tests.

Production SQL Editor returned `MIGRATION_APPLIED_DATA_UNCHANGED` on 2026-09-03.
Supabase's additional "Run and enable RLS" safety option was used; the script's
own RLS/revoke protections remain in place. No payment row changed in the release
transaction and no usage counter was reset.

## Production sequence

1. Use only the existing production project; do not copy customer data to tests.
2. One transaction: BEGIN; `scripts/status-queue-release-backup.sql`; migration
   without its outer BEGIN/COMMIT; `scripts/status-queue-release-verify.sql`; COMMIT.
3. The advisory writer lock and table locks protect the before/after comparison.
   Lock timeout is 5 seconds; statement timeout 60 seconds. On an error, rollback
   the transaction and investigate; never bypass these safeguards.
4. Backup schema `mirpanel_status_queue_backup_20260903` retains payment tables,
   function definitions and execute privileges inside the production database.
   It is private with RLS and no API-role access, not an offsite disaster backup.
   Verification compares complete payment-table rows in both directions and
   aborts on any difference. No refresh/reset is invoked in this transaction.
5. Commit only these task files, push HEAD to main, and verify the matching Render
   deployment. The migration is compatible with the currently deployed app.
6. Read-only public checkout validation: selectable cards above busy cards above
   exhausted cards; four members if eligible capacity exists; full cards retain
   bank/last4 and disabled label. Do not select a card or create a test order.

## Rollback

Run `scripts/status-queue-release-rollback.sql` only if rollback is needed. It
restores the previous two function definitions and their previous privileges,
not data. Tested rollback leaves orders, reservations and counters unchanged.
Never restore the old table copies over new customer activity. Keep backups;
do not delete history, reset usage or change bank details. No application code
changes in this release require a different frontend during rollback.
