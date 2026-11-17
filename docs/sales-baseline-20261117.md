# Independent product sales starting counts

## Evidence and authorized correction

Read-only production audit found **Free Fire**, order **12919**, created 2026-11-16 (Asia/Baku day). Payment is confirmed; the Epinby unit is delivered, the customer delivery ledger contains one unit, and `product_sales_delivered_units` already counts that same one unit. The 2026-11-14 baseline edit audit and current baseline both contain **3**, not 4. Thus the existing total **4 = 3 + 1** was arithmetically correct. Do not fabricate a missing sale or insert a duplicate delivery.

The owner explicitly approved changing **only Free Fire's starting count to 4**, yielding **5 = 4 + 1**. `repair-free-fire-baseline.mjs --apply` first backs up counter tables and function definitions privately under `outputs/sales-counter`, verifies order 12919's existing supplier/delivery evidence, and uses the audited/versioned baseline save RPC. Other baselines, all delivery rows, orders, balances, prices and inventory are left unchanged. A repeated repair is a no-op. The script refuses an unexpected baseline or mismatched evidence.

## Corrected constraints and presentation

The old editor and RPC required all starting counts to total exactly 10,000. This meant increasing one product required decreasing another. The one-time historical initializer still allocates 10,000, but subsequent admin edits now allow independent nonnegative integer starting counts. The stored starting total and deferred integrity guard remain consistent; optimistic version checks prevent lost concurrent edits. Site total uses the actual baseline sum rather than a hard-coded 10,000.

All three customer presentations use the same public sales endpoint and show the exact computed count as `N dəfə satılıb`, without the approximation sign or trailing `+`. Product-list focus/visibility recovery now actually refreshes visible counters and coalesces in-flight requests. Visible pages continue periodic refresh. The public server snapshot has a 10-second cache, so a newly delivered sale can take roughly one cache period plus the next visible refresh to appear; reload is not required.

Sales still come from the existing durable delivered-unit view: quantities per order line, bounded by purchased quantity. Manual, automatic-ready-account and Epinby deliveries already share this ledger. No new increment/event table or historical recount was introduced. Legacy inferred units admitted by the November 14 cutover remain disjoint from explicit delivery records and are not reimported. Failed/pending/unpaid orders do not add sales; only actually delivered units of a partial order count.

## Verification

- `test-independent-sales-baselines.mjs`: 3 + 1 = 4, authorized baseline 4 + same sale = 5, other products unchanged, site total, independent admin save, no-op replay, status replay, reconnect/reinstall, legacy preservation, concurrent edit conflict and denied public writes. Stock is not read.
- `test-delivered-product-sales.mjs`: quantity, multi-product lines, partial cancellation, rejection/unpaid exclusion, request/status/restart replay and legacy replacement without duplication.
- `test-delivered-sales-flows.mjs`: real local checkout functions with synthetic wallet/stock; automatic/manual delivery, multiple products/quantities, replay and customer-link exclusion.
- `test-epinby-execution.mjs`: simulated supplier success, lost response/restart, concurrent worker, signed duplicate webhook, failure and multi-unit delivery; sales-view quantities checked. No real supplier purchase.
- `test-sales-admin-browser.mjs`: Chrome/WebKit, 390/1440 px, 4 + 1 preview and independent save, invalid input blocked, other baselines retained.
- `test-sales-refresh.mjs`: home/list/detail at 390/1440 px, periodic 99 → 102 and focus 102 → 103 with synthetic endpoint responses.
- `test-product-sales-api.mjs`: unauthorized reads/edits/initialization denied, public CORS/no-store, unavailable database does not invent counts. Synthetic startup keys only.

Production maintenance and public post-deploy checks must be separately recorded; isolated tests are not live purchases.
