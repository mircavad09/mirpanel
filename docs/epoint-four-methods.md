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

### Owner-only Android opening preview

User-facing entry: `https://mirpanel.com/balans?google-pay-preview=1`. This contains only a public explanatory shell; both configuration and creation still require the verified owner. It avoids navigating directly to a JSON API, which the edge correctly rejects for cross-site navigation. Sign in first, then open this entry. Do not weaken the edge cross-site API protection.

`https://mirpanel.com/api/payments/epoint/status?preview=google&screen=1` is a noindex/no-store page authorized by the existing verified owner identity, not an email query parameter or client flag. Anonymous and other users are rejected. This alias uses the already deployed narrow payment proxy; it does not depend on a new edge route. The preview does not enable public payment flags. Only google-pay, exactly 1 AZN and a deterministic per-owner campaign UUID are accepted; repeated opens reuse the same request, including after browser storage is cleared. Provider creation occurs only when the owner presses the opening button. The shared widget and normal signed callback/get-status/idempotent ledger code are used, not a simulated Google Pay sheet. Separate browser draft storage keeps preview and customer checkout drafts apart.

The page explicitly warns that this is a LIVE 1 AZN widget and payment must not be approved. It exposes the wrapper even on a desktop so the owner can diagnose the provider UI; Google's actual button remains subject to the provider's device/wallet readiness. Android Google Wallet testing requires the user's eligible physical Android phone; desktop emulation is not evidence of this test. A real payment still requires separate approval.

Apple certificate/association material is pending from Epoint. Do not invent a filename, bytes or deployment path, and do not publish a substitute. m10/Birbank errors and pending provider actions remain unchanged.

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

## Current recheck — 2026-11-23 (supersedes historical observations below)

Read the authenticated cabinet's current official developer portal: authentication, token-payment/widget, token-payment/apple-pay, token-payment/google-pay, wallet/wallet-payment, status/get-status and callbacks. Widget now consistently documents POST (including its sample). Wallet `wallet_id` is a JSON number, discovered from the signed wallet/status response (m10 9, Birbank 10), not a guessed merchant ID. Current wallet responses and docs omit a top-level status; current get-status also omits operation_code. Keep the payment operation code mandatory on a successful signed callback before binding a widget transaction. An already server-issued wallet transaction can be verified against get-status without an omitted operation_code; reject explicit non-payment codes. Amount, transaction, optional order/currency, status/code and ownership checks remain mandatory.

Read-only deployment baseline was f8f54512 on Render and matching main frontend bytes. Apple association .txt is HTTP 200 text/plain, without redirect, byte-identical to the supplied original. This is placement evidence only, not Epoint/Apple domain approval. Existing hosted-card activation and keys must remain unchanged.

Exactly one new owner-bound unpaid 1 AZN request was created per method, using the normal checkout module. Private provider replies/URLs are outside git in outputs/epoint-methods-20261123/unpaid. No authorization, charge or synthetic production credit was performed.

| Method | Provider reference | Current opening observation |
| --- | --- | --- |
| Apple Pay | widget 24269585 | Creation succeeded; outer widget opened on Windows Chrome, no eligible Apple button. No connected Apple device or separate domain-approval confirmation. |
| Google Pay | widget 24269586 | Creation succeeded; outer widget opened on Windows Chrome, no eligible Google button. No physical Android/active Wallet test. |
| m10 | te024269587 | HTTP 200, redirect_url null; get-status new. Trace 16b043cb45413ae4b2bd06f680bcc261. No documented continuation request. Keep closed. |
| Birbank | te024269589 | Real 1 AZN QR, Mirpanel merchant and app.birbank.az application link opened. Previous disabled-merchant error no longer present. No phone authorization/charge tested. |

Release policy: Birbank can be opened following the verified QR opening and isolated settlement tests. Google Pay remains device-gated; public availability is conditional on its readiness probe, not a claim that a physical Android payment was tested. Apple stays closed until domain approval is confirmed; m10 stays closed until a usable redirect is returned. No method silently falls back to another. Unsupported devices receive an explanation and alternative methods. The success reader now requires the committed, amount-matching ledger credit as well as the successful intent; return URLs and browser messages do not credit balances.

Current local regression tests cover all four methods, repeated/concurrent callbacks, incorrect signatures/amounts/currency/operation codes, pending/failure/return/server-error states, fake browser success, double-click request reuse and success-without-ledger rejection. These are isolated tests, not real completed payments. Reuse existing request IDs for status/retry; never recreate an unknown-outcome request. Final financial approval remains with the owner.

## Test commands

- node scripts/test-epoint-result.mjs
- node scripts/test-epoint-checkout.mjs
- node scripts/test-epoint-four-methods.mjs
- node scripts/test-epoint-return-browser.mjs

The database tests require a disposable local PostgreSQL instance; never use production.
scripts/epoint-readonly-probe.mjs only discovers wallets by default. --open-unpaid creates one unpaid 1 AZN record per method and requires explicit authorization. Do not rerun on an unknown outcome without approval.

## Cabinet documentation audit — 2026-11-19

The authenticated API Idarəetmə → API Dokumentasiya link was opened and resolves to https://developer.epoint.az/ . Read authentication, callbacks, token-payment/widget, token-payment/apple-pay, token-payment/google-pay, wallet/wallet-status, wallet/wallet-payment and status/get-status.

- Widget documentation is internally inconsistent: header says POST but Laravel sample uses GET; the endpoint and example URL render as `***`. Existing POST returned status=success and widget_url; do not issue an additional session merely to try GET. Ask provider to clarify before changing transport.
- iframe/webview is required for the documented integration; direct URL opening is not a full integration test. Reused both saved URLs in 400px iframes with payment permission: no buttons in this Windows Chrome environment, Apple button display:none and Google button area empty. This local iframe test does not verify mirpanel.com domain validation. No iPhone/Safari environment was connected.
- Returned provider HTML gates Apple on ApplePaySession capability; Google requires isReadyToPay.result AND paymentMethodPresent, with existingPaymentMethodRequired=true and only CRYPTOGRAM_3DS. No visible fallback is rendered for a negative capability result. This explains a mechanism for a blank widget, but this audit could not capture the actual Google readiness response; do not claim a confirmed missing-card diagnosis. MirPanel now tells users about supported-device requirements instead of immediately claiming a payment is being verified before interaction.
- Widget response documents only widget_url, not a transaction. Numeric URL IDs are widget IDs, not documented get-status identifiers. HTML contains provisional te024150193/194; their signed get-status replies are record not found before any wallet authorization. Documentation does not define when these provisional records become status-queryable. Production does not scrape HTML or derive a transaction from numeric IDs: it binds a verified signed callback, then verifies its transaction via get-status before credit.
- Wallet IDs are discovered from signed wallet/status: m10=9, BirBank=10. Both actual requests used those IDs, numeric amount=1, currency=AZN, language=az and unique order_id, signed as documented. There is no documented follow-up endpoint for redirect_url:null. Current replies also omit the documented required status field.
- Creation response handling now retains candidate_transaction, provider_trace and a bounded issue code even if a link is missing. Missing status is accepted only with a usable transaction and URL; full HTTPS host validation is unchanged. A Birbank URL wrapping a bank HTTP 403/invalid_policy payload is not opened as a successful checkout. Unknown requests retain the same UUID and are not resent. Nothing here credits a balance or enables a method.
- Birbank initial payload explicitly says Merchant E1070327 is disabled; wallet_id was correctly resolved. This is strong evidence of upstream merchant configuration, not proof of which Epoint/bank setting must change. No alternate merchant, key or wallet was guessed.

Local verification: test-epoint-opening.mjs, test-epoint-four-methods.mjs (including missing-status/null-link/embedded-bank-error regression), test-epoint-checkout.mjs and test-epoint-result.mjs all pass with synthetic data. No new live session was necessary for this documentation audit, and no payment was approved.

### Questions for Epoint support (do not include keys)

Follow-up live evidence later on 2026-11-19: the Laravel GET example was actually sent once per method with fresh unique order IDs and amount 1. Both returned HTTP 405 Method Not Allowed, not a widget URL. Keep POST. Journals: outputs/epoint-get-comparison-20261119. No authorization/payment was performed. Fresh necessary wallet rechecks reproduced m10 redirect_url:null (te024154515, trace 16afee84d4106a0e0335b0a4a0d94afe) and Birbank invalid_policy/403 Merchant E1070327 is disabled (te024154516, trace 16afee84d6a3487fd34067ecb3d89a3d). Cabinet business-page Apple/Google and wallet toggles remain selected; there is no visible external-domain verification control or bank merchant mapping control in those settings. No toggles or card settings were changed.

MirPanel's Google capability probe now uses only CRYPTOGRAM_3DS to match the actual Epoint widget rather than advertising PAN_ONLY-only devices. Its promise is bounded to 2.5 seconds so a hung readiness probe cannot block unrelated methods. This remains only a capability precheck; the provider owns final readiness and payment UI. Google official integration checklist also distinguishes PAN_ONLY cards-on-file from CRYPTOGRAM_3DS device tokens: https://developers.google.com/pay/api/web/guides/test-and-deploy/integration-checklist . Current Chrome showed no console warnings/errors in the exposed log, but this does not establish that all provider internals succeeded.

1. Token Ödəniş → Token Widget: header POST vs Laravel GET and `***` endpoint placeholders conflict. Please confirm the exact creation method/URL and when a widget's provisional transaction becomes available in Ödəniş Statusu → get-status. Widgets 24150193/24150194 (HTML te024150193/te024150194), creation traces 16afec955390e710e2ffc856d15a958e / 16afec9551f28a8bd26a0d5e661385c9 return record not found before authorization. Which signed callback transaction should be used, and is this expected before payment? Windows Chrome renders no Google button; widget requires paymentMethodPresent and CRYPTOGRAM_3DS. Please check readiness diagnostics and confirm enabled API Token Widget capability, distinct from the Business Page toggle.
2. Cüzdan → Cüzdan Ödənişi: te024150195, trace 16afec956453d18cc05c2448230abe1f, wallet/status ID 9=M10, amount 1 AZN. HTTP 200 returns redirect_url:null, transaction and trace_id but no required status; get-status remains new. Documentation specifies no continuation call. Please supply the missing link/fix upstream creation or document the exact required next endpoint; do not initiate a payment.
3. Same section, te024150196, trace 16afec956541be59b401aa4b41ec6562, ID 10=BirBank: initial redirect payload has invalid_policy/403 and "PaymentCreatorPolicy failed, reason: Merchant E1070327 is disabled"; later bank status payment_not_found for e9e7ca90-280f-4879-8776-74353ed5abd4. Please verify which merchant mapping is disabled for this API account and enable the intended Birbank merchant. Request used wallet/status's ID, not a hard-coded bank merchant.
4. Token Ödəniş → Apple Pay: please confirm mirpanel.com domain registration and provide the required association file/placement. /.well-known/apple-developer-merchantid-domain-association currently returns 404; Business Page checkbox alone does not verify the external domain. No merchant-validation or payment approval was attempted.
