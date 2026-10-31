# Account-only order history — 2026-10-31

Only history reads change. Guest checkout, receipt safety/OCR-off policy,
reservation/stock rules, WhatsApp continuation and browser ownership writes stay
unchanged. No anonymous orders are deleted or linked to an account by this release.

`/api/payments/my-orders` and its receipt route now require the existing signed
account session. Guest/browser-history-cookie-only requests return 401; the
owner-only launch restriction remains (other accounts 403). Queries join existing
`mirpanel_community.community_order_owners` on the authenticated internal account
ID. Order numbers, browser tokens, query/body account IDs and pagination tokens
cannot override ownership. Pagination is encrypted and bound to that account.
Receipts are signed only after ownership verification, for 60 seconds. Private
responses retain no-store/Vary Cookie headers. No new public account API exists.

The guest history view links to `/owner-login?next=%2Fsifarislerim` and the closed
registration screen. OAuth initiation accepts only the exact local history URL
as an alternate callback; all other values use the existing `/profil` default.
The allowlist does not change Google identity verification or registration policy.

History DOM and receipt content are cleared at sign-out, hiding, and pagehide;
in-flight replies are invalidated. A non-private localStorage timestamp broadcasts
successful logout to other tabs; no orders, tokens or personal data are stored.
Reload/bfcache return fetches from the server again.

## No migration

Existing user/session/owner_identity/community_order_owners/payment_orders tables
and existing receipt fields are reused. Synthetic PostgreSQL uses current
migrations without any new schema. There is no production SQL, backup download or
business-data write in this release. Existing anonymous browser history remains
in the database but is not returned by the public history read routes.
Accounts without explicit order links see an empty list; old anonymous orders
are not inferred or imported. Account-link creation is not added to checkout.

## Verification

Executed synthetic checks:
- `test-account-orders.mjs`: 58 checks, zero failures. PostgreSQL, real auth sessions, payment HTTP routes,
  pagination, account/anonymous isolation, private receipts, logout/parallel tabs,
  late-response suppression, 320/390/430/768/1440 UI, closed signup, OAuth state
  return-target and open-redirect protection. No real Google consent/callback.
- `test-owner-release.mjs`: 838 checks, no failures (owner restrictions/profile).
- `test-receipt-manual-continue.mjs`: 144 checks, no failures (guest purchase).
- `test-checkout-cancel-proxy.mjs`: 142 checks, no failures (real proxy/API).
- `test-owner-proxy.mjs`: 11 checks, no failures.
- `test-inventory-upstream.mjs`: 18 checks, no failures.

Release backend first, then frontend; confirm both commits, guest 401 for list and
receipt, closed registration, mobile/desktop login screen and new asset version.
Do not manufacture a production order or login test account. Real owner Google
consent and account order data are not exercised in live guest checks.
Application rollback: redeploy the previous application only; no SQL rollback.
