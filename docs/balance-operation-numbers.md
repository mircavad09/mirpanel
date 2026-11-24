# Balance operation display numbers

Scope: submitted card-to-card requests (drafts are not submitted requests), all Epoint top-up requests, and historical top-up intents. Product purchases are excluded. Existing UUIDs, per-customer legacy numbers, provider transactions and the wallet ledger remain untouched.

Before initial migration, `balanceNumberPlan(pool)` is a read-only mapping preview ordered by original creation timestamp, UUID, then source. The initial sequence starts at 599. Existing assigned display numbers are retained on repeat previews and runs.

`ensureBalanceNumbers(pool)` takes a transaction lock, briefly locks the three operation tables against concurrent writes, stores the complete before/after mapping in the private `balance_number_migration_backup` table, allocates numbers, and installs triggers. One database counter serializes future assignments across processes. Submitted manual requests receive a number at submission; abandoned drafts do not consume a request number. Epoint top-up requests receive it at creation. Cancellations retain their number.

The metadata tables and functions are inaccessible to public, anon and authenticated database roles. Admin and customer readers join the same mapping. Confirmation readers still enforce ownership and committed wallet-credit checks.

Rollback: redeploy the preceding application version to restore the former display. Both legacy sources (`wallet_topups.history_number`, `topup_document_numbers`) are left intact. Keep the new mapping and backup for audit; do not renumber, delete financial rows, reset the counter or reverse wallet entries. Disable/remove only the new metadata triggers if a deliberate rollback requires stopping future metadata allocation. The prior application ignores these additive tables.
