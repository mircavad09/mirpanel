# Seller order routing

Entry: `https://mirpanel.com/satici`. Admin: the **Satıcılar** menu in the main
admin panel, including the mobile menu's product-management group.

This extends the existing verified customer identity and encrypted delivery
records. It does not create another password store, grant administrator access,
or modify the employee roles. A seller must accept a 48-hour single-use invite
with the exact verified Gmail identity. The invite token is random, hashed for
lookup and encrypted for its durable mail job. It is passed as a URL fragment,
removed from browser history on load, and not placed in persistent browser
storage. After signing in, reopen the original email link to accept it.

Admin steps:

1. Enter the seller's name and the Gmail address supplied by the owner. Send the
   invitation. The English email uses MirPanel's existing order-mail sender and
   shared provider gate. No invitation is sent during deployment.
2. Once accepted, select a product and package, select active sellers, and enable
   **Satıcılara avtomatik yönləndir**, then save. Every package opts in separately.
3. The durable worker runs independently of the owner's browser. Only orders
   created after that route was enabled and confirmed paid on the server enter.
   Older orders are not silently migrated. If nobody is eligible, the normal
   admin delivery queue remains the fallback.
4. Review delayed jobs (30 minutes), claims, passes and completions in this menu.
   A returned job with uncertain external work or a disabled claiming seller
   enters Needs review. Admin may release it only after explicitly confirming
   no external delivery/activation occurred and recording a reason.

Each task refers to the existing order and line, with its remaining quantity.
Claim, pass, completion and administrative changes use the same transaction lock
as existing fulfillment. Completion calls `adminDelivery` using that transaction
and a stable request UUID. Its delivery record, existing customer notification,
seller state and audit commit together. Repeated completion cannot add another
delivery. One unit/account is completed at a time. The existing delivery totals
determine whole-order status, including multiple products and partial delivery.

The list contains only product/package, quantity, code and current claiming
seller. Claim IDs are returned only to their owner. Product-specific decrypted
inputs are available only through the current-claim endpoint. Every request
rechecks seller activation, email verification, route membership, claim ownership,
payment, cancellation and competing fulfillment. Passwords are masked initially;
Show/Hide is explicit. The browser clears details on tab hiding, navigation,
deactivation or a claim change detected by the five-second poll.

Database guards keep ready-stock automatic delivery, legacy employee assignment
and API dispatch from taking a routed task. An active API or automatic ready-stock
mapping cannot be enabled over an active seller route. Existing API/supplier,
Netflix room-stock and scheduled-renewal paths cannot be enrolled. A supplier
attempt, even a failed one, requires its original flow's review rather than being
silently sent to a human seller.

Durable mail rows have unique per-invite/per-task-per-seller event keys. Temporary
rejections use bounded retries and respect the shared provider gate. Resend
uncertain acknowledgements reuse the same provider idempotency key within a
conservative 20-hour window; older uncertainty requires review. A transport
without provider idempotency never blindly retries an uncertain acceptance.
Notification emails contain no buyer credentials or buyer contact information.
No seller pay, payouts or new cost accounting is introduced.

Schema is installed transactionally under a separate migration lock during the
existing community initialization. New routes start empty and disabled. No
customer order, real invitation, seller role or payment is changed on deployment.

Validation: `test-seller-routing.mjs` passes 98 isolated PostgreSQL/HTTP/browser
checks, including three-way concurrent claim, repeated completion, restart,
cross-seller/customer privacy, pass/reclaim, uncertain activation review, expired
invite, deactivation, multi-product partial fulfillment, no-eligible fallback,
already-delivered exclusion, API mapping conflict, uncertain/delayed mail and
unchanged buyer ledger during sync. Mobile 390px and desktop 1440px Chromium and
WebKit verify masked/revealed credentials and admin controls; screenshots use
synthetic data only. No production emails/payments/orders are created by tests.

`test-spotify-delivery-postgres.mjs` passes existing prefill/edit/encryption,
owner-only delivery and single-delivery/mail retry checks. Syntax and whitespace
checks pass. The older `test-customer-order-delivery.mjs` stops at its preexisting
empty-outbox assumption after a receipt now queues a notification; that legacy
full suite is not claimed to pass. Its implementation is not modified here.
