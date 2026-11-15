# Multi-product customer orders — 2026-11-15

Baseline main: `fe1aac5`. Scope: customer order fulfillment projection and its
order-card presentation. Preserve all parallel content, Frankfurt deployment,
admin delivery and Netflix Sheets work. No migration is required.

## Observed cause

A production **read-only** aggregate of the latest 20 paid carts containing
Netflix and Prime found one matching order: it already had Netflix delivered
and Prime outstanding. No customer/order ID or credentials were printed. The
allocator already works per immutable package/line and does not wait for every
product. It was deliberately not replaced or loosened.

The customer projection exposed only an overall `preparing` state until every
unit completed. There were no explicit per-line delivered/remaining counts.
The card used only `items[0].image`, displayed the whole order as “Hazırlanır”,
and hid the waiting line's instruction/status panel when it had no delivery
record. A separate retained-history early return could ignore new partial
delivery records unless an entire order became completed.

## Changes

* Add public, non-sensitive per-item `fulfillmentStatus`, `deliveredQuantity`
  and `remainingQuantity` from authoritative delivery/cancellation records.
* Add an additive overall `fulfillmentStatus: partial` and an accurate message.
  Keep the existing internal/financial `status: preparing` contract unchanged
  so payment, queue, reporting and cancellation consumers are not destabilized.
* Show “Qismən təhvil verildi” on partial customer orders, with each line's own
  status and delivered/requested quantities. Delivered accounts/PIN and each
  line's existing guide remain associated with that exact line. Waiting lines
  show “Hazırlanır” even without credentials. The existing completed state is
  retained when all units are delivered.
* Preserve loaded history pages while applying fresh delivery progress to
  already visible orders; a new partial unit need not wait for a whole-order
  completion to update the card.
* Multi-product headers show two overlapping images: selected front, next
  product behind at +20px x / -12px y. Buttons have product names and pressed
  state. Pointer/Enter and arrow/Home/End selection do not toggle the details.
  More than two products use a bounded +N control; single-product cards keep
  the original one image. Selection is document-local, never persisted as
  customer/account information.
* Versioned order CSS, script and importing shells are updated together.

## Verification

`scripts/test-multi-product-fulfillment.mjs`: **22 checks**, isolated PostgreSQL
with real migrations and encrypted ready stock. Netflix immediately delivered
while Prime is empty; both ready; later Prime stock supplies only the missing
line; one of three units supplied immediately then only two later; three-month
stock never satisfies a one-month line; concurrent queue wakes; same checkout
request replay returns the same order; no second debit; another user denied;
0408 PIN preserved. Existing allocation code is used unchanged.

`scripts/test-multi-product-orders-browser.mjs`: Chrome and WebKit at **320,
390, 430 and 1440 px**. Partial header, each line's status/credentials/guide,
rear image exposed and selectable, keyboard switching, unchanged expand/collapse,
completion, single image, five-product overflow, and a partial progress update
after loading extra history pages. `--live-assets` compares the changed deployed
files byte-for-byte and repeats the same tests with synthetic API responses;
only public catalog artwork is taken from the live storefront.

Additional regressions: ready-stock backlog (31 checks), cancellation including
parallel delivery, Netflix Sheets identity/status/retry tests, order/debit
idempotence, profile cold/reload/cached return/retry, and per-product guide tests.
Two older broad browser scripts are not a clean full regression signal: one
still expects the removed browser-orders-placeholder and another expects the
old guide label/default tab and an old repeat-checkout fixture. They were not
rewritten to expand this task's scope. The dedicated new test covers the current
multi-product order, credentials, separate guides, copy-independent structure,
history refresh and eight browser/viewport combinations.

Raw results/screenshots/video: `outputs/multi-product-orders/`.

## Live boundary

Production observation was read-only. No real checkout, debit, ready-account
assignment, receipt, mail or Sheets mutation was initiated for testing.
Authenticated live customer rendering and a live post-payment fulfillment were
not exercised; isolated test data plus deployed-asset checks are explicitly not
represented as a real customer test. Existing background workers/queues continue
their ordinary production behavior after deployment, unchanged by this patch.
