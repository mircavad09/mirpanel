# Checkout recovery and decimal order codes

Scope: receipt submission, checkout recovery, WhatsApp navigation, new display codes.
Existing UUID primary keys and MP-* display codes remain unchanged.

## Checks executed

- `test-numeric-order-database.mjs`: 21 checks in isolated PostgreSQL/WASM (PGlite 0.3.14), including first code 971, rollback without consuming a number, migration rerun, unchanged legacy row, role permissions, 40 repeated submissions for 20 reservations. PGlite has one connection; this is not a production multi-connection load test.
- `test-checkout-api-recovery.mjs`: 27 checks against the actual API handler with an isolated store. Includes concurrent repeats, reservation ownership, changed catalog price, lost RPC response, private linked receipt preservation, upload failures, invalid MIME/size, CORS, protected signed receipt and legacy/numeric search.
- `test-payment-receipt-browser.mjs`: real image fixtures and PDF, original File/FormData, FileReader absent, double click, offline, timeout, automatic/manual retry, refresh before/after submission, object URL cleanup, 320/390/768/1440 layout.
- `test-whatsapp-checkout-browser.mjs`: generated CapCut page and actual shared scripts, intercepted HTTPS navigation to wa.me, snapshot message, numeric ID, same-tab fallback after back navigation, no popups or duplicate orders. Chromium at phone/desktop sizes, **not physical iOS Safari**.
- `test-unified-order-flow.mjs`: all 22 active product pages (18 purchasable and 4 unavailable), generated future product, no reservation requests before selecting a card.
- Existing payment-system, order-admin, usage-day, monthly-report, card-activation and admin browser checks passed. The payment-system commercial baseline was independently updated from unchanged main `857ba7b` before this work, not from an assumed old hash.
- Follow-up: both stale baseline suites now pass with test-only corrections. Profit tests verify the actual v6 -> v5 delegation, locked/idempotent approval and financial snapshots. Product tests use isolated About paragraphs instead of a historical CMS hash, current asset/breakpoint expectations, current catalog sitemap counts and same-tab WhatsApp instead of the obsolete popup expectation. No production CMS, styles or approval code was changed to satisfy these tests.

## Data and rollout

Migration: `supabase/migrations/202609020004_numeric_payment_order_codes.sql`.
It locks orders briefly, widens the code CHECK, creates a private transactional counter and server-only submit RPC, and verifies that existing order rows are byte-equivalent before committing.
Live SQL verification: 1,035 orders before/after, identical fingerprint `31bb9468a32897e9b2236c6028c240ec`; next numeric code 971; RLS true; anon/authenticated execute false; service_role execute true.
Commercial/CMS snapshot unchanged: `9847f529dabb2c79afeaa6604e5069b0713e23c77a02a3c268c526b958a14fcb` (31 products, 22 active).

The new API requires the checkout key for submission. Older open browser tabs receive an explicit refresh message; their stored reservation can be recovered after reload. An unsubmitted File cannot survive a browser reload and must be selected again; the reservation and an already-created order are recovered from the server.

The same reservation and receipt SHA-256 use the same private object path. A lost RPC response never authorizes deleting a potentially linked receipt. Different failed/ambiguous uploads may leave private orphan objects; no unsafe deletion of potentially linked objects is attempted.

Local browser tests require `MIRPANEL_NODE_MODULES` (Playwright + sharp) and `MIRPANEL_BROWSER_PATH` (Chromium). SQL test requires `MIRPANEL_PGLITE` pointing to the PGlite ESM entry, defaulting to the ignored local test-artifact runtime. No secrets or live connections are used by these tests.

Physical iPhone with/without WhatsApp, physical Android, live receipt submission and actual customer navigation require separately observed results. No live test reservation/order was created, so 971 was not consumed by a synthetic test.

## Counter advance to 10001 (follow-up)

`202609020005_advance_order_counter_10001.sql` changes only the persistent counter to
`greatest(current_counter, 10000, highest_existing_numeric_code)`. It acquires the
counter lock before the order-table lock, matching the submission write order.
It never updates an existing order, reservation, receipt, status or audit row;
an in-transaction fingerprint assertion protects all existing order rows.
The counter update is transactional, monotonic and safe to rerun. No count-based
allocation, runtime reset, frontend change or cache-version change is needed.

Isolated PostgreSQL/WASM: 39 checks, 1,035 legacy fixtures, preserved 971 on retry,
first advanced code 10001, 80 repeated submissions, 0 duplicate codes, migration
rerun without rollback of the counter, existing 20000 -> next 20001. This is still
a single-connection engine, not a live multi-connection load test. The live
database has UNIQUE constraints on order code, reservation and receipt path.

Before this advance, read-only live checks found 1,036 orders: 1,035 unchanged
legacy orders and one numeric order 971. Its reservation/product/plan/amount
matched; its private Storage object existed with matching MIME and size. No
receipt content or checkout secret was accessed. Live customer WhatsApp navigation
was not observed; isolated Chromium intercepts verified HTTPS wa.me, message,
same-tab handoff and fallback with 10001. No physical iOS/Android claim is made.

Live advance succeeded: counter 971 -> 10000, next 10001, 1,036 orders and 0
duplicate codes before/after. Full row fingerprints were identical before/after
for orders (`4c01f4cc30de3e69fba83464925b3ac0`), reservations
(`fd041b637faa3f862d40032284ebcf1c`) and daily usage counters
(`226bfb4ed44907ff726147a0bda17e45`). No synthetic live order was created.
