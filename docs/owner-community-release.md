# Owner-only community release (prepared; not deployed)

## Public/owner boundaries
Public `/qrup` returns only “Qrup tezliklə istifadəyə veriləcək”; `/hesab`
always returns “Qeydiyyat tezliklə açılacaq”, with no registration inputs.
Only the server-verified Google email `mircavad09@gmail.com` is eligible.
Google's verified subject is bound once to a newly created production user ID
under a PostgreSQL advisory lock. No preview IDs, user rows, messages, passwords,
orders or demo purchases are imported. Non-owner community API callers receive
401/403. Auth routes are allowlisted: no email/password signup/signin, update-
profile role fields, email changes, arbitrary OAuth provider or account linking.
The owner role is never derived from editable name/avatar data.

Existing public payment API/cookie proxy and checkout are unchanged. Anonymous
order history remains on its existing browser cookie. Community OAuth uses a
separate Secure/HttpOnly/Lax cookie on mirpanel.com and a separate server secret.
The community proxy forwards only community auth cookies, not owner-admin,
employee or browser-order cookies. No real-time socket endpoint is exposed;
every polling request repeats owner authorization. Third-party Origin rejected.

Backend code is additive to production commit 846b331 (including latest admin
content). Development branch remains separate; only required community code and
artwork are copied, not the preview server, synthetic adapters or test fixtures.
Checkout, stock, receipt safety, cancellation, employee review, admin idle-session
and list-position implementations are not edited.

## Required Render environment (values private)
- COMMUNITY_OWNER_ENABLED=true only once all checks below pass
- COMMUNITY_ORIGIN=https://mirpanel.com
- COMMUNITY_DATABASE_URL: TLS PostgreSQL URL for the existing payments DB
- COMMUNITY_DATABASE_CA: verified Supabase CA, certificate verification stays on
- COMMUNITY_AUTH_SECRET: fresh cryptographic random secret >=32 characters
- COMMUNITY_GOOGLE_CLIENT_ID / COMMUNITY_GOOGLE_CLIENT_SECRET: separate production
  web client, never preview credentials. Do not log or commit values.
- Never change existing PAYMENT_ENCRYPTION_KEY_B64 / PAYMENT_TOKEN_SECRET_B64.

If the feature flag is false, coming-soon pages remain and all group data APIs
fail closed. Missing DB/client/secret configuration returns no private data.
Current code is NOT enabled/deployed until a production OAuth client is available.
No paid resources are required.

## Google setup blocker
Browser automation still reports “Local browser use is disabled in Work settings”
despite the visible Cloud console tab. Do not bypass the control or claim setup
success. Create a separate Web application OAuth client named “MirPanel Production
Owner” in the existing authorized Google Cloud project. JavaScript origin:
`https://mirpanel.com`; sole redirect for this client:
`https://mirpanel.com/api/auth/callback/google`.
Do not modify the preview client or its callbacks. Download the JSON locally;
provide only its local path for secure import, not its contents in chat.
Google audience/consent scope must remain compatible with owner-only testing;
no extra scopes beyond name/email/profile. The first real OAuth callback needs
human account selection/consent and is not covered by synthetic test success.

## Backup / SQL
Only production read-only backup has run. Protected local custom pg_dump archive
was restored to a private loopback PostgreSQL cluster. The source/restored data,
functions, constraints, indexes, RLS/policies matched: 46 tables, 105 functions.
Archive encrypted under Windows CurrentUser DPAPI, roundtrip hash verified.
Scope: public schema, not Storage binary bodies or unrelated schemas. No new
Storage operation is part of this release. Backup manifests are NOT backups.

Migration: `mirpanel-admin/community/migration.sql` (new private schema only).
Verification: `mirpanel-admin/community/verification.sql` (all booleans true).
Rollback: `mirpanel-admin/community/rollback.sql` after disabling the flag and
reverting frontend/backend. It retains all group data/identities/audit.
First and repeated application and rollback preservation passed in the restored
private DB. Production SQL has NOT been applied. New production community tables
must be empty immediately after migration; no moderator roles may exist.

Sequence: validate production client file -> verify current main drift -> apply
minimal migration to existing mirpanel-payments under TLS -> verification -> set
new Render env (without touching other keys) -> backend deploy -> health + auth
deny tests -> frontend deploy -> guest routes/API + checkout read-only checks ->
give owner direct /owner-login link for real consent -> confirm server identity.
Do not advertise completed owner login until the real callback/session is verified.
No production test order, reservation, receipt, message or WhatsApp action.

## Actual final local test runs
1. `test-owner-release.mjs`: 56 assertions (new empty synthetic DB, migration twice,
   verified-email policy, subject binding, closed signup/password/provider,
   guest API denial, owner session, forced callback, CSRF, mobile/desktop routes,
   no public messages, rollback retains orders). Real Google callback NOT tested.
2. `test-owner-proxy.mjs`: 11 assertions, fixed origin/upstream, cookie isolation.
3. `test-browser-orders-proxy.mjs`: 22 assertions.
4. `test-inventory-availability.mjs`: 87 assertions across 22 catalog products.
5. `test-checkout-cancel.mjs`: 180 assertions, X/cancel, upload race/retry.
6. `test-receipt-upload-only.mjs`: 212 assertions, OCR calls 0, synthetic image,
   WhatsApp image and safe PDF, safety/errors and responsive matrix preserved.
7. `test-admin-session-idle.mjs`: 24 assertions, real synthetic PostgreSQL.
8. `test-admin-session-browser.mjs`: 23 assertions, real isolated server/browser,
   restart, idle expiry, draft recovery and synthetic staged PNG upload.
Total 615 final assertions, 0 failures. Initial admin-session run was blocked by
stopped local PG; after restarting that test-only server both suites passed.
All data-changing tests use isolated synthetic DBs, never production records.
