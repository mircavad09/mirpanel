# Receipt checkout recovery — 2026-11-03

## Evidence and scope

The reported Android JPG is unavailable. A prior 499 tagged `history_session`
cannot be attributed to that incident. That stage previously covered the entire
commit/readback/notification/response tail, so it did not identify the failing
session operation. Safe stage labels now distinguish those operations.

Two independently reproduced defects:

* After successful upload, refreshing discarded the upload proof. Storage still
  held the file, but Continue was disabled. Reproduced through mirpanel.com in
  Chrome and WebKit before this change.
* Removing the browser-history cookie after upload produced 409
  `BROWSER_SESSION_REQUIRED`. The UI treated every 400/409 as an invalid receipt
  and forced re-upload, which could not restore the cookie. Reproduced through
  mirpanel.com in both engines before this change.

## Fix

Persist only the encrypted, reservation-bound proof in sessionStorage. Resume
checks the reservation, capability and actual private Storage object before
enabling Continue. Invalid/missing proofs leave Continue blocked and allow file
selection again. On the explicit history-cookie error, obtain a server-issued
cookie using the existing methods endpoint, then retry the same reservation and
idempotency key once. A failed recovery preserves the proof and offers retry.

No session lifetime, decoder acceptance, OCR policy, stock rules, account role,
notification recipient or Gmail queue behavior was changed. No migration.

## Test caveats

The temporary live probe uses the real payment handler/safety worker/Storage
adapter but a separate disposable PostgreSQL database, synthetic ownership and
Storage prefix. It suppresses notifications and cannot reserve real stock.
Initial probe-host markup and evidence-reader fixture defects were corrected;
those failures are not customer application defects. Local WebKit on plain HTTP
does not accept Secure cookies; session cases use live HTTPS instead. Emulated
mobile Chrome/WebKit results are not physical Android/iPhone testing.

## Completed live verification

Deployed fix a7ad933: 32 HTTPS live diagnostic cases passed across Chrome and
WebKit, plus two offline/reconnect cases and one throttled Chrome case. Five
formats (ordinary JPEG, Samsung SEF JPEG, iPhone MPF JPEG, PNG, PDF) were stored
and read back with matching SHA-256 in their synthetic SQL orders. Lost upload
and order responses recovered; refresh, missing history cookie, duplicate clicks,
session/reservation expiry, damaged input and oversize rejection were covered.
The initial evidence-reader fixture failures and an incorrect assertion about
the native file input (the selected File is retained in application state) were
corrected and rerun, not counted as successful application tests.

Final isolated audit: 46 synthetic orders, 51 synthetic objects, no duplicate
reservation/order or receipt object, every order's receipt present, zero queued
synthetic email. The temporary environment keys, 51 objects, disposable database,
gateway and tunnel were removed at 14:45 UTC, before the 15:35 UTC deadline.
The deadline watchdog's later redundant cleanup failed because the gateway was
already stopped; independent read-only verification checks the final state.
Production server/proxy probe entry points are removed in the final release so
later deployments cannot reactivate the temporary connection.
