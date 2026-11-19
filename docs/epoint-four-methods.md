# Epoint four-method top-up rollout

## Contract

Base: https://epoint.az/api/1/

| Action | POST path | Fields inside signed JSON |
|---|---|---|
| Apple/Google Pay | token/widget | public_key, amount, order_id, description |
| Wallet discovery | wallet/status | public_key |
| m10/Birbank | wallet/payment | public_key, wallet_id, amount, currency=AZN, order_id, description, language=az |
| Status | get-status | public_key, transaction |

All use form-urlencoded data=base64(UTF-8 JSON), signature=base64(binary SHA-1(private_key+data+private_key)).
The private key remains server-only. Existing card settings and order checkout are unchanged.

Sources:
- https://epointbucket.s3.eu-central-1.amazonaws.com/files/instructions/API%20Epoint%20az.pdf
- https://developer.epoint.az/az/token-payment/widget
- https://developer.epoint.az/az/wallet/wallet-payment
- https://developer.epoint.az/az/status/get-status
- https://developer.epoint.az/az/callbacks

Observed live: the PDF's plain public_key wallet/status request returned HTTP 400 for JSON and a plain form. The standard signed form returned HTTP 200 with m10=9 and Birbank=10. The application resolves these IDs from the provider, never from a client-supplied wallet ID.

Widget creation may omit transaction. A verified callback for a previously issued owner-bound request can bind it. Browser messages cannot establish a trusted transaction or credit a balance.
For these four methods get-status must confirm transaction, amount, operation_code=100, order_id if returned, and currency if returned. Currency is AZN on issuance; the documented get-status response may omit it. Explicit non-AZN currency from either channel is rejected.
Only after server confirmation does the existing ledger credit, with a unique reference and row locking. The success page and payment history read this committed credit.

## Recovery and outcomes

Repeated creation of the same UUID is not sent upstream again. An unknown creation result remains pending, requiring Epoint reconciliation before replacement.
Known pending transactions are rechecked by the authenticated status read and a server worker. The database stores a lease and exponential backoff (up to 15 minutes); restart does not lose pending work.
Widget closing is not treated as a bank-confirmed cancellation. Failed/error outcomes never credit. Returned is displayed as returned; refunds after an existing credit are not automatically debited and require a separately authorized process.

## Activation

Render service: mirpanel-frankfurt. Existing secrets: EPOINT_PUBLIC_KEY, EPOINT_PRIVATE_KEY.

- EPOINT_TOKEN_WIDGET_ENABLED=true is the widget master gate.
- EPOINT_APPLE_PAY_ENABLED=true and EPOINT_APPLE_DOMAIN_VERIFIED=true gate Apple Pay.
- EPOINT_GOOGLE_PAY_ENABLED=true gates Google Pay.
- EPOINT_M10_ENABLED=true and EPOINT_BIRBANK_ENABLED=true gate the named wallets.
- Do not change EPOINT_CHECKOUT_ENABLED (existing hosted card gate).
- EPOINT_REDIRECT_HOSTS can list exact provider-confirmed gateway hosts; no wildcards. Widget origins remain Epoint-only.

These flags attest verified support, not merchant activation. Merchant settings mark all four methods active, but Apple/Google controls say “Biznes səhifəsi”; this alone does not prove external widget support or Apple domain verification.
There is one shared Apple/Google widget and no documented method-selection parameter.

The cited sections do not mandate a separate test cabinet. Do not invent one as a prerequisite. Local tests inject provider replies. Live unpaid sessions verify only creation and opening, not completed payment or final credit. Obtain explicit per-method authorization before a real charge.

## Test commands

- node scripts/test-epoint-result.mjs
- node scripts/test-epoint-checkout.mjs
- node scripts/test-epoint-four-methods.mjs
- node scripts/test-epoint-return-browser.mjs

The database tests require a disposable local PostgreSQL instance; never use production.
scripts/epoint-readonly-probe.mjs only discovers wallets by default. --open-unpaid creates one unpaid 1 AZN record per method and requires explicit authorization. Do not rerun on an unknown outcome without approval.
