# Live receipt isolation investigation — pending explicit activation approval

No production configuration, database, receipt or deployment was changed in this
investigation. Existing deployed commit remains d677b78 until a later release.

## Measurements, not assumptions

Read-only Render logs after the previous release showed a 114287-byte JPG upload
HTTP200 (4704ms), its order HTTP201 (6586ms), and a 1884712-byte PNG upload HTTP200
(7528ms), followed by an order request disconnected at `history_session`, logged
499 after 3821ms. None of these is asserted to be the customer's original incident.

Read-only current configuration audit: first-party mirpanel.com proxy, private
receipt bucket, 5242880-byte server and bucket limits, permitted JPEG/PNG/WebP/PDF,
Storage bucket/list HTTP200. Browser-order cookie is host-only Secure/HttpOnly,
SameSite=Lax. Client upload timeout120s, proxy125s; production Storage adapter
fetch25s (the outer upload timeout75s does not override that inner bound).
No corresponding current upload failure establishes decoder/storage as the cause.

The old external test database login failed with PostgreSQL XX000. A new disposable
localhost-only PostgreSQL database and authenticated fixed-operation gateway were
prepared instead. They cannot select a production DSN. No arbitrary SQL endpoint.

## Prepared closed live-domain flow

`receipt-live-probe.mjs` is disabled by default and fails closed after its absolute
expiry. A CSRF-protected owner-admin operation issues a one-use ticket, redeemed in
the live domain into a separate20-minute Secure/HttpOnly synthetic session. With
that session only, normal payment paths use the exact payment API and safety worker
against a separate synthetic database; immutable files are forced below
`diagnostics/<run UUID>/pending/...` in the private Storage bucket. No real catalog,
stock, account, wallet, notification queue or Gmail mailer is supplied. Evidence
readback checks stored bytes/hash against that test order. Test sessions never
fall through into real customer mutations on an invalid/expired probe cookie.

## Completed checks and remaining blocker

- 22 probe security checks passed: disabled default, CSRF, forgery, one-use ticket,
  cookie attributes and private view.
- 56 Chrome/WebKit assertions passed across JPEG, PNG, safe PDF and iPhone MPF,
  including a real server socket dropped after storage, retry, single object and
  order linkage. Local isolated adapter, not production Storage; no physical device.
- Playwright WebKit route.fetch interception omitted multipart bytes. A normal
  non-intercepted WebKit upload passed. Socket-level response loss was used instead;
  no application patch was invented from that test interception artifact.

Live activation was blocked BEFORE executing the Render env write by the automatic
security reviewer: adding the temporary public tunnel URL and bearer key to the
production service is a new diagnostic surface and needs explicit user approval.
No workaround was attempted. Consequently the live-domain write matrix has NOT
run and the original incident is NOT marked solved. The prepared changes are kept
on a separate branch, not pushed/deployed. Temporary public tunnel is stopped while
approval is pending. Keys remain outside Git in a locally access-restricted file.
