# Product purchase actions — 27 November 2026

Only product-page purchase actions change: the dynamic i18n renderer keeps #pp-order-btn as İndi al without changing catalog or checkout labels. The injected cart button uses Səbətə əlavə et consistently. Scoped cart CSS gives equal 50px rounded buttons, yellow→gold/orange gradient/inset highlight/soft shadow, black primary text and 2px yellow cart outline; no repeating animation. CSS/module cache entries are refreshed.

Existing order-confirmation capture handler and server-verified cart-entry flow are preserved. Both product actions use the existing selected plan, required terms/fields and guarded commit. The established cart opens after commit; no payment starts. No independent handler or duplicate add is introduced. Stock and package accordion code remain untouched.

Synthetic Chrome/WebKit 320/390/430/1440 checks use actual order-confirmation/cart-entry/cart-store/i18n modules: labels, gradient, equal height, 2px border, overflow, selected six-month vs one-month plan, rapid duplicate clicks produce one draft/add per action, desktop sidebar/mobile dialog, zero financial endpoint writes. General product-pages test currently expects22 generated pages while active catalog yields16; this pre-existing content count mismatch is outside this UI change and is not reported as passed.
