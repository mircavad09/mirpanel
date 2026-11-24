# Epoint return result (2026-11-24)

Confirmed live before the change: the return HTML used the generic waiting view, and `epoint-wallet.js` returned silently when no valid reference existed. It read wallet session drafts but not the direct-purchase local draft. A confirmed purchase redirected to a second checkout page instead of rendering the result here.

The return now preserves a reference on the payment page, reads the saved direct-purchase reference, and can resolve an unambiguous recent owner-scoped request on the server. Multiple recent requests are explicit choices. Ownership is checked before the existing provider reconciliation. Success still requires the existing committed purchase confirmation or committed wallet credit. URL success/amount values have no authority.

The result reuses the premium checkout CSS, including the existing white shimmer on the order link. Actual delivery records determine delivered/preparing copy; payment success does not wait for delivery. Wallet results show the credited amount and current balance. No new payment, settlement, delivery, refund or balance write is introduced by the return UI/resolver.

Automatic reads use 1, 2, 3, 5, 8, 13, 20 and 30 second delays, then stop with a reference/history link and manual check. Existing server reconciliation continues independently with its existing limits/operator-review safeguards. Network failures also retry within this budget. Page restoration resumes safely without a full reload loop.

Verification: `test-epoint-return-result-browser.mjs` (Chromium/WebKit 320/390/430/1440, fake URL success rejected, callback delay, delivered/preparing, wallet, reload, saved/missing/ambiguous reference, unauthorized lookup, transient failure, bounded nine reads, shimmer/reduced motion); `test-epoint-return-proxy.mjs` (GET/session/private cache only); existing purchase, cancellation, callback, checkout, widget recovery, return and success-button suites. All payment/provider responses and financial records in these tests are isolated synthetic fixtures. No real charge, cancellation, delivery or wallet mutation is used.
