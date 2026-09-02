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
- Two unrelated baseline suites still fail on both unchanged main and working tree: `test-product-pages.mjs` (existing About content assertion), `test-payment-profit.mjs` (expects approval RPC v5 although main uses v6). Their application code was not changed to suppress failures.

## Data and rollout

Migration: `supabase/migrations/202609020004_numeric_payment_order_codes.sql`.
It locks orders briefly, widens the code CHECK, creates a private transactional counter and server-only submit RPC, and verifies that existing order rows are byte-equivalent before committing.
Live SQL verification: 1,035 orders before/after, identical fingerprint `31bb9468a32897e9b2236c6028c240ec`; next numeric code 971; RLS true; anon/authenticated execute false; service_role execute true.
Commercial/CMS snapshot unchanged: `9847f529dabb2c79afeaa6604e5069b0713e23c77a02a3c268c526b958a14fcb` (31 products, 22 active).

The new API requires the checkout key for submission. Older open browser tabs receive an explicit refresh message; their stored reservation can be recovered after reload. An unsubmitted File cannot survive a browser reload and must be selected again; the reservation and an already-created order are recovered from the server.

The same reservation and receipt SHA-256 use the same private object path. A lost RPC response never authorizes deleting a potentially linked receipt. Different failed/ambiguous uploads may leave private orphan objects; no unsafe deletion of potentially linked objects is attempted.

Local browser tests require `MIRPANEL_NODE_MODULES` (Playwright + sharp) and `MIRPANEL_BROWSER_PATH` (Chromium). SQL test requires `MIRPANEL_PGLITE` pointing to the PGlite ESM entry, defaulting to the ignored local test-artifact runtime. No secrets or live connections are used by these tests.

Physical iPhone with/without WhatsApp, physical Android, live receipt submission and actual customer navigation require separately observed results. No live test reservation/order was created, so 971 was not consumed by a synthetic test.
