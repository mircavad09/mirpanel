# Cart notice overlay and bounded quote loading

Scope: cart feedback and request presentation only; no payment/provider, order,
balance, reservation or fulfilment mutations.

## Cause and correction

The existing toast stack was intentionally reparented into the native cart dialog.
Its relative-position CSS and fourth grid row pushed the cart header down. A new
native modal layer now holds the unchanged-size cart and the fixed notification
stack as siblings. This is necessary because a plain body-level z-index cannot
appear above a native modal dialog. Focus trapping, Escape, backdrop dismissal,
scroll locking and toast X controls remain functional.

Independent five-second clocks, append order and animated dismissal are retained.
Moving the stack preserves elapsed countdown time. Closing the cart moves the
stack back to the document without resetting or deleting notifications.

Unique in-flight quote requests are tracked separately from renders and shared
callers. At 350 ms a pointer-transparent central loading indicator is shown. It
stays until all requests finish, and is cleared on failure, cancellation or the
12-second request deadline. Closing the popup also aborts its outstanding quotes
and removes the loading shade without removing notification timers. Cart edits and checkout clicks are blocked while a
quote is pending, not unrelated page actions. Delayed responses cannot overwrite
the current cart's cached stock/price preview. An unchanged quantity or repeated
identical token selection emits no success notice. The existing known-stock
quantity limit also applies to direct quantity changes.

## Isolated verification

- `scripts/test-cart-notice-stack.mjs`: Chrome/WebKit, 320/390/430/1440; independent
  real five-second clocks, four notices, no replay duplicates, X, reduced motion,
  stock rejection and notices after the cart closes.
- `scripts/test-cart-overlay-loading.mjs`: same browsers/widths; fixed outside-cart
  layer, unchanged header bounds, delayed/parallel/out-of-order responses, 503,
  actual 12-second deadline, abort cleanup, Escape/backdrop and zero financial
  writes. Screenshots use isolated fixtures, not customer accounts.
- Existing cart window and order-summary browser suites are also run to check
  geometry, totals, savings, scroll restoration and unchanged checkout UI.

No real order, payment, account delivery or balance change is part of these tests.

Results: notice suite 185 assertions; overlay/loading suite 133 assertions, both
Chrome/WebKit at all four widths, zero financial writes. The existing summary
integration suite passes all eight browser/width combinations. The older window
suite passes Chrome mobile widths but stops at its empty desktop inline-cart
`compact < 700` assertion. Re-running with the unchanged `feca1c1d` cart assets
reproduces that same failure; it is not introduced by this change.
