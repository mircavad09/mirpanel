# Sifarişiniz summary and scroll — 26 November 2026

Scope: summary styles, discount icon, and scrolling into/out of the summary. Upper cart layout, quote totals, payment choice order/two-column controls, consent and submission are unchanged.

The /odenis upper-cart CTA previously scrolled directly to the payment choices below the summary. Both cart routes now use one helper targeting the actual summary start. The provisional footer has a separate ID. The helper waits once for the target/styles, measures the fixed/sticky header and performs one reduced-motion-aware scroll. No delayed second correction or image-load scroll listener is introduced. Image dimensions remain reserved; totals use the same server quote.

Summary-only rules keep the header-to-first-row gap at 14px, remove first-row top padding and inherited minimum sizes, use consistent row spacing and shorten totals/next-panel gaps. A percentage SVG replaces the diamond. No-discount/no-warranty behavior and calculations are retained.

Checks: test-checkout-summary.mjs 192 assertions; test-cart-summary-integration.mjs Chrome/WebKit 320/390/430/1440; test-summary-scroll.mjs Chrome/WebKit 320/358/390/430/1440 with single/multi/long/plain quotes, fixed header, delayed image, one scroll, edit and quantity refresh. Existing unified checkout test ran in an uncommitted copy adapted to the currently deployed one-way extra-method button (464 checks). All financial APIs were synthetic. The 358px comparison image is an isolated fixture, not a signed-in customer session. No real order/payment/balance write.
