# Direct product payment access — 24 November 2026

Scope: payment selection, hosted-card opening, resumable attempts and presentation only. The purchase settlement writer, stock allocation worker, account preparation, delivery rules and historical financial data are unchanged.

## Incident evidence (read-only)

- Order 13317: created 15:34:09 Baku, Birbank wallet, 15.99 AZN. Epoint `te024299402` returned `error / canceled`; the wallet URL was issued and responds HTTP 200. The stored evidence proves cancellation at the provider; it does not establish whether the person cancelled intentionally or the bank/app caused the cancellation.
- Order 13318: created 15:35:26 Baku, Apple Pay, 15.99 AZN. Epoint `te024299468` is successful, accepted at 15:36:06 Baku. Existing payment and delivery records were not modified. Thus this particular Apple Pay attempt is not a failed payment. No earlier unrecorded device failure is inferred.
- Ordinary card payments were absent from the product method list, excluded in server configuration and the purchase method constraint, and lacked an enabled product-card setting. The old hosted-card gate remains separate from the newly scoped product-card setting.
- Exactly one owner-authorized unpaid 1.00 AZN card opening request was issued: `te024300671`. The existing saved URL is reused by the operational check. Epoint returned `https://ecomm.pashabank.az:443/ecomm2/ClientHandler?...`; the real bank page responded 200 and was visibly opened in Windows Chrome, showing Mirpanel, 1.00 AZN and empty card fields. No card data was entered or submitted. Provider status remained `new`. No MirPanel order, wallet entry, delivery or supplier purchase was created.

## Behavior

`EPOINT_PRODUCT_CARD_ENABLED=true` enables only hosted product-card purchases. Preserve `EPOINT_CHECKOUT_ENABLED` and all other method settings. Append only the verified exact gateway host `ecomm.pashabank.az` to `EPOINT_REDIRECT_HOSTS`; preserve HTTPS, origin and credentials checks. Card fields exist only on the bank page.

Choose package and required product details, select a method, accept the existing legal checkbox and press the single amount-labelled CTA. Selection alone does not create or redirect. The duplicate confirmation dialog was removed. If wallet funds are insufficient, the first available direct method is preselected without starting payment; the person can still choose wallet.

One database session lock per customer serializes product opening requests across tabs. Same item identity (including immutable details tags and terms), amount and an unresolved attempt resume the existing checkout even after a new browser request ID or method selection. Fresh provider status is checked before deciding. Unknown/transport failures are not permission to create another payable attempt. Definite provider cancellation or definite no-issued rejection permits another attempt. The original request ID always reuses its record, including paid results. A brief post-payment replay guard protects concurrent distinct IDs while allowing a later deliberate reorder. Server-confirmed success uses the existing success screen.

Apple Pay remains iPhone plus positive Apple capability, with the existing domain and merchant gates. Google Pay remains Android plus bounded CRYPTOGRAM_3DS readiness. Recognized embedded browsers do not mount an unsupported wallet. Short Safari/Chrome/card guidance replaces blank-wallet paths. m10 remains disabled in production.

## Verification limits and sources

Database and browser fixtures cover hosted card, Apple Pay, Google Pay, Birbank/m10 regression, two clicks, ownership, mismatched amounts, callback replay, response loss, pending-method reuse, definite cancellation replacement and success/result refresh. Chrome and WebKit at 320/390/430/1440 are simulated browser/capability checks, not physical iPhone/Android testing. Existing paid preparation and delivery regressions remain unchanged.

Current references: https://epoint.az/en/faq (Visa/Mastercard acceptance and external bank card storage), https://developer.epoint.az/en/check-credentials (plain server-only form; does not enumerate method entitlements), https://developer.epoint.az/en/wallet/wallet-payment (wallet redirect, not a universal bank-card form), https://developer.epoint.az/en/token-payment/payment . Birbank's general ability to add other-bank cards is not a guarantee that every such card is eligible for this merchant's wallet checkout; only the bank determines eligibility. No “Birbank card required” or universal-card claim is introduced.
