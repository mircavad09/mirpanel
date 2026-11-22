# Ready stock identity incident — 22 November 2026

Read-only production audit against `mirpanel-frankfurt`, deployed `dc9fd6898943ebf1b1191d78482728543f579d07`, database host `aws-0-eu-central-1.pooler.supabase.com`. Database queries used `default_transaction_read_only=on`, verified TLS and a statement timeout. No credentials, account emails, passwords or ciphertext were retrieved. No stock, reservations, balances or orders were changed.

## Confirmed cause

`a0e1169c` introduced stable package IDs during catalog normalization for the cost editor. Existing ready-stock SKU signatures hash `[plan.id, label, duration]`. Assigning `"0"` where the historical value was null changed the signature, despite an unchanged product, package key, name and duration. Current catalog signatures did not match existing stored units. This was a regression introduced by that cost-editor change, not deleted inventory or a database switch.

The correction records a distinct `stockIdentityId:null` for those legacy packages while retaining their stable editor/cost ID. The central signature function preserves their original identity. Explicit preexisting package IDs remain unchanged. The marker survives normalization and publication/reordering. No broad signature fallback, database rewrite, reservation release or delivered-unit reactivation is used. Real package identity changes continue to require exact signature matching.

## Production observation, approximately 20:15 Baku

Counts below are a point-in-time raw database observation. “Free” means no delivery, manual assignment or deletion marker. Live reservation query returned an empty list. Generic ready accounts do not have a universal expiry column; therefore free rows alone are not a new assertion about account validity. Deleted rows are retained in history and excluded from free stock.

| Product / stored package | Free | Delivered | Manually assigned | Deleted/excluded | Total |
|---|---:|---:|---:|---:|---:|
| CapCut key 0, current legacy signature | 4 | 48 | 0 | 2 | 54 |
| CapCut key 0, older signature | 0 | 1 | 0 | 0 | 1 |
| CapCut key 1, 7 days | 2 | 12 | 0 | 2 | 16 |
| CapCut old key 2 | 0 | 1 | 0 | 2 | 3 |
| ChatGPT key 0 | 0 | 12 | 0 | 0 | 12 |
| HBO Max key 0, current legacy signature | 7 | 2 | 0 | 0 | 9 |
| HBO Max key 0, older signature | 3 | 6 | 0 | 0 | 9 |
| Prime Video key 0, 1 month | 3 | 26 | 0 | 2 | 31 |
| Prime Video key 1, 6 months | 4 | 4 | 0 | 0 | 8 |
| Surfshark key 0, 1 month | 8 | 2 | 0 | 0 | 10 |
| Zoom key 0 | 0 | 3 | 0 | 0 | 3 |

Netflix room sale-state view: 2 unassigned, unheld, unexpired non-synthetic rooms; 230 assigned, unheld, unexpired non-synthetic rooms. Sellable-room view independently returned 2. No expired/synthetic/held groups were returned by this grouped query. Assigned combines delivery and legacy/manual assignment; their finer breakdown and linked order numbers were not yet retrieved when browser access ended. Spotify had no generic ready-stock rows in this query.

HBO's three older-signature free rows existed separately from the current package. Their compatibility is not proven; they remain excluded from automatic allocation. Admin product summaries now show unmatched free stock separately as “köhnə paketdə — yoxlama tələb olunur”, without adding it to the current ready total.

## Verification

- `test-ready-stock-identity.mjs`: all 63 stored package signatures and cost keys preserved; stable after reorder/publication; existing account package matching restored; real duration changes remain isolated.
- `test-ready-delivery.mjs`: exact SKU, separate sales limit, reservation/expiry, deletion/restock, automatic setting and Epinby exclusion passed against disposable local PostgreSQL.
- `test-ready-stock-backlog.mjs`: 46 synthetic checks, FIFO/partial/parallel/idempotency and owner isolation passed. No production checkout was performed.
- `test-ready-stock-management.mjs`: edit/delete/manual bind, reservation safety, concurrent assignment and purchase isolation passed in local synthetic data.
- `test-ready-stock-load-failure.mjs`: Chrome/WebKit at 390/1440; failed reads preserve confirmed count, show an error, keep sales separate and display unmatched-SKU warning.
- Profit and SEO regression tests passed. A broader legacy `test-ready-stock.mjs` reached its later list projection assertion and failed because current order results include `supplierProgress:undefined` while that old expected literal omits it; no production behavior was changed to satisfy that unrelated assertion.

Remaining read-only evidence to obtain after browser access returns: authenticated admin/API vs database comparison after release, order numbers for fully delivered ChatGPT/Zoom units, Netflix delivery-vs-manual split, and historical explanation for the older HBO signature. No claim that those three older HBO units were repaired or made saleable is made.
