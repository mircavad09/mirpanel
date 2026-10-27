# Explicit empty / zero inventory

Production base: `4a1ce65f8b3ed68ed1b076e7e3215b5b7f60863b`. Separate
`fix/inventory-null-unlimited` branch; community work is not included.

## Rules and cause

The old admin writer rejected an empty input, the API required an integer, and
the SQL ledger policy had no explicit unlimited mode. CMS `stock` is legacy and
is still never imported as an operational count.

- An intentional empty save sends JSON `null`. Product policies persist an
  additive `unlimited` boolean; existing policies default false. Plan policies
  use the existing per-plan `inventory_tracked` flag (false = unlimited).
- Zero remains tracked / unavailable. Positive integers 1–10000 use the existing
  unit ledger, transactional reservation and final admin delivery rules.
- Missing fields, strings, fractional/negative/out-of-range values are rejected.
  Admin controls cannot save until a successful inventory load for the selected
  product. Blank not deliberately edited is not silently published as unlimited.
- Reopening an unlimited product/plan preserves blank/null, never numeric zero.
- Plan controls are enabled only in plan-managed products; product-managed plans
  inherit that real product pool. No invented aggregate plan stock. An unlimited
  plan cannot unlock a different zero-stock plan. Credential-managed quantities
  cannot be silently disabled by the scalar editor.
- Snapshot scope and unlimited state are resolved server-side. Last-unit races
  still have one winner. Already-reserved finite units retain the order's stock
  requirement even after an explicit switch to unlimited. Employee submission
  does not deliver stock; final admin approval does. Cancellation/retry and
  idempotency protections are unchanged.
- Home cards no longer render stock badges/counts. Disabled ordering and server
  enforcement remain. Detail/plan availability stays accurate. Cache versions
  change only for the affected stock/admin assets and product page references.

## Migration / backup

`supabase/migrations/202610280001_inventory_nullable.sql` is additive and accepts
inventory schema 5 or 6 without changing `employee_system_ready()`. Production
was read-only confirmed as 6. No catalogue/stock/order values are seeded or reset.
Verification: `supabase/inventory-nullable-verify.sql` -> schema 6,
nullable_inventory_ready true, 3 manifest entries and `INVENTORY_NULLABLE_OK`.
The in-database manifest is only a scoped snapshot, not an external backup.

An external public-schema custom-format dump was created in the restricted local
MirpanelPrivateBackups directory with the existing DPAPI credential. Loopback-only
isolated PostgreSQL restore matched all 46 tables, 103 functions, constraints,
indexes, RLS and policies. First/repeat migration and non-deleting rollback passed
on the restore. Archives were DPAPI-encrypted with a successful decrypt/hash check.
Storage object bodies and schemas other than public are outside that backup.
No backup or customer data is committed.

The production migration and verification passed. Original columns in all three
inventory tables exactly matched the transaction's pre-DDL snapshots. Schema
remains 6; no production business data was changed or test transaction created.

Rollback: `supabase/rollback/202610280001_inventory_nullable.sql`. It restores
original function definitions and revokes the new writer without deleting rows or
columns. It refuses rollback if newly activated unlimited policies would be
misinterpreted by the old app; deliberately resolve these policies first. Do not
reset all stock or release pending reservations to force rollback. Restore the
previous app version only after compatible policy verification.

## Actual isolated tests

| Suite | Checks |
|---|---:|
| test-inventory-nullable-postgres | 39 |
| test-inventory-authority-postgres | 56 |
| test-inventory-api | 58 |
| test-inventory-availability | 87 |
| test-inventory-admin-browser | 20 |
| test-inventory-nullable-admin | 28 |
| test-inventory-browser | 40 |
| test-inventory-catalog-browser | 309 |
| test-inventory-last-unit-checkout | 11 |

748 assertions; final failures 0. Includes real separate PostgreSQL connections,
last-unit race, retries, cancellation, delivery/bonus regression, first/repeat SQL,
rollback, null/0 save/reopen, unloaded editor, plan isolation and all 22 active
catalogue products. Widths 320/390/430/768/1024/1440: overflow, broken visible images,
new asset 404 and application errors 0. Mutation tests are isolated only.

During development, the new fixture initially reused a synthetic receipt path;
the database correctly rejected the duplicate. The fixture was corrected to use
its own unique path. The production restore also caught the initial overly narrow
schema-5 gate; the migration now explicitly supports the existing schema 6.
No failed attempt was represented as a successful production migration.

Production verification must be read-only: deployment commit/health, inventory
snapshot, asset bytes, admin guest denial and rendered cards. Do not change stock
or create orders/reservations/receipts/messages to demonstrate a release.
