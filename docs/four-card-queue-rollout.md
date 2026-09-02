# Four-slot payment queue rollout

Migration: `supabase/migrations/202609020006_four_active_payment_methods.sql`.

Apply this migration **before** deploying the matching server. The server now
uses `payment_method_queue_snapshot`, which returns queue membership and Baku-day
capacity in a single database transaction. Do not deploy without this RPC.

No monetary limit is introduced: the existing `daily_limit` is a count of
confirmed payments. Reservations/reviewing receipts consume temporary capacity
only. They do not trigger promotion. Unlimited mode remains an explicit admin
setting. Eligibility is ordered by `sort_order`, `created_at`, then unique ID;
the former bank-name `auto_priority` value is retained but no longer used.

The migration adds day/ID visibility history, preserves current-day activation
metadata, replaces the automation RPC, and wraps existing admin/approval RPCs
with a shared transaction advisory lock. It does not change existing orders,
receipts, reservation identities, statuses, counters, limits or bank details.
Normal refresh calls subsequently reconcile the live active flags as requested.
At midnight the first query uses the new Baku day without erasing history.

Before applying, record order/reservation counts and a payment-method row hash.
After applying, confirm unchanged values, RLS enabled, `anon`/`authenticated`
cannot execute the snapshot RPC, and `service_role` can. Never print snapshot
RPC's raw result: it is server-only and contains encrypted bank data. Inspect
only counts, IDs/statuses or the public API's explicit safe field list.

Run `scripts/test-four-card-queue-database.mjs` with the bundled Node and local
PGlite runtime. Run `scripts/test-four-card-queue-browser.mjs` with the bundled
Playwright package and Chrome. These use isolated synthetic records, not live
Supabase. PGlite queues a single connection: this is not proof of a real
multi-connection PostgreSQL load test. Physical Safari/Android are also not
covered by Chromium viewport tests.

After deployment verify `/api/payments/methods`: at most four active/busy queue
members; exhausted previously activated members stay visible but disabled;
standby/manual-disabled/deleted members are absent. Do not create real test
reservations or orders. Compare the published payment-flow asset with the commit.

## Verified real test and release protection (2026-09-02)

`scripts/check-test-postgres.ps1 -RunQueueTests` uses a Windows DPAPI credential,
the explicitly fixed separate test project, the official Supabase CA and full
TLS hostname checking. It never accepts a production connection URL. The driver
and certificate live in ignored `payment-test-artifacts/`, not the release.
Test migrations are namespace-mapped to a unique isolated schema; no production
data is copied. 51 checks passed with 12 independent PostgreSQL backends,
24 competing reservations (five slots, five winners), 12 idempotent replays,
14 synthetic cards, TTL, midnight/year rollover and backup/rollback/reapply.

Production order: BEGIN + short lock timeout; `four-card-release-backup.sql`;
the migration without its outer BEGIN/COMMIT; `four-card-release-verify.sql`;
COMMIT. The backup is a private database-local recovery copy, not an offsite
disaster-recovery backup. It captures payment tables and original function
definitions/privileges under write-conflicting locks; if anything fails the
entire release transaction rolls back. The verify script rejects any change to
existing payment rows. No order/status/counter is rewound.

Then push the matching app (auto-deploy may start). On app failure redeploy
`045cdee28a2f0d216f9f13c72166a05b5b6a0920`; only then, if needed, execute
`four-card-release-rollback.sql`. This restores prior functions/permissions,
preserving all subsequent legitimate order/reservation/counter activity.
The additive history and backup are retained. Never bulk-restore old data over
live records. Physical mobile browsers remain a separate manual test.
