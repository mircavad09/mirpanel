# Checkout cancellation proxy hotfix

Production baseline: `68cd6485f9f49570e67add4684a42342334ab1ae`.
Community/admin preview is excluded from this branch.

## Verified cause

The browser calls `POST /api/payments/reservations/cancel`, matching the
Render API. The Cloudflare allowlist only admitted the obsolete
`reservations/{uuid}/cancel` variant. Cloudflare returned `404` with
`{"error":"Tapılmadı."}` before the API or database was reached.
Read-only/invalid-body live diagnostic: the canonical route returned 404 on
the public site but 400 (invalid reservation/capability) directly on Render.
Neither diagnostic contained a real reservation or created business data.

`node scripts/test-checkout-cancel-proxy.mjs --before` runs the same canonical
cancel acceptance assertion against the old committed proxy: **fails 404 !=
200**, upstream calls **0**. Without `--before`, the fixed handler reaches
the actual local HTTP API and passes.

## Changes and safety

- Admit the canonical cancel route; unknown proxy routes have their own
  `PAYMENT_PROXY_ROUTE_NOT_FOUND` error code. Origin/cookie restrictions remain.
- Only explicit database `RESERVATION_NOT_FOUND` can trigger a further server
  read. Check the target ID plus all reservations for the checkout capability.
  Existing IDs, active/submitted/completed/ambiguous rows, related orders or
  read errors prevent absent-reservation success. No generic 404 is success.
- Existing cancellation RPC and inventory transaction/trigger remain unchanged.
  They enforce ownership, protect submitted orders and release stock once.
- Failed cancellation offers explicit **Pəncərəni bağla**. It states that
  cancellation is unconfirmed and stock is not released. The checkout recovery
  capability remains in session storage; timers/late uploads are stopped.
- JS and CSS version refreshed across public templates; no content edits.
- No database migration, credentials rotation, production test orders,
  reservations, uploads, stock changes or WhatsApp messages.

## Isolated verification

- Proxy/API/adapter/browser: 142 assertions, seven widths (320/360/390/430/
  768/1024/1440). Active, expired, canceled, absent, ownership, wrong endpoint,
  server/network failure, explicit dismissal, stale capability and late upload.
- Existing cancel/X suite: 180 assertions; duplicate-click and upload races.
- Real local PostgreSQL with two connections: 18 assertions; stock release
  once, capability mismatch, expiry, reviewing/completed order protection.
- Manual receipt continue: 144 assertions, no automatic WhatsApp navigation.
- Checkout viewport suite: 180 assertions over nine viewport sizes, visible
  footer, pointer interaction, keyboard-height emulation and zero overflow.

Total for the five suites: **664 assertions, 0 failures**. The intentional
`--before` regression fails as expected and is not a remaining failed test.
The payment-system static check also required updating old literal assertions
for the submit guard and obsolete redirect/confirm behavior. It now checks
the existing stronger `flow.cancelling` guard, shared X handler, late-upload
invalidation and server-confirmed close. These behaviors already exist in the
baseline commit and are covered by actual browser tests above.
Its CMS fingerprint was also stale: both `git show 68cd648:app.js` and the
untouched local app.js yield `de63a4ebed893ae77d387dae05a3897e23ce4a6f50586874404f770485023e49`.
Their bytes are identical. The expected snapshot was refreshed to that verified
production baseline, not to modified product data.

## Release verification

Deploy Render and Cloudflare from the same hotfix commit. Verify deployment
metadata and public asset bytes against committed Git blobs. A POST with `{}`
to the live canonical cancel route must return 400, proving route forwarding
without touching a reservation. A deliberately unknown route must return 404
with the proxy-route code. Full state-changing cancellation testing stays in
the isolated environment; live health alone is not cancellation evidence.
