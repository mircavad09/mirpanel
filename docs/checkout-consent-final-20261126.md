# Checkout consent and final action — 26 November 2026

Scope: the checkout consent, final submit presentation, missing-consent prompt, method-specific explanations and trust facts. Product tiles, basket/summary internals, pending-payment guards, callback verification, money/stock/fees and delivery remain unchanged.

## Legal qualification

The requested universal wording “məhsul təqdim olunduqdan sonra yeddi iş günlük imtina hüququnun tətbiq edilmədiyi” was not copied as an unconditional waiver. Current Electronic Commerce Law article 9.1 establishes a seven-business-day withdrawal right, and 9.5.1 provides an exception when performance begins in that period with the buyer's consent (unless otherwise agreed). Articles 9.4 and 10.2 also protect refunds under their respective conditions. Delivery alone is not a universal waiver of defect/non-delivery rights. Sources reviewed: https://frameworks.e-qanun.az/10/f_10406.html and the consumer authority's withdrawal guidance at https://istehlakchi.gov.az/az/istehlakciyam-huququm-var/elektron-ticaret/muqavilenin-icrasindan-imtina .

The displayed and stored execution statement therefore ties the exception to the customer's express agreement to immediate performance, actual commencement within seven business days and cases provided by law, while explicitly preserving statutory defective/non-delivered-product rights. Existing site terms and refund implementation were not rewritten.

## Consent record

The shared, versioned `checkout-consent.js` is the source for browser and server text. New clients send `checkoutConsentVersion` along with the existing current `documentPolicyVersion` and `consentAccepted:true`. Server rejects false consent, an unknown statement version or a stale/missing document policy when the new statement is claimed. It writes the exact statement, `statementVersion`, `immediateExecutionConsent` and database acceptance time inside the existing immutable `orderConsent` snapshot. This is also exposed in the existing order document. Existing idempotent orders retain their original statement and time. Legacy clients are not retrospectively recorded as agreeing to the new execution statement. No existing snapshot is backfilled or changed.

## Interaction and evidence

An otherwise-ready CTA stays gold before consent and performs only local validation on the first click. It highlights/focuses the checkbox and shows the yellow prompt; checking clears both without creating payment. Only a later explicit CTA click enters the existing guarded `run()` / submit path. Pending/stock/missing-details/insufficient-balance guards still disable submission. Sending blocks repeated clicks; provider failures restore the CTA. Cancel preserves the existing payment-abandon path.

Visa/Mastercard explanation appears only for card; other methods have their own explanation. Completed order count reads the existing `/api/payments/storefront.completedOrders` exact order-count metric, not product-unit totals, baselines or hard-coded social proof. If unavailable, the count is omitted. The stock statement is expressly scoped to ready products in stock, not all manually prepared services.

Isolated tests cover Chrome/WebKit at 320/390/430/1440, unchecked/warning/accepted screenshots, all three legal links without checking, method hints, live-format count response, server errors, two rapid clicks, reduced motion and bottom-menu clearance. Database tests cover false/stale consent rejection, one debit, saved statement/version/time, document inclusion and unchanged legacy snapshots. Browser tests use synthetic users/orders and provider interception; no physical iPhone/Android test, real payment, live order or balance write is performed.
