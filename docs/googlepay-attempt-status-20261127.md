# Google Pay attempt lifecycle

The read-only production audit found explicit abandonment on orders 13440 and
13442, but both history projections ignored it. Order 13431 had no abandonment
evidence and Epoint still returned `new`. Top-ups 1313 and 1325 had URL-only
widget responses, no stored transaction, and `get-status` returned `server_error`
with `record not found`. None had a verified paid/credited result at audit time.
There is no evidence here proving that the native Google payment sheet opened,
that a bank declined these payments, or that no callback was ever attempted.

## Changes

- New Google top-ups use the documented `/token/payment` endpoint. The immutable
  merchant order ID, amount and returned transaction are validated and stored.
  A generic URL-only acknowledgment cannot establish a new tracked payment.
- Authenticated explicit return abandons the customer attempt for top-ups and
  purchases. History projects it as failed; provider result remains independent.
  An error or old timestamp never establishes abandonment.
- The same history helper drives admin status and customer filters/counts.
  Order presentation retains the abandoned payment label throughout the card.
- Retry links, explicit back, browser back and cached pages preserve the chosen
  amount and move to a new request ID. A request proven absent via owned 404 can
  be discarded; a network error cannot. One successor per previous attempt and
  persisted families protect parallel tabs and restarts.
- Unknown payments continue low-frequency recovery beyond the fast-check budget.
  Signed callback transactions can still bind legacy URL-only widgets.
- Verified late success takes precedence. Duplicate callback settlement remains
  locked and ledger-idempotent. Two distinct successful transactions in one
  top-up retry family create one credit and an explicit excess-payment review;
  purchase families retain their existing single-fulfillment protection.
- No reverse, refund, real test payment, stock or manual balance change was used.

## Provider references and limits

- https://developer.epoint.az/en/token-payment/payment
- https://developer.epoint.az/en/status/get-status
- https://developer.epoint.az/en/callbacks

The provider's transaction status is authoritative. Local abandonment does not
revoke its external payment link, and the API does not claim otherwise. Legacy
widgets without a transaction may need a signed callback/provider investigation;
their age and `record not found` response are insufficient for financial closure.
The three production records without explicit abandonment were not bulk failed.

## Isolated verification

Loopback Postgres fixtures and injected transports only:

- `scripts/test-googlepay-attempt-status.mjs` and its fresh-process restart helper
- `scripts/test-payment-attempt-switch-db.mjs`
- `scripts/test-payment-return-selection-db.mjs`
- `scripts/test-epoint-four-methods.mjs`, `scripts/test-epoint-checkout.mjs`
- `scripts/test-epoint-purchase.mjs`, `scripts/test-admin-topup-finance.mjs`
- `scripts/test-payment-history-status.mjs`

Chrome and WebKit with simulated provider/capability responses, at 320, 390,
430 and 1440 pixels:

- `scripts/test-googlepay-attempt-browser.mjs`
- `scripts/test-payment-attempt-switch-browser.mjs`
- `scripts/test-apple-compact.mjs`

These tests do not certify a real device wallet or a real Google Pay payment.
