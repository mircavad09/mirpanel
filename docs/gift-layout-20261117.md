# Influencer message and gift layout

## Scope

Only shared influencer presentation, the existing live gift dialog and gift-specific balance return have changed. Influencer permissions, recipient identity, product prices, quote/checkout validation, wallet debit rules, stock allocation and gift presentation on the server are unchanged. No production gift or payment is needed for verification.

1. Influencer messages reuse the ordinary/admin bubble geometry, with a black/gold bubble. Name and badge remain in the header. An absolutely positioned icon has a 44×44 hit area without adding a 44px row. The moderation menu remains outside the painted bubble.
2. Product choices are a five-column grid at 320, 390, 430 and desktop widths. Images have a reserved aspect ratio; full accessible product names wrap, yellow prices align at the bottom, and the modal scrolls vertically.
3. Product image/name precede the packages. Package name is left, bold yellow price right, and the previous selection is marked with a gold border/check when returning to packages.
4. Summary places the package-back action at top right, recipient and product/package on their own rows, a large yellow total, and a full-width payment action.
5. Insufficient balance uses the orange wallet panel with current balance, exact shortfall and the requested explanatory sentence. No cart-return action is introduced into the gift flow.
6. Gift-specific wallet URLs retain the existing safe `/qrup` return target with `flow=gift`. Wallet/login return actions say “Hədiyyəyə qayıt”. The gift draft retains recipient, product, plan, request ID and payment stage. Returning through the link, browser Back or BFCache fetches a fresh quote/balance and restores the payment screen. Consent and an explicit click are still required; return never submits checkout automatically.

Uncertain checkout attempts retain the original buyer key and idempotency request. They can only check the same payment again, including if current stock has since reached zero; a fresh purchase is not created. Fresh out-of-stock selections remain blocked.

Entry/module/style versions are advanced for direct loads, admin views and client-side navigation. No unrelated product/page design was changed.

## Isolated verification

- `test-gift-layout-browser.mjs`: real live-gift, chat and wallet modules with local synthetic transport, Chrome/WebKit at 320/390/430/1440; short/admin bubble sizes, 44px icon hit target, 25 products/five columns, selected package and price, long names, exact 0.00/1.25 balance shortfalls, direct wallet return, Back and explicit BFCache restoration, re-quote, no automatic purchase, consent, double-click, stock loss and quote retry. Six screenshots at 390 and 1440 are written under `outputs/gift-layout`.
- `test-live-influencers-browser.mjs`: prior live-component flows, role grant/revoke, real-view local messages/deletion, gift product/package/payment screens, lost checkout response and exactly-once retry, including retry after the last stock unit is reserved; login/top-up return. Synthetic endpoints only.
- `test-influencer-interactive-browser.mjs`: existing isolated admin preview remains functional at all four widths in Chrome/WebKit.
- `test-live-influencers.mjs`: disposable local PostgreSQL, parallel gift request yields one order/debit, role/owner authorization, gift queue, presentation replay and unchanged ordinary purchases.
- `test-page-navigation.mjs`: isolated navigation regression checks. Its artificial benchmark is not a live-site performance measurement.

Production checks must use only public reads and quote inspection; never click the final live checkout button. Public/anonymous live rendering and isolated funded/insufficient-balance scenarios must be reported separately.
