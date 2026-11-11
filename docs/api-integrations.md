# API inteqrasiyaları

## Epinby catalog

The protected **Oyun məhsulları** workspace reads the confirmed Epinby connection.
Only server-side GET requests to `/games`, `/products` and `/categories` are used,
following [Epinby's catalog API](https://epinby.com/docs). Keys are never returned.
Select a package, enter its AZN sale price and optionally stage a product image.
**Sayta əlavə et** opens the existing preview/publish confirmation; only that
package is included in the draft. Finish that confirmation to publish it.
Existing unsaved work must be handled first. Existing publication conflict
checks remain in force.

An imported package has the stable ID `epinby_<supplier product ID>`.
Refreshing supplier prices does not overwrite its saved sale price. Games are
loaded independently. Products are loaded page by page; the UI reports how many
have been loaded and preserves displayed cards if a later request fails. Search
shows matches immediately and progressively scans the remaining pages. Results
are explicitly marked incomplete until the last page; clearing/changing the
filter cancels that scan. **Daha çox paket yüklə** also permits manual paging.
Categories require a selected game, as in Epinby's documented API.
The real 151-game response is 76,983 bytes, above the former 64 KiB supplier
default. Catalog reads use a bounded 512 KiB budget; order/status reads retain
the existing protected transport and timeouts.

Apply `supabase/migrations/202611110002_epinby_execution.sql` before deploying the
Epinby execution worker. It only adds private queue/event tables; existing
orders and balances are not rewritten. New imports carry a validated provider
product ID and per-product field contract. Old phase-one imports without that
contract remain sales-disabled. Their **Bağlantını tamamla** action upgrades the
same catalog record through the normal publication preview, keeping its saved
price. Fully configured IDs cannot be duplicated.

Before payment, the server validates the current provider field contract and
stock in the exact game/category, and uses free `/validate-player` when the
product advertises it. The separate paid Name Check subscription is not used.
The current live API ignores the tested `ids`, `ids[]`, `id`, `product_id`
filters, so a different product is never assumed to be the requested product.

The existing paid-order trigger creates the durable parent dispatch inside the
payment transaction. Each purchased unit receives one stable UUID and encrypted
request body. Only its first claim sends POST `/order`, with
`X-Idempotency-Key`, `callback_mode=events` and the HTTPS callback URL. On a lost
response/restart, the worker only reads `/orders` by `client_order_id` or
`/order/{id}`. An unknown result remains visible for operator review and is never
automatically purchased again. Explicit failures remain visible and can use the
existing admin cancellation/refund policy; they are not silently refunded.

`POST /api/webhooks/epinby` verifies raw-body HMAC-SHA256 using the protected
saved secret and the `X-GAMEX-*` event headers. Events are encrypted and deduped.
Order/product identity and terminal state are checked; duplicate callbacks and
worker retries use the existing delivery UUID to avoid duplicate delivery/mail.
Voucher codes stay in the encrypted, owner-only delivery, never the mail.
Pending/failed details appear under **API inteqrasiyaları**. The live `/getMe`
response currently omits `webhook_secret`; the saved secret is preserved, not
replaced with an absent value. Live paid-provider callback delivery must be
verified during a separately authorized real transaction; automated QA is
synthetic and live catalog verification is read-only.

1. Apply `supabase/migrations/202611090901_api_integrations.sql` and `supabase/migrations/202611090902_api_integration_drafts.sql` as the database migration owner before deploying the admin server. It expects the existing customer delivery schema.
2. Set `SUPPLIER_API_ORIGINS` on the admin server to the comma-separated HTTPS origins approved for supplier traffic. Put API version prefixes in the endpoint paths. With an empty list the worker makes no supplier requests.
3. Open **API inteqrasiyaları** from the admin menu. Add a supplier with its bearer key and a read-only health endpoint, or select a saved supplier.
4. Select the package, map the provider service ID and quantity, and map any required customer fields from the checkout snapshot. OpenAPI 3 JSON can fill the POST and GET paths. The supplier must accept a JSON order with a merchant reference and support read-only lookup by that reference via `?reference=...`. MirPanel also sends the reference as the POST idempotency key.
5. Select **Yadda saxla və aktivləşdir**. A successful read-only connection check activates the mapping for future paid cart orders. Validation and connection failures retain an editable draft. Existing paid orders, older checkout formats and renewals keep their previous fulfillment flow. A line already partially or fully supplied from ready stock stays in the existing delivery flow.

If the create request has an ambiguous outcome, the worker only checks status by reference. A missing lookup result stays under review. Manual delivery for that line is available after a definitive failure. The supplier must reserve failure statuses for orders it will never deliver.
