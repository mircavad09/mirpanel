# Epoint callback and return pages

- success_url: https://mirpanel.com/odenis/epoint/ugurlu
- error_url: https://mirpanel.com/odenis/epoint/ugursuz
- result_url: https://mirpanel.com/api/payments/epoint/result

The browser pages display guidance only. They ignore query parameters and cannot confirm a purchase or credit an account.

Set EPOINT_PRIVATE_KEY as a secret environment variable on the active MirPanel Render server, not in Cloudflare, checkout HTML, logs, or Git. An unset secret makes the callback return 503 without writing. The callback accepts Epoint's signed POST, checks the original encoded data using the documented signature, and only acknowledges a committed result. The database binds a transaction to a single MirPanel wallet intent. It checks amount, AZN when the callback includes a currency, and the previously bound provider transaction. Row locking, a unique provider ID and a wallet ledger key prevent duplicate credit. Non-success events do not credit. Refunds are not automatically debited by this handler.

This is callback/readiness plumbing, not merchant activation or a new checkout option. Before exposing wallet initiation, the trusted creation service must create an AZN Epoint transaction with newEpointOrderId and register the returned provider transaction with registerEpointWalletIntent, using a session-verified wallet owner and validated amount. That helper has no public endpoint. Direct Epoint order settlement and saved-card token registration are not connected. Card registration callbacks are explicitly rejected rather than treated as payments, and the endpoint does not store provider tokens or raw card data.

Merchant-account Apple Pay and card activation must be checked separately in the authenticated Epoint dashboard or with Epoint support. Verify actual test-environment callback fixtures before enabling live checkout.
