# Checkout viewport hotfix

Based solely on production `dff7922`, in an independent worktree. No community
preview source, configuration, migration or account data is included.

Cause: modal z-index 60 was below browser bottom-nav z-index 70. The entire
payment section scrolled; sticky buttons were confined to its receipt form,
not the visible browser viewport. Short screens could hide both actions.

The payment header/footer now remain outside a single scrollable middle region.
The original receipt form submission handler still owns Continue through the
native `form="paymentReceiptForm"` attribute. No payment, upload, storage,
history, amount, stock, order or WhatsApp processing was changed.

VisualViewport resize/scroll updates modal height/top for mobile browser chrome
and keyboard panning. Safe areas are reserved. The body scroll position and inline
styles are restored on close; its navigation/support controls are hidden only
while payment checkout is active. No duplicate viewport listeners remain after
close. Checkout asset query versions are refreshed, including the page generator.

`scripts/test-checkout-viewport.mjs` uses synthetic PNG + isolated API/storage
fixtures, not production orders. It reproduces the old overlap, covers nine
viewports including 320x480, long filenames, visual viewport emulation, actual
pointer hit/click on Continue, and restores page controls on close. Existing
manual-continue and payment-method-selection suites also run unchanged.
Physical iOS keyboard/Safari hardware is not available; do not claim a device test.

No database migration, credential rotation or production test order is needed.

Targeted results: viewport suite 180 assertions; manual-continue suite 144;
payment-method-selection six responsive configurations passed. Zero JS/404 or
production mutations in these suites. Broad legacy entry points are not claimed
green: `test-payment-system` expects CMS hash `9b73ea...` but both production
`dff7922:app.js` and this worktree compute the identical `de63a4...`; old
`test-receipt-confirmation-gate` waits for removed text `Çek yoxlanılır…` while
production already uses `Fayl yüklənir…`. Neither obsolete test was changed.
