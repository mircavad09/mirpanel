# Cart drafts and one-order checkout (2026-11-06)

## Verified causes and changes

- The customer router loaded app.js once, then inserted an empty home grid on a
  detail-to-home visit without running the catalogue renderer. The home mount now
  renders the existing catalogue into the new shell. Cached shells retain their
  filter/scroll state; failed route requests offer the existing retry action.
- Password-bearing products bypassed the cart entry path. Every priced product
  now opens terms first, followed by the selected product/plan's configured
  inputs. Plan overrides inherit product fields unless explicitly configured.
  PIN fields preserve leading zeroes. Cart editing uses the same protected draft.
- The former checkout created one payment order and bank-capacity reservation
  per unit. Version 2 creates one parent order/receipt/payment-capacity slot,
  with separate inventory-unit holds. Legacy checkout submissions retain their
  old handler. New order lists and WhatsApp show all lines under one order code.

## Sensitive inputs

Draft values and order input snapshots use the existing payment encryption key.
Browser storage contains only opaque draft IDs, terms version and cart metadata.
Password/PIN previews are masked; own draft reads require the browser owner token
and, once bound, the same signed-in account. Public order projections explicitly
exclude both input values and encrypted blobs. Admin details retain server auth.

## Tests (isolated, no production orders or credits)

- test-cart-v2.mjs: 40 checks, actual PostgreSQL/stock RPC, one slot/receipt/order,
  concurrent retry, duplicate product with distinct inputs, leading-zero PIN,
  encrypted values, cross-account isolation, quantity/null/zero stock, cancel,
  expiry, finite-stock approval, wallet debit/refund and five-slot capacity.
- test-shop-postgres.mjs: 64 checks including special prices, insufficient funds,
  parallel stock take, atomic rollback, repeated top-up approval and permissions.
- test-cart-v2-browser.mjs: 37 checks, Chrome 390/1440 viewport, real isolated HTTP
  API/PostgreSQL and private local file storage. Guest terms/inputs/cart/payment,
  JPEG/PNG/PDF upload, lost draft and submit responses, retry without duplicates,
  masked browser storage, refresh and WhatsApp fallback.
- test-home-catalog-return.mjs: 22 checks using the actual remount functions and
  router. Repeated home/back/forward with failed background home requests:
  local median 67 ms, p95 190 ms. These are NOT live internet measurements.
- test-account-orders.mjs --api-only: 26 checks, ownership, paging, receipt access
  and auth-cookie proxy. Its older full UI harness expects the retired owner-only
  history screen; the current account-panel UI is not covered by that harness.
- test-shop-proxy.mjs: 50 checks, including draft/remove routes and cookie scope.
- test-cart-field-editor.mjs: 7 checks, actual admin field editor and normalization.
- test-cart-drawer-speed.mjs: 700 ms simulated quote delay; local first-frame
  42.5/27.7 ms and reopen 5.4/7 ms at 390/1440 px, with retained cart on failure.
- Syntax checks of changed/new JS modules passed.
- Physical iPhone/Safari and Android devices, real WhatsApp sending, and real
  production financial operations were deliberately not tested.

An older profit source-string test still expects approve_payment_order_v6,
although the pre-existing store uses v7; it is not used as a release gate here.

## Production schema and rollback

The production read-only dump was restored into a separate loopback database.
Migration first/repeat, verification and non-destructive rollback/data-manifest
comparison passed. The archive was encrypted with Windows DPAPI and ACL-restricted
outside Git. Production migration and all five verification queries passed.
No existing account/order/stock/balance/audit records were replaced.

Rollback disables new v2 checkouts via cart-v2-rollback.sql. Keep the v2-compatible
backend for in-flight v2 purchases; do not deploy an old per-line submit handler
over reserved v2 carts or reverse schema blindly. Existing records stay intact.
Gmail configuration, sender process and queue were not modified.
