# Live ready-stock reconciliation — 22 November 2026

This continues `fcb689e6`, not a replacement of that investigation. **The three HBO units are not yet restored.** Their remaining service/warranty eligibility is awaiting the owner's confirmation; no expiry is stored on these free generic units and their additional message is empty. No real checkout, delivery, balance change, reserve release or account-content edit was created by this audit.

## Access and version evidence

The existing DPAPI-protected PostgreSQL credential works with verified TLS. Audits use repeatable-read, read-only transactions. The old Render API credential was not retried. At **23:34:52 Baku (19:34:52 UTC)** the active Render health endpoint reported `adc42269aa2e59c31d50d15e346f27b148db532e`, which contains `fcb689e6`. Cloudflare's live `app.js` and the matching local main file both had SHA-256 `18e3e25b032ab2ab5a5854ed3f99b11eee7cc9936d92b52d9da2f1025181eb79`. These are runtime/content checks, not an assertion that a Cloudflare deployment alone proves server deployment.

Local sanitized evidence: `outputs/stock-reconciliation-20261122/read-1795375019526.json` (events), `read-1795375286984.json` (all scopes), `read-1795376093889.json` (database/API/runtime comparison). These files contain no account passwords, PINs or keys.

## HBO: exact targeted records

Old batch: `51d8984c-bae7-4f63-adc4-52ea8830ad8f`, added 15 November at 12:34:24.700 Baku. All three records below are undelivered, unassigned, not deleted, revision zero; no live reservation was present at the audit snapshots.

| Unit ID | Current result |
| --- | --- |
| `bc5b91aa-2856-42df-b33e-a3bc73cbbc25` | Unmatched old scope; held out of sale pending eligibility confirmation |
| `c6bad5a2-8619-4fb6-87a5-e419d602fc64` | Unmatched old scope; held out of sale pending eligibility confirmation |
| `e7ab7e42-145f-44dd-86a7-24c890e1e1b9` | Unmatched old scope; held out of sale pending eligibility confirmation |

Old scope signature: `bc55dcea6e2ea65d057d825a63d1c8da20e599d8e5ddeb259ee35d316674e959`; target: `d1062bd2f0a1d6513aee999392c1f94a5434b9ca7c60dc2e90295acc53b11f80`, key `0`. Historical `1 ay ` and current `1 ay` share stable pricing UUID `9862f006-0b4b-4c63-97ef-eda5829158da` and a one-month duration. Historical warranty was 27 days; current warranty is 28 days. Matching identity does not establish remaining provider entitlement.

The other six units in the old batch were delivered in orders **12841, 12848, 12916, 12937, 12956, 13036** and must remain historical. The new batch `39c5539d-94c5-41fb-8902-6d8f20dbcd19` contains nine units, three delivered, six free. Its latest intervening sale was **13229 at 23:03:58.145 Baku**; thus an earlier new-scope count of seven became six without a reconciliation write.

At **23:31:14.437 Baku** a targeted before-image of the three old units, their batch and management state was saved with Windows DPAPI in the existing private backup directory, then decrypted in memory and compared exactly. It is not committed or publicly served. Normal scope repair additionally retains the original encrypted stock payload in the restricted `ready_stock_account_revisions` table.

## Netflix: 2 → 1 → 6 → 5, not one instantaneous count

All following times are 22 November, Baku:

| Time | Event | Free-room effect |
| --- | --- | --- |
| 20:07:12.682 | Order 13215 delivered | Prior population becomes 2 |
| 20:17:42.648 | Order **13216**, room `ca58b28c-d692-4eaf-af57-b494a0276b66` | **2 → 1** |
| 20:44:01.301 | Order 13218 delivered | 1 → 0 |
| 21:38:19.223 | Five rooms added; pending order 13219 delivered at 21:38:19.364 | 0 → 5 → 4 |
| 21:41:49.926 | Order 13222 delivered | 4 → 3 |
| 21:49:29.290 | Order 13223 delivered | 3 → 2 |
| 21:49:57.262 | Order 13224 delivered | 2 → 1 |
| 21:51:11.409 | Five additional rooms added | **1 → 6** |
| 22:34:34.877 | Order **13226**, room `ddbb427c-3e1e-4521-a609-880684af3328` | **6 → 5** |

At the 23:34 snapshot the database sellable view and public API both reported five. Admin displayed five in a separate contemporaneous observation. All five are non-synthetic, unexpired, available, unassigned and not held. No room was added or reservation released by this work.

## Prime Video monthly: 3 → 2 → 0 → 7 → 6

| Baku time | Event | Effect |
| --- | --- | --- |
| 20:53:24.396 | Order **13220**, unit `986a7317-a0fa-49a6-9702-5b8b1fbea018` | **3 → 2** |
| 22:39:39.105 | Existing owner deletion, audit **23086**, unit `bc98ef5e-aae6-40df-b543-3d7702b0be3d` | 2 → 1 |
| 22:39:45.368 | Existing owner deletion, audit **23087**, unit `f9e439a0-220d-4123-bc1e-ad924242a424` | 1 → 0 |
| 22:40:08.910 | Seven units added, batch `6664873f-814f-4dc0-979c-4ca4be7915c4` | 0 → 7 |
| 23:01:36.880 | Order **13228**, unit `040ee737-4c73-4810-b71a-d0c97f37a6b9` | 7 → 6 |

Monthly database/API count is six; six-month count is four. Admin total ten combines those packages. No Prime repair is needed on this evidence.

## All-product audit at 23:34:52 Baku

Counts are ready-account units, not separately configured sales limits. There were no live reservations and no duplicate current catalog scopes. Every generic unit has one stored product/key/signature tuple; this is not a claim that externally supplied credentials were independently authenticated.

| Product / scope | Total | Free | Delivered | Deleted | Catalog match |
| --- | ---: | ---: | ---: | ---: | --- |
| CapCut old monthly signature | 1 | 0 | 1 | 0 | No — historical only |
| CapCut monthly | 54 | 4 | 48 | 2 | Yes |
| CapCut 7-day | 16 | 2 | 12 | 2 | Yes |
| CapCut old index 2 | 3 | 0 | 1 | 2 | No — historical only |
| ChatGPT | 12 | 0 | 12 | 0 | Yes |
| HBO old signature | 9 | 3 | 6 | 0 | No — three need eligibility confirmation |
| HBO current | 9 | 6 | 3 | 0 | Yes |
| Prime monthly | 38 | 6 | 28 | 4 | Yes |
| Prime six-month | 8 | 4 | 4 | 0 | Yes |
| Surfshark | 10 | 8 | 2 | 0 | Yes |
| Zoom | 3 | 0 | 3 | 0 | Yes |

No generic manually assigned units were present. No other unmatched **free** stock scope was found. Products without generic units were included through the live catalog and public fulfillment response; their zero ready-account counts are not supplier stock counts.

## Safe scope-only repair implementation

The existing authenticated owner stock-management flow now distinguishes package-only relinking from account-content editing. `relink` checks the exact expected old signature, target catalog signature, revision, deletion/delivery/assignment state and live reservations in both old and target scopes. It uses the existing allocation advisory lock `714025001` plus unit row locks. A restricted encrypted before-image is recorded before updating only the scope and its encrypted binding; email, password, message and unknown payload fields are not reconstructed. Repeated/concurrent requests for the same target are no-ops and do not append a second backup or audit event. Delivered/deleted/reserved units are never reopened.

The admin edit form sends this command only when the package changed and every account field is unchanged. Ordinary account edits keep the existing path. There is no new unauthenticated endpoint, key export, automatic alias or background mass migration.

## Isolated verification

- All 80 existing package signatures/cost keys preserved; rename, reorder, price/cost edits and repeat publication remain stable; genuine duration changes stay isolated.
- PostgreSQL management tests passed, including exact scope-only content preservation, encrypted before-image, concurrent/no-op repair, reservation blocking, one assignment/allocation under competing operations, historical and balance isolation.
- Ready delivery tests and 46 queue checks passed, including exact package, partial quantities, FIFO, retry, concurrency and idempotency.
- Chrome and WebKit at 320/390/430/1440 passed the scope-only admin command and count refresh tests; no credentials are resubmitted in that command.
- Chrome and WebKit at 390/1440 passed failed-read preservation: an error is not replaced with zero; unmatched stock warning and separate sales limit remain visible.

## Still required for acceptance

Confirm whether the three old HBO accounts each provide a full one-month service with the current 28-day warranty from delivery. Then recheck reservations, relink only eligible IDs, read them back, rerun as a no-op, and reconcile database/API/admin after refresh. Independently verify the new repair code's deployed runtime commit. Do not report these pending steps as completed.
