# Safe checkout cancellation hotfix

Production base: `f8ecb4d`. Community development worktree remains untouched.

Reproduced in browser with the old production JS: X calls the server cancel RPC,
but `finish(null)` removes only `paymentFlowOpen`, leaving host modal `.show`.
The outer order controller awaits null and returns without closing it. Cancel
was a different path with a homepage redirect; during upload it only aborted the
request and never cancelled the reservation. X was disabled during upload.

Both controls now use one guarded cancellation handler, with no native confirm
dialog or redirect. It waits for the existing capability-checked server endpoint,
then stops timers, clears checkout state, closes the host modal and releases both
viewport and host scroll locks. Backdrop/Escape cannot bypass server cancellation.
Network/server errors keep the modal open and expose an explicit cancel retry.
Already-submitting orders cannot be cancelled. Upload callbacks use a generation
guard, so cancellation invalidates all progress/success/error/retry callbacks.
Private staged-file retention/cleanup remains unchanged. OCR remains disabled.

No backend/RPC/schema mutation is necessary: the existing row lock, checkout-key
check and inventory lifecycle trigger already provide atomic idempotent release.
Real PostgreSQL tests use a newly created local disposable database and two
connections: one release/audit event, wrong capability rejected, reviewing order
protected, completed order and DELIVERED inventory untouched, expired retry safe.

Tests: `test-checkout-cancel.mjs`, `test-checkout-cancel-postgres.mjs`, existing
`test-receipt-manual-continue.mjs`, `test-checkout-viewport.mjs`.
All fixture mutations are isolated; no production reservation/order/receipt/stock
or WhatsApp message is created. Production checks are deploy metadata, health,
asset equality and browser tests with all payment writes routed to local fixtures.
