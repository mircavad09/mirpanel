# Netflix Sheets integrity incident · 14 November 2026

The previous e805695 report documents ownership repair; the underlying bf5403f change activated the second, stock-row writer. It fixed blank-owner overwrite but did not validate account expiry. `saveNetflixRoomCards` deliberately stores PostgreSQL `infinity` for undated stock. `roomSheetState` forwarded that sentinel, and `roomSheetCells` fell back to a text cell when date parsing failed. Thus a background stock/password/checkpoint refresh could replace a human-entered E date with literal `infinity`. It also confused a legacy customer's paid-until date with the Netflix account expiry. The delivery-ID writer touches A/F only and cannot cause the E corruption.

The live audit found one Render service configured for this Sheet ID. Older deployments were deactivated. Drive's last modifier was the existing service account. Both automatic writers use advisory lock 926110213; an incident session held that lock before taking a verified, Windows CurrentUser-DPAPI-encrypted whole-book backup. No credentials, Gmail/PIN/password values, or spreadsheet backup is committed.

At the freeze: 990 rows, 32 invalid E values. All 37 uniquely matched current delivery rooms already had the correct member ID; there is no observed missing current ID to claim as restored. Seven blank-ID rows lack a proven current customer. Earlier loss shown in screenshots cannot be attributed conclusively without a historical cell-change log. The existing ID guard is retained and strengthened: unknown ID is omitted from the API payload altogether. A different owner/clearing is accepted only with the matching previous owner and persisted administrator release history.

Changes:

- Only finite, valid calendar dates enter E. Unknown expiry preserves the existing E cell by omitting it from narrow writes. The unused automatic full-grid grouping/rewrite writer is disabled.
- E represents account expiry; paid subscription expiry is a separate line in F. Unknown account date is surfaced through the existing admin sync-warning view.
- Sold status requires delivery/payment evidence or a legacy entitlement. Confirmed renewal status cannot be downgraded by a delayed sold-only writer. A/F-only retries preserve paid-period details.
- A row is resolved twice by hidden ID and Gmail/room/PIN, and saved values are read back. Unchanged rows issue no mutation.
- Cross-instance advisory serialization plus share locks on the stock room/account fence stale credential/stock snapshots against concurrent mutations. Existing persisted checkpoints support process restart.

Recovery uses a unique finite date on another row of the same Netflix account, matched back to the exact room identity. Seven dates are provable. Twenty-five have no finite same-account date, admin expiry audit, or accessible older backup/revision. Those invalid sentinel cells may be cleared with an explanatory note; this is explicitly not counted as date restoration. No year or date is guessed. The service account's Drive revision API exposes only the current revision and no historical export.

Tests: test-netflix-sheet-date-integrity, test-netflix-sheet-ownership, test-netflix-sheet-customer-id, test-netflix-room-sheets, test-netflix-paid-flow, test-netflix-room-legacy and test-netflix-sheet-locking. They exercise real synthetic automatic/manual/card delivery, binding, renewal, restock, password change, sorted rows, reply loss, repeated writes, concurrent workers and persistent restart state. The legacy test intentionally now expects the account expiry in E instead of the customer's paid-until date; status assertions retain the caption check and allow the requested separate paid-period detail.


During verification the owner confirmed manually entering the remaining account dates in Sheets. These are authoritative owner edits, not agent-recovered historical dates. A finite existing Sheets date is retained as the fallback when the database account is undated; the worker reports that fallback as known and removes the obsolete missing-date warning. It does not change stock expiry/availability rules in the database. The live verifier distinguishes these confirmed additions from erasure or regression.
