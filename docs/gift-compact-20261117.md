# Four-column product gifts

## Scope and behavior

- Live influencer gift choices use four columns on mobile and desktop. Cards end immediately after their price, align at their own content height, and show short gift-only titles. Names wrap to at most two lines. The original full title, product ID, plan index, amount and plan name remain in quote/order snapshots.
- A package click only updates local selection. “Hədiyyə et” requests the quote and opens confirmation. A sole available package is selected visibly, but still requires the continue button. Confirmation and final wallet payment remain separate; the server still validates price, stock, recipient, consent and idempotency.
- Final payment starts disabled until the terms checkbox is selected. In-flight consent/payment controls are disabled. Returning from wallet still preserves selection, re-quotes, and never purchases automatically.
- Gift policy now supplies its own factual product-gift terms and an empty field schema. Donor email/password/player IDs are not requested, persisted or used for activation. Spotify, Canva and games enter the existing admin gift presentation queue. No automatic supplier dispatch, ready-account allocation or donor account ownership is added.
- Only personal ChatGPT product/plan variants are offered; shared/ortaq/ümumi variants are rejected in the server quote/checkout path too. Ordinary purchases retain their existing account fields, supplier flow and terms.
- All modifications are scoped to influencer product gifts. No production stock, balance, user, order, influencer status or catalog price is edited by release.

## Verification

`test-live-influencers.mjs` uses a disposable local database to verify Spotify/Canva/ChatGPT/game gifts with no donor details, dedicated terms, full identity snapshots, one order/debit under parallel and repeated requests, manual gift queue/presentation, shared ChatGPT rejection, and ordinary purchase validation retained.

`test-gift-layout-browser.mjs` uses the production dialog, chat and wallet modules against isolated local responses. Chrome/WebKit at 320/390/430/1440 cover four columns, 25 products/long names, price-to-card-bottom spacing, explicit package continuation, one-package selection, consent enable/disable, exact balance shortfalls, wallet return, browser Back/BFCache return, no automatic checkout, double-click, stock loss and retry. Test quote terms use the same production gift policy rather than synthetic customer-facing text. Screenshots are written to `outputs/gift-compact`.

`test-live-influencers-browser.mjs` retains the previous request-recovery and admin/message regression coverage, updated for the explicit package continue action. Its lost checkout response scenario retries only the same payment, including current stock reaching zero. No real supplier purchase or customer operation is performed.

After deployment, live static assets and public message → product → package → quote rendering can be checked read-only. Funded final payment and top-up-return screenshots remain isolated tests; never present those as real customer payments.
