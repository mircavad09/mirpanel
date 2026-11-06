# Cold modal styles and reserved-card access (2026-11-06)

## Evidence / causes

1. The warning appended a stylesheet but immediately called showModal(). With
   the previous released entry and a delayed CSS response, the normal order click
   reproduces a white native dialog and an SVG wider than 100 px. The router could
   also register this late stylesheet and disable it on the next page.
   Entry now awaits CSS load, reports load failure, reenables an existing sheet,
   and marks the shared sheet as persistent outside route style toggling.
   The warning SVG also has intrinsic width/height as a defensive bound.
2. Netflix's configured Ad / Otaq kodu form does not need a redesign. Its existing
   dark form is preserved and shares the correctly loaded/persistent stylesheet.
   The same configured four-digit string input preserves 0012.
3. The payment queue deactivates a card for NEW customers after its last slot is
   reserved. The unscoped method-details endpoint treated active=false as denial
   even to the customer holding that valid reservation. The real SQL fixture
   reproduces that transition. Method details now accept a cookie-owned checkout
   context, verify method ownership + actual unexpired reserved row, and allow
   this existing hold. Manual disable/archive/delete still deny access.

The public live methods response was 200 with four available cards, plus one
temporarily busy and one limit-reached card. This is evidence against interpreting
the supplied generic error as "all production cards are full"; no real reservation
was created to reproduce a particular customer's incident.

## Recovery

- A genuinely unavailable selected card renders an in-page retry/alternative
  choice without discarding protected cart inputs or touching other customers.
- Selecting another card uses the normal cancellation of ONLY that customer's
  old hold. An uploaded receipt requires explicit user confirmation before this.
- Expired checkout DTOs are reported as expired. The browser resumes selection,
  clears only the obsolete local checkout pointer, and retains cart/draft data.
- Network failures are not labelled as full card capacity. Truly full card lists
  explain capacity and keep checkout disabled with a retry action.
- Submit-time conflicts reread the existing checkout rather than create an
  automatic second order. Existing idempotency and inventory transactions remain.

## Regression

- test-checkout-recovery.mjs: 38 checks. Before/after cold CSS proof, actual router
  style preservation, disabled-sheet recovery, Netflix Ad/0012, no-fields package,
  both payment choices, last slot, refresh, manual disable and another card,
  expiry, real receipt safety/storage + single parent order, all cards genuinely
  full. Chrome 390/1440, isolated HTTP/PostgreSQL/private local storage.
- test-checkout-card-context.mjs: 7 checks. Actual queue snapshot deactivates the
  last-slot card; unscoped access denies it, owned valid hold permits it; other
  owners, manual disable and expiry remain denied.
- test-checkout-warning.mjs: 72 checks, CapCut/ChatGPT/Netflix, legacy API upgrade,
  same-document switches, refresh and four mobile widths plus desktop.
- test-cart-v2.mjs: 40 checks, encrypted inputs and one order/receipt/bank slot,
  inventory/cancel/expiry/wallet invariants.
- test-cart-v2-browser.mjs and proxy regression retained.

No migration required. No production limits, counters, reservations, orders,
balances or Gmail queue were edited. Full financial/write testing is isolated;
live validation is limited to public responses, asset versions and warning UI.
