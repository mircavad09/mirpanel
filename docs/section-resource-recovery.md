# Customer resource recovery

The screenshot text comes from `page-navigation.js`'s 15-second `Promise.race`
around a native dynamic import. The old loader neither cancels that physical
import nor observes its later success. It replaces the route with an error and
only the button starts another load. The route also had a separate 20-second
controller spanning HTML and CSS. These deadlines could disagree with the
actual resource state. Profile/tab modules had similar one-shot races.

The regression test reproduces the old terminal error with a deliberately slow
module: the module finishes, but the old screen remains failed. Durations in
this reproduction are scaled to 150/400ms to keep the suite fast; it exercises
the original code from commit 3fb52cde. The original customer request's network
trace is unavailable, so no claim is made about its precise network delay.
Before this release the live old loader and old shop URL both returned 200;
there was no evidence of a removed hashed bundle at those URLs.

`request-recovery.js` shares bounded recovery for resources and explicit reads.
There is an initial attempt plus at most three attempts after 1/3/7 seconds.
429 observes Retry-After. Offline work waits for online; a disposed subscriber
stops waiting. A shared physical module evaluation is not restarted merely
because it is slow. A genuinely rejected native import gets a recovery URL.
`module-recovery.mjs` propagates that token through static same-origin imports
on both the edge and backend, including already-poisoned dependency URLs.
Existing public asset paths are retained. JS/CSS revalidate instead of serving
a five-minute backend asset snapshot. No page reload is used.

Initial script/CSS failures are covered before route startup. Route-managed CSS
has its own status-aware recovery and is excluded from the initial-file handler.
The failed initial load, profile tab, wallet loader, inventory and cart can resume
on reconnection or a return to the document. Exhaustion retains manual retry;
failed inventory/cart reads stop their old automatic timer retries. Existing
successful views/forms are not remounted by the recovery status indicator.

Read recovery does not replay checkout, payment, upload, submit, delivery or
other mutations. Only the explicitly allowlisted POST `/shop/quote` is a read.
The previous top-up upload/submit reconciliation and operation keys remain in
place. No customer forms, receipt Files, credentials or private response cache
are written to persistent browser storage by this mechanism.

Validation:

- `test-section-recovery.mjs`: 80 Chromium/WebKit assertions; original timeout,
  delayed module single evaluation, initial JS/CSS failure, 5xx, interrupted
  connection, timeout, Retry-After (real one-second wait), offline/online,
  hidden/visible, cancellation, cached native dependency error, true 404,
  401/403/422, form/File/cart state, and no mutation replay. Backoff is compressed
  to 20/40/70ms in fault tests; production constants stay 1/3/7 seconds.
- `test-topup-receipt-recovery.mjs`: 82 real local HTTP/PostgreSQL and mobile
  Chromium/WebKit checks, synthetic JPG/PNG/PDF, 5MB, lost response, one upload,
  one reviewing top-up, separate accounts, zero wallet ledger credits.
- `test-section-navigation-smoke.mjs`: actual public templates, synthetic API,
  390/1440px Chromium/WebKit; home, listing, CapCut/Netflix/HBO, consent, history,
  unchanged shared header. Explicit current consent flag in the fixture.
- `test-shop-proxy.mjs`: 54 checks. Syntax and whitespace checks pass.

The older full `test-navigation-product-return.mjs` is not claimed to pass:
its quote fixture omits the current consent flag; when supplied, the suite later
hits an unrelated existing category/search filter mismatch (15 visible versus
1 expected). That product/filter implementation is unchanged. The separate
smoke above covers the navigation paths relevant to this release.

No real payment, order, receipt upload or customer balance modification is used
for deployment verification. Live checks verify the deployed files, dependency
token propagation, navigation and guest authorization behavior.
