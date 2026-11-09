# API inteqrasiyaları

1. Apply `supabase/migrations/202611090901_api_integrations.sql` and `supabase/migrations/202611090902_api_integration_drafts.sql` as the database migration owner before deploying the admin server. It expects the existing customer delivery schema.
2. Set `SUPPLIER_API_ORIGINS` on the admin server to the comma-separated HTTPS origins approved for supplier traffic. Put API version prefixes in the endpoint paths. With an empty list the worker makes no supplier requests.
3. Open **API inteqrasiyaları** from the admin menu. Add a supplier with its bearer key and a read-only health endpoint, or select a saved supplier.
4. Select the package, map the provider service ID and quantity, and map any required customer fields from the checkout snapshot. OpenAPI 3 JSON can fill the POST and GET paths. The supplier must accept a JSON order with a merchant reference and support read-only lookup by that reference via `?reference=...`. MirPanel also sends the reference as the POST idempotency key.
5. Select **Yadda saxla və aktivləşdir**. A successful read-only connection check activates the mapping for future paid cart orders. Validation and connection failures retain an editable draft. Existing paid orders, older checkout formats and renewals keep their previous fulfillment flow. A line already partially or fully supplied from ready stock stays in the existing delivery flow.

If the create request has an ambiguous outcome, the worker only checks status by reference. A missing lookup result stays under review. Manual delivery for that line is available after a definitive failure. The supplier must reserve failure statuses for orders it will never deliver.
