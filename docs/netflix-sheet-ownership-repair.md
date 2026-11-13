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

## Live release gate — NOT completed

No live spreadsheet cell, payment, order, room assignment or balance was changed.
Render API currently returns 401. Browser inventory reports local browser access
unavailable for this chat. Google Drive is available but not connected.

Before pushing/deploying this change:

1. Connect Google Drive with the authorized sheet owner's account and refresh
   the existing protected Render access; do not paste secrets in chat.
2. Back up the full spreadsheet including hidden identifiers and formatting.
   Verify the copy is readable and retains the existing access restrictions.
3. Read paid Netflix orders, delivery snapshots, room units, legacy assignments,
   renewal confirmations, queue states and spreadsheet raw/formatted cells.
   Produce a private identity reconciliation; do not export credentials publicly.
4. Review every duplicate, missing identity or nonmatching A value. Never
   overwrite an existing different customer ID or infer ownership from stock alone.
5. Restore only proven empty A cells and factual F statuses, and record counts
   separately for IDs, statuses and unresolved conflicts. Do not recreate sales.
6. Merge current main, rerun targeted tests, deploy and verify the actual version.
   Read back every repaired row, run another automatic sync cycle, and read again
   to prove the ownership/status persists. Record counts, not private identifiers.

Do not report a live cause, restored counts or completed repair until these
checks actually run. The prepared implementation is not itself a live recovery.
