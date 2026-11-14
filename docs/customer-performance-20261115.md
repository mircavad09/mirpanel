# Customer performance investigation — 2026-11-15

Baseline: main `655dcd5`. Scope is performance only; no pricing, payment,
inventory, delivery or authorization rules have been removed.

## Confirmed causes and changes

* Route navigation disabled loaded no-store stylesheets. Browsers fetched them
  again on return; merely toggling media still refetched in WebKit. Keep the
  parsed same-origin, non-imported rules in document memory, rebase relative
  resource URLs, and switch their media. External/imported sheets retain the
  normal loading path. This cache contains public CSS, not customer content.
* Every price refresh rebuilt cards and emitted a price-change event, even for
  identical prices. Checkout listened to that event and rebuilt/requoted itself.
  Compare owner and the complete price snapshot; emit only for actual changes.
  Retain confirmed same-account prices after a transient read failure. Account
  switches, sign-out and page lifecycle still clear private prices. Checkout
  continues to verify the current price on the server.
* Catalog inventory polling ran every two seconds. Focus and visibility events
  destroyed/restarted the catalog scope, duplicating reads and sales requests.
  Reuse the scope and coalesce inventory refreshes with a ten-second freshness
  window. Clicking buy still obtains fresh authoritative inventory. Route exit
  aborts pending work and cannot display an old-route error.
* Catalog reads still depended on AbortSignal.any/timeout, unlike the recently
  fixed shared checkout. Reuse the compatible deadline/cancellation helper.
* Wallet rendering waited for an independent full community-profile response
  and downloaded ledger/top-up history that this page no longer displays.
  An additive authenticated `wallet?summary=1` returns the verified owner and
  balance. The form can render without the profile response; legacy responses
  retain a guarded fallback. Draft storage is keyed by the verified owner.
  Existing history API behavior and all account/release checks remain intact.
* Live remeasurement also exposed slow origin-rendered wallet HTML (up to
  3.8 s before any wallet request). Reuse the cart's edge-rendered public shell
  for `/balans`, retaining the same header/loading/footer and return behavior.
  Personal balance and every operation remain API-authorized; no private data
  enters the shell. Lazy-load the top-up form only on the wallet route so cart
  and checkout no longer wait for an unused receipt-form module.

## Measurements and reproducibility

Live browser baseline and post-release runs use
`scripts/measure-customer-navigation.mjs`, three new contexts per profile:
Chrome 1440×850 normal network, Chrome 390×850 weak network (150 ms RTT,
200000 bytes/s down, 90000 bytes/s up). Identical route order, no live writes.
Guest profile timings are login/redirect timings, not authenticated lists.

`scripts/test-customer-performance.mjs --before` serves revision 655dcd5 and
the normal command serves current files, with identical isolated responses:
200 ms wallet, 2500 ms unrelated profile response, 200 ms no-store stylesheets.
Chrome mobile/desktop and WebKit mobile cover unchanged/changed prices,
account switch, transient errors, repeated focus, absent AbortSignal.any and
timeout, stock rendering, and return-navigation stylesheet request counts.
`--live-assets` byte-checks the deployed files, using synthetic API responses.
Source reads from Git are performed before the timed browser work.

`scripts/test-profile-loading.mjs --measure [--baseline|--live]` records cold,
reload, cached-return and tab-focus times for orders/codes/subscriptions with
synthetic owned responses. The full test also checks retry and retained content
on Chrome/WebKit mobile and desktop. These are not real customer sessions.

Safety regressions: `test-order-abort-compat.mjs` (eight product field sets,
lost reply, retry UUID, timeout, account switch); isolated PostgreSQL
`test-order-retry-idempotence.mjs`, `test-wallet-summary.mjs`,
`test-topup-limits-postgres.mjs`; `test-topup-choices.mjs` (1151 checks),
`test-receipt-upload-regression.mjs` (19 checks),
`test-receipt-upload-only.mjs` (212 checks, 18 browser receipt cases), and
`test-catalog-search-recovery.mjs` (11 cases per browser/viewport).
Receipt fixtures now serve the real optional checkout sound assets; the stale
top-up test expectation was updated to the current Azerbaijani payments URL.

Raw measurements are in `outputs/customer-performance/`. No production orders,
uploads, payments or customer data were created by these tests.

## Remaining infrastructure latency

Read-only Render metadata reports **Oregon, free plan**. The database pooler
is **eu-central-1 (Frankfurt)**. Live state Server-Timing repeatedly measured
about **146 ms per database round trip** (release and state each), while auth
without a session was under 1 ms. Public HTML was about 100–150 ms warm TTFB;
inventory API about 0.5–1.1 s. Public HTML is DYNAMIC/revalidated; personalized
APIs correctly remain private/no-store and must not enter a shared edge cache.

A separate Windows-to-database read-only probe measured roughly 93–96 ms warm
transport, and EXPLAIN ANALYZE SELECT 1 execution was 0.027 ms. Its initial
connection was slower (up to 2.8 s); this is not a Render execution measurement.
No platform cold start was deliberately induced or proven in this run.

Concrete infrastructure follow-up: deploy the service in Frankfurt near the
database and cut traffic over after health/security checks; choose a paid,
always-on Render plan if eliminating free-plan idle suspension is required.
No region migration, billing change or production restart was performed as a
diagnostic shortcut. Authenticated live order/code/subscription and receipt
completion timings still require an authorized test customer session; fixtures
cannot substitute for that live measurement.
