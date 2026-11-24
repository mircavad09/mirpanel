# Epoint incident: 24 November 2026

The database confirms orders 13290/13291, both 5.99 AZN and linked to the same
customer. Both originally had zero delivery records and `payment_confirmed=false`.
Times below are Baku (UTC+04), not UTC.

| Record | Created | Provider evidence |
| --- | --- | --- |
| 13290 | 06:53:45 | Google Pay purchase `9b4ab8a5-7c77-45f7-b777-69a36b1a1d34`; get-status by its merchant order returns record not found. No success is asserted. |
| Separate balance intent | 06:54:52 | Birbank top-up `5e357a86-2f0b-423f-956c-75fb44e75dac`; transaction `te024286552`, success, 5.99 AZN. |
| 13291 | 06:59:50 | Birbank purchase `97fb9a9a-39cd-4824-8058-2286c4d8b975`; transaction `te024286579`, success, 5.99 AZN. |

The bank receipt numbers 2806520538 and 28065232711 are NOT Epoint transaction
IDs. The provider's bank_transaction identifiers and RRNs differ from those
receipt numbers. Time/amount/customer are consistent with the two Birbank
payments, but an exact bank-receipt-ID match is not claimed. Merchant-scoped
signed status calls independently confirm their amount, application order IDs
and transactions; the API omits currency, so stored AZN intent and explicit
currency rejection checks are retained.

Verified callbacks reached the server at 06:55:11 for te024286552 and 07:00:39
for te024286579 and retried with HTTP 409. Status queries return `status:success`
and `code:succeeded`, while the previous reconciler required numeric `000`.
Thus the callback was not lost: the status-code contract rejected it. Both
purchase reservations expired after ten minutes. The previous delivery worker
permanently diverted a late successful payment to stock review even with stock
available. Five Netflix room units were available during initial inspection.

Changes:

- Accept the observed exact `succeeded` code only with success, matching immutable
  merchant order ID, amount, currency rules and provider transaction. Arbitrary
  bank codes still fail closed. Mismatches never settle a payment.
- Direct Apple/Google Pay purchases use the documented token/payment creation
  response with transaction, merchant order and amount validation. The old
  widget-only intents can still recover by their immutable merchant order ID;
  record-not-found remains unresolved, never forced successful.
- Persistent server reconciliation backs off, retains sanitized failure reasons
  for admin and stops its automatic error batch after ten failures. No browser
  or success redirect is required. A successful direct purchase never falls
  through to a wallet credit.
- A late paid purchase checks actual remaining units in the existing stock
  allocator. Missing stock stays awaiting_stock and is rechecked after one
  minute, including after restart. Concurrent runs use the existing fulfillment
  lock and delivery totals. Stock replenishment can finish a partial order once.
- Cancellation holds are durable, server-enforced and guarded by a trigger on
  delivery/API dispatch. 13291 was held before any settlement recovery. No refund
  is implied by a hold. The customer/admin projections distinguish pending
  payment, paid/preparing, actual delivered units and cancellation review.
- An operational recovery hold pauses the incident's separate top-up while the
  owner decides whether to apply it to 13290. No new funding movement is inferred
  from a generic “continue”. This is distinct from restoring 13291's verified
  payment bookkeeping, which must not allocate an account while held.

Initial read-only scan of every pending Apple/Google/Birbank request found 52
records: 9 exactly matched successful payments (6 purchases, 3 top-ups), 24
provider errors/cancellations and 19 record-not-found/server-error responses.
The six paid purchases include held 13291. Unknown records are not marked paid.
Cancellation/refund requests are separated before fulfillment recovery.

Validation: 163 isolated direct-purchase PostgreSQL assertions; missing callback,
nested transaction creation, real succeeded-code semantics, mismatch rejection,
parallel/repeated notices, distinct transactions, no direct-purchase wallet credit,
expired reservation with actual stock, partial stock shortage/replenishment,
restart-compatible persisted work, and held second payment with zero delivery or
refund. Existing widget recovery and 384 Chrome/WebKit browser assertions at
320/390/430/1440px pass. All payment/provider endpoints in these tests are local
fixtures. No new real payment or supplier purchase is created.

Operational state and final verification must be reported separately from these
test results. In particular, payment confirmation is never reported as delivered,
and 13290 cannot use the unrelated top-up without the owner's funding decision.

Provider reference: https://developer.epoint.az/en/token-payment/payment
