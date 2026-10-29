# Inventory outage hotfix — 2026-10-29

Production commit before hotfix: 86d72bf805aa9921fd48841af53cad1c5cc69b1b.
No community-preview code is included.

## Evidence / root cause

Both Cloudflare /api/payments/inventory and direct Render returned unavailable
errors. Render's configured Supabase project is mirpanel-payments,
sidgtcgyqkdplgfabmmp. Direct authenticated **read-only** RPC probes returned HTTP
402 with service restriction: exceed_cached_egress_quota, exceed_egress_quota.
This is not a missing migration or a stock count.

An existing TLS-verified database connection, inside BEGIN READ ONLY, confirmed
employee_system_ready() = 6 and inventory_snapshot() intact:

| Product | Orderable quantity |
|---|---|
| zoom, spotify, netflix, netflix_umumi, capcut | unlimited (null) |
| chatgpt_ortaq | 4 |
| chatgpt | 1 |
| youtube, youtube_sexsi | 0 |

These are incident-time reads, not new configured stock or durable guarantees.
No orders/customer data were queried. No business records were changed.

The frontend's catch handler overwrote cached available values with zero and
painted all unknown tracked products as sold out. The startup schema probe also
latched inventoryEnabled=false after a transient API failure, misleadingly saying
schema 5 was missing even though schema 6 exists.

## Scope of fix

- Loading, missing product response, quota/network/API failure are UNKNOWN, not 0.
  No invented counts/badges; product detail can still be opened, but checkout
  remains fail-closed until a fresh server inventory read succeeds.
- Preserve real zero, null/unlimited and positive/reserved stock semantics. No SQL
  change; no migration, rollback or inventory reconciliation performed.
- A shared backend inventory reader coalesces concurrent requests, caches public
  snapshots for at most two seconds, and backs off failed reads for three seconds.
  Reservations bypass the public cache and still use the existing atomic RPC.
- Failed startup readiness is rechecked; once upstream returns schema >=5 the
  gate recovers without a restart. No fallback to old CMS counts or legacy reserve
  for tracked products.
- Stable INVENTORY_UNAVAILABLE / 503 instead of implying missing migration.
- Checkout receipt/cancel/history/ownership paths unchanged.
- Versioned frontend asset and middleware replacement avoid stale script URLs.

## Tests

- test-inventory-upstream: error/backoff/recovery/coalescing/clone isolation.
- test-inventory-api: public/admin permissions, true zero and plan isolation.
- test-inventory-availability: all 22 active catalog products, no label dependence.
- test-inventory-nullable-postgres: real isolated PostgreSQL full reserve flow,
  blank/unlimited, true zero, positive, cancellation, parallel last-unit winner.
- test-inventory-last-unit-checkout: idempotent own last-unit submit/retry.
- test-inventory-upstream-browser: old production source reproduces false sold-out;
  new source passes outage/recovery plus six responsive widths. No public writes.
- Existing checkout cancel browser regression run separately.

## External blocker (NOT fixed by app deployment)

Supabase's API restriction must be lifted by the project owner. Rolling back app
code cannot remove a provider-enforced 402. No billing/plan/spend-cap setting has
been changed. No paid service has been created. Do not claim ordering restored
until inventory AND payment-method API calls succeed after provider restoration.
When lifted, verify genuine zero products stay closed and null/positive products
become available without writing test reservations in production.
