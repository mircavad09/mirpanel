# Admin Users — isolated production extraction

Base: `e2f6eaab37918f53259bf2568c7bb72d9b8a8925` (latest production/CMS
commit at branch creation). Development preview remains at `2dfc9d1`, separate.

## Data source and scope

Production uses its existing server-only Supabase Auth Admin API. Read-only
discovery confirmed project `sidgtcgyqkdplgfabmmp` (`mirpanel-payments`), total
registered Auth users **0**. The preview's Better Auth tables/users are separate
and are neither read nor copied. Empty production accounts are displayed honestly.
No employee accounts, browser guest history or orders are relabelled as customers.

The page shows ID, display name, email, optional phone and actual confirmation
state, registration timestamp, account state and sign-in providers in details.
No tier/purchase computation is ported. No public registration, Google OAuth,
community/group, profile, balance, customer navigation or auth configuration is
deployed. Existing checkout, receipts and cancellation files remain unchanged.

## Routes and security

- `https://mirpanel.onrender.com/admin/users`: existing owner admin session.
- `GET /api/admin/users?q=...&page=1&limit=20`: literal name/email/ID search.
- `GET /api/admin/users/:uuid`: explicit whitelisted account projection.
- Admin JS/CSS are also session guarded; direct HTML file route is not served.
- Existing authenticated employee sessions receive 403; guests receive API 401
  or page login redirect. Metadata/client headers never confer admin privilege.
- Mutation methods receive 405. No account mutation SDK methods are used.
- Auth upstream failures produce 503, never a fabricated empty directory.
- Browser data is private/no-store. A five-second process-private snapshot
  deduplicates upstream reads, bounded to 10,000 users; oversized/incomplete
  scans fail visibly rather than hiding additional users. UI refresh is 10 sec.
- Cloudflare `/admin/users` redirects to the guarded Render page. New admin
  template/source paths, including encoded and extensionless aliases, are
  denied from the public static mount. No public users API is proxied.

## Migration and dependencies

**No migration or production database write is required.** Existing Supabase
Auth APIs and the already installed Supabase SDK suffice. No package/auth
dependency or environment variable is added. There is no test-data backfill,
account creation, schema change, key rotation or bypass of a required backup.

## Verification performed

- Repository: 40 assertions (projection/privacy, literal search, pagination,
  bounded scans/cache, provider errors, absent source and empty directory).
- Actual production HTTP server + actual Supabase SDK against an isolated
  local Auth/PostgREST protocol fixture: 93 assertions. Real owner login and
  employee sessions, page/assets/API denial, 405, malformed UUID, detail lookup,
  search/pagination/empty/error/retry/logout, six viewport widths (320/390/430/
  768/1024/1440), zero JS errors or new 404s. No external calls or Auth writes.
- Actual Cloudflare middleware: 36 assertions (admin redirect, encoded/static
  bypass protection, no public API, unrelated checkout/asset paths unchanged).
- New feature total: **169 assertions, 0 failures**.
- Existing admin authentication boundary tests passed, including login cookie,
  session survival after upstream failure and login/browser redirect scenarios.
- Existing checkout cancel proxy/browser: 142 passed; mobile receipt formats:
  8 passed; receipt upload/security regression: 19 passed. OCR remains off.
- `scripts/test-admin-ui.mjs` has a pre-existing static banner assertion failure
  “Sadə banner siyahısı yoxdur”. Re-running the committed test against files
  read directly from base `e2f6eaa` reproduces the exact failure. Neither the
  banner implementation nor that test is modified or counted as passing.

## Release/rollback

Commit/push only this branch's admin files, narrow edge boundary and tests/docs.
Wait for Render and Cloudflare metadata to identify the same commit. Verify
owner login, empty API/page, guest denial, edge source denial, admin asset bytes
and unchanged receipt health. Live verification creates no customer/order/
reservation/receipt/stock/bonus/WhatsApp data. Employee 403 is exercised in the
isolated server; do not create a production employee account to test it.

Rollback is code-only: revert this scoped commit and deploy the prior code.
There is no database rollback or removal of existing records. Preview branch,
database, files and unrelated local changes are preserved.
