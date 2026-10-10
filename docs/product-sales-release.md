# Product detail sales release

No migration writes existing products, orders, finance snapshots, media, storage or Stories.
Plan metadata uses the existing CMS product/plan JSON; historical statistics use three private tables.
The migration does **not** initialize the historical allocation. An authenticated administrator
must explicitly confirm the one-time button after release. No real order or payment is created.

## Backup before migration or rollback

1. Retain the current published `app.js` and existing CMS backup (product/plan configuration).
2. With an authorized SQL connection, save the existing order schema, not credentials/receipts:
   `pg_dump --schema-only --table=public.payment_orders --file=payment-orders-schema-before-sales.sql DATABASE`
3. Export this read-only count check to a local backup file:
   `select status, count(*) from public.payment_orders group by status order by status;`
4. If sales tables already exist, export all three BEFORE reapplying or rolling back:
   `pg_dump --format=custom --table=public.product_sales_settings --table=public.product_sales_baselines --table=public.product_sales_audit --file=product-sales-before-change.dump DATABASE`
5. Keep backups private. Never paste connection strings/service-role keys into chat or logs.

## Apply and verify

Run `supabase/migrations/202610100001_product_sales.sql` in the correct production project's SQL Editor.
Run twice in the test database to verify idempotency. The second run must preserve version,
initialized_at, allocation and audit. Verify only the new objects:

```sql
select * from public.product_sales_settings;
select coalesce(sum(count),0) as allocated from public.product_sales_baselines;
select count(*) as audit_rows from public.product_sales_audit;
select count(*) as real_completed from public.payment_orders
where status in ('approved','completed');
```

Before initialization `allocated=0`; after initialization it must equal 10000.
Legacy approved/completed orders count even when completed_at is NULL, matching admin totals.
Unknown canonical product IDs are returned separately as unknownProductIds in the admin snapshot;
they remain included in realTotal and are never matched by product title.
The snapshot RPC uses aggregated order counts, not order/customer rows. There is no cache to
invalidate when an order completes. The detail page re-reads on focus and every 30 seconds while visible.
No authenticated/public DB policy is installed: only backend service_role invokes these RPCs.

## Rollback

Prefer reverting the feature code and retaining the three tables and audit. If removing the schema
is explicitly authorized, first verify the private dump can be restored in a test database, then
run `supabase/rollback/202610100001_product_sales.sql`. It removes only this subsystem and its
new partial index; existing payment/catalog/media data remains unchanged. Restore the three new
tables from the private dump before reenabling the feature. Never rerun initialization to reconstruct
an already-established allocation.
