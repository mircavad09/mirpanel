# Netflix Sheets ownership repair

## Verified locally

- The running server starts the delivery-ID worker. It previously wrote A only,
  never F, and never rechecked successful jobs. Historical deliveries without
  queue rows were not discovered.
- The separate stock synchronizer overwrote A:H, including a blank owner from
  stock state. This erasure risk is reproduced by the ownership regression test.
  Live logs are still required to identify the writer responsible for the actual
  incident; the current server did not previously start that synchronizer.
- The repaired delivery writer resolves email + room name + PIN twice, writes
  A and F together, and verifies them. Formatted numeric cells, leading zeroes,
  separators, duplicate rows, conflicting owners and moved rows are covered.
- Whole-row writes share an ownership guard, resolve hidden ID plus room
  identity, reuse legacy rows, preserve existing ownership on empty stock state,
  reject conflicts, and verify the saved owner, status and credential revision.
- Successful jobs are reverified after 15 minutes; missing paid delivery jobs
  are backfilled on startup. Stock/legacy state uses the same advisory lock and
  client guard. Background full-sheet sorting/rewriting is no longer invoked.
- Initial 1/3/6-month purchases are sold, not renewed. Only confirmed renewal
  payments produce the renewed status. Customer binding remains non-financial.
- Stock sync errors use existing protected checkpoint storage and appear in
  the admin stock view without credentials or PINs.

## Passing isolated tests

Run from this worktree with MIRPANEL_SHOP_TEST_PORT=55489:

- node scripts/test-netflix-sheet-ownership.mjs
- node scripts/test-netflix-sheet-customer-id.mjs
- node scripts/test-netflix-room-sheets.mjs
- node scripts/test-netflix-room-legacy.mjs
- node scripts/test-netflix-paid-flow.mjs

Two older presentation tests (test-netflix-paid-period.mjs and
test-netflix-room-sheet-style.mjs) contain pre-existing expectations for six
conditional status rules / TEXT_STARTS_WITH, while the current main uses one
neutral alternating-row rule. Those unrelated presentation assertions were not
changed to hide their failures. The paid-period calculations before that
assertion pass; the new ownership suite checks 1/3/6-month entitlement isolation.

## Live recovery, 14 November 2026 (Baku)

The user explicitly authorized the pre-existing service account instead of a
new Google Drive connection. Official Render CLI authentication refreshed the
existing local credential. No new Google account/key or permission was created.

The entire spreadsheet, including raw/formatted cells and hidden identifiers,
was backed up using Windows CurrentUser DPAPI. Each encrypted backup was decrypted
in memory and its SHA-256 verified before any repair. Backups remain under the
ignored private outputs/netflix-sheet-recovery directory, never in Git.

Initial audit: 989 sheet rows, 52 paid deliveries, one legacy binding and 33
uniquely matched entitled rows. Their customer IDs were present at audit time;
33 statuses were stale. A real sale occurred independently during recovery,
raising the verified total to 34. First-backup comparison shows 34 status changes
and one new-sale ID (not a recovered historical ID). No historical empty ID was
found among the uniquely matched current rows.

All 34 matched rows were read back with correct customer IDs and factual status.
The changes were merged with the latest parallel ready-stock management work;
Render confirmed bf5403f live and the new admin JS served successfully.

Twenty historical delivery claims have no exact current sheet identity: 19 have
no matching Gmail row; one has Gmail rows but no matching room/PIN. They are not
silently appended or written over another room. The live automatic queue records
them as missing and exposes the reason in the admin stock view. Additional hidden
identifier conflicts found by whole-row sync are preserved for administrator
review rather than overwriting their existing metadata.

No payment, balance, order or delivery was created or replayed by recovery.
The historical writer responsible for past ID disappearance cannot be conclusively
attributed from current records alone. The destructive whole-row write risk is
proven in code/tests and removed; the missing-status behavior in the old active
delivery writer is directly confirmed.
