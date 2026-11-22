# Stable stock identity follow-up — 22 November 2026

This follow-up is distinct from the earlier live audit in `ready-stock-identity-20261122.md`. No new production database query succeeded in this run: the existing Render CLI credential returned HTTP 401, browser inventory reported no connected browsers, and the native window observation was unavailable/stale. No authentication was bypassed, credentials changed or inventory repaired under those conditions. Earlier counts are historical evidence, not current counts or newly reconciled records.

## Git history evidence

Reviewed 99 `app.js` revisions since 1 November, across every historical package of the six products that had generic ready-stock rows in the previous database audit. Twenty-five distinct product/signature combinations were found. Other products remain included in the catalog/signature regression check, currently 80 packages across 41 active/inactive products. A comprehensive current unit/reservation/delivery audit still requires restored database access.

### HBO Max

The historical signature `bc55dcea6e2ea65d057d825a63d1c8da20e599d8e5ddeb259ee35d316674e959` corresponds to the package name `1 ay ` (trailing space), one month, no day duration. Git revision `dfffc8c4937227ac839a9f61b636c28ff0c57ff5` retains stable pricing UUID `9862f006-0b4b-4c63-97ef-eda5829158da`. Current signature `d1062bd2f0a1d6513aee999392c1f94a5434b9ca7c60dc2e90295acc53b11f80` has `1 ay`, one month and the same pricing UUID. Both occupy legacy cost key 0. There is no separate accountType property in either version; that absence must not be asserted as proof of identical delivered account contents. Warranty changed over the history: 27 days on the old named package, 24 and later 28 days on newer variants. There was also an intervening 25-day package version with the same pricing UUID (`5f760a...`), which makes arbitrary blanket aliasing unsafe without checking each unit's batch/created time and actual stored scope.

The earlier live audit found three free units in the `bc55...` scope. Their individual IDs, current delivery/reservation state and validity have not been retrieved in this follow-up. **None was migrated, duplicated or marked restored.** Same stable UUID plus whitespace explains the historical signature change, but does not replace the required per-unit eligibility check, pre-change backup, lock and audit.

### Other historical scopes

- CapCut `2053b76...` corresponds to `1 Ayliq (0-500 AI kredit) endirim (Telefon)` at `72e6a73f`; the previous audit had one delivered unit, no free unit in this scope. It must not be reactivated.
- CapCut `079579dd...` moved from index 2 to 1 after a separate AI-credit package was removed. Historical metadata includes a seven-day duration and six-day warranty, while an older version lacked durationDays. The earlier audit had no free units at old key 2, one delivered and two deleted. Exact live state must be checked before creating any alias.
- All previously observed Prime, Surfshark, Zoom and ChatGPT signatures match existing history entries. This does not prove there are no newly orphaned records or new products with stock; that requires the current database scan.

## Prevention implemented

Legacy stock signatures are frozen as `stockSignature` on a canonical `stockContract` (duration and account type), while stable package/cost IDs remain unchanged. Renaming, reordering, changing price or changing private cost no longer recomputes the fulfillment identity. On publication the server carries the existing identity only through a unique matching stable package ID/pricing UUID; it does not trust position, similar names or an incoming arbitrary hash. New packages do not inherit an existing signature. Actual duration/account-type changes receive a different stock scope. Old delivered data and encrypted scope-bound messages are not rewritten. Existing reservation and allocation locking remains intact.

No schema migration, unit update, reserve release, new checkout, balance mutation or automatic recovery operation was performed by this work. Persisting catalog identity is not a repair of historical orphan units; that remains a separate controlled operation.

## Verification

- Existing 80 package signatures and cost keys preserved; explicit legacy IDs retained.
- Name, price, ordering, repeat publication and real duration-change regression tests passed.
- Disposable local PostgreSQL ready-delivery tests and 46 queue checks passed, including exact SKU isolation, reservations, partial delivery, concurrency and idempotency.
- Isolated management tests passed: reserved edits/binds blocked, parallel binds yield one assignment, two purchases cannot allocate the same unit, separate sale limit and immutable history.
- Real admin publishing roundtrip fixture passed with zero production writes.
- Cost editor, permission, supplier finance, SEO and mobile/desktop load-failure regression checks run separately; outputs remain local.

## Required production completion steps

1. Restore an existing authorized Render API/CLI, Render Web Shell or direct TLS database connection. Do not create an unauthenticated recovery endpoint.
2. Read all units, settings, batches, management/deletion state, reservation snapshots and deliveries in a consistent read-only transaction; classify by exact product/key/signature, including deleted/inactive packages. Read Netflix room assignment and reservation transitions for the interval between the 2-room and 1-room observations, and report the actual linked order if present.
3. For proven eligible orphan units, lock allocation (advisory key 714025001 and unit rows), recheck active reservations and delivery state, save a restricted encrypted before-image including original ciphertext, then make only the approved scope correspondence. Encrypted scope binding must remain verifiable; moving columns alone would break `READY_STOCK_REFERENCE_MISMATCH`. Record old/new scope, unit IDs and evidence commit in the audit trail. Already-delivered, assigned or deleted rows must not become free.
4. Reconcile total/free/reserved/delivered/other counts before and after; rerun repair as a no-op; compare database, authenticated admin API and public availability. At this point HBO's three results and the Netflix delta remain open, not solved.
