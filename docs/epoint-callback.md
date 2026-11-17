# Epoint callback and return pages

- success_url: https://mirpanel.com/odenis/epoint/ugurlu
- error_url: https://mirpanel.com/odenis/epoint/ugursuz
- result_url: https://mirpanel.com/api/payments/epoint/result

The browser pages display guidance only. They ignore query parameters and cannot confirm a purchase or credit an account.

Set EPOINT_PRIVATE_KEY as a secret environment variable on the active MirPanel Render server, not in Cloudflare, checkout HTML, logs, or Git. An unset secret makes the callback return 503 without writing. The callback accepts Epoint's signed POST, checks the original encoded data using the documented signature, and only acknowledges a committed result. The database binds a transaction to a single MirPanel wallet intent. It checks amount, AZN when the callback includes a currency, and the previously bound provider transaction. Row locking, a unique provider ID and a wallet ledger key prevent duplicate credit. Non-success events do not credit. Refunds are not automatically debited by this handler.

Wallet initiation is deliberately off unless the active server has both keys and EPOINT_CHECKOUT_ENABLED=true. The server validates the signed-in verified customer and the 1–500 AZN amount, then creates a hosted payment and binds the provider transaction before returning its URL. Use EPOINT_REDIRECT_HOSTS only if Epoint confirms an exact bank hostname not under epoint.az. Do not add wildcards. An indeterminate creation keeps its reference and is not sent upstream twice. Merchant support must reconcile indeterminate creation before authorizing a replacement.

The return screen reads an authenticated, owner-scoped status endpoint. It displays “Balansınız uğurla artırıldı” only after the signed callback's ledger transaction commits. A browser redirect, untrusted query parameters or receipt upload cannot trigger it. Both return pages support an optional local reference and a same-tab fallback. Direct Epoint order settlement, Apple Pay widget and saved-card token registration are not connected in this wallet flow. Card registration callbacks are explicitly rejected rather than treated as payments, and the endpoint does not store provider tokens or raw card data.

Merchant setup and URL verification must be checked in the authenticated Epoint dashboard or with Epoint support. The isolated tests use synthetic credentials and an injected Epoint response; they do not use the merchant account, contact the bank or perform a real charge. Verify an official test merchant/fixture before enabling live checkout.
