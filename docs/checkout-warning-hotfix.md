# Checkout warning and cart API compatibility (2026-11-06)

## Cause reproduced

The entry module checked only whether window.MirpanelCart existed. The old
cart-store singleton returned immediately whenever that object existed. Thus
loading a new entry module into a tab retaining the pre-draft cart left the
captured cart without commitDraft. A saved draft could exist, but the browser
could not append it and open the drawer. HTTP success/file hash checks alone
did not test this runtime combination.

The regression uses the real d79111e cart store and 65bacab entry module through
the normal order button, reproducing "cart.commitDraft is not a function".

## Fix

cart-ready.js verifies the complete public API and shares one initialization
promise. The cart store upgrades a legacy object in place, preserving existing
references, drawer, listeners and observer instead of installing another UI.
The entry rechecks readiness before commit; server-success-only drawer opening,
stable draft UUID, error retention and duplicate-click guards remain.

All bootstrap/import versions now identify this release. The backend HTML
rewriter previously overrode the shop module version with an older constant;
that actual emitted URL is corrected too. This is not merely a cache purge.

Warning-only CSS supplies icon, green product/plan subtitle, isolated scrolling
warning text, checkbox and cancel/confirm footer. Returning to the input form
removes that class and restores the existing header/field design.
No schema, financial, inventory, bank card or Gmail change is included.

## Tests

- test-checkout-warning.mjs: 72 checks, real local HTTP/PostgreSQL; exact old error
  reproduced, then legacy API upgrade preserving object identity, normal CapCut,
  ChatGPT and Netflix entry, same-document changes, refresh, double clicks,
  leading-zero code and payment/bank selection at 320/360/390/430/1440 px.
- test-cart-v2-browser.mjs: 37 checks, full isolated receipt/order flow including
  dropped draft/submit responses, retries, encrypted draft and single order.
- test-cart-v2.mjs: 40 checks, one bank-capacity slot, one receipt/order, separate
  inventory holds, cancellation/expiry, wallet rollback and account isolation.
- No production orders, payment requests or stock mutations are test fixtures.
  Browser device sizes are Chrome viewports, not physical Safari/Android devices.

Migration is not required. Existing protected drafts and cart-v2 schema remain.
