# Admin session idle/restart hotfix

Scope: production admin session/editor only, based on `1d18654`. No community
code, customer checkout, orders, payments, receipt processing or catalogue edits.

## Evidence and cause

The original server keeps admin sessions and drafts only in a process `Map`.
Its nominal idle TTL is **8 hours**, and every read (including automatic polling)
extends it, but the browser cookie is issued once for 8 hours without renewal.
There is no frontend session-expiry timer. On process replacement the Map is
empty, so a perfectly valid cookie receives `ADMIN_SESSION_REQUIRED` and the
editor's three handlers navigate to login without preserving local edits.

Read-only Render metadata on 2026-10-27 shows content-triggered deploys finishing
at 19:06:58, 19:09:02, 19:10:05, 19:12:29, 19:13:44, 19:16:27 and 19:17:47 UTC.
The live admin asset matches this Map/redirect implementation. The regression
against original `1d18654` fails: an active session cannot survive replacement
of the server instance. This establishes the deploy/restart defect; no claim is
made to possess the customer's private request/cookie log for a particular click.

## Fix

- Private `admin_sessions` table is the sole authentication authority when
  Supabase is configured. Store SHA-256 bearer ID hashes, an HMAC auth binding,
  and timestamps only; no raw bearer ID, password or CSRF token is stored there.
- Server-derived CSRF is stable across restarts using the existing server token
  secret (no secret changes). Password changes invalidate old session bindings.
- Database RPC atomically touches only unexpired sessions, to **60 minutes**.
  Ordinary polling, GET session checks and asset reads never extend the idle
  deadline. Same-origin CSRF mutations and trusted user document navigations
  renew it. Trusted visible input events send a throttled activity POST, not a
  periodic heartbeat. Network failures are bounded and cannot claim renewal.
- Cookie `Max-Age=3600` is renewed with activity. Host-only, HttpOnly,
  SameSite=Strict remain. HTTPS admin origins force Secure even if the legacy
  `COOKIE_SECURE` flag is absent/false; live verification exposed that old flag
  gap and the follow-up fixes it without changing environment secrets.
- Logout requires same-origin CSRF and revokes the DB row before success;
  revocation remains effective after restart. Storage failure is 503, not a
  fabricated session-expiry or successful logout response.
- IndexedDB holds only catalogue editor data/base SHA/selection and selected
  product images. Auth/session/password fields are excluded. Recovery requires
  an explicit click after login and never automatically publishes. Recovered
  image files must be uploaded again before publishing; conflicts keep the old
  base SHA so existing server conflict checks remain effective. Explicit logout
  and confirmed publish clear local recovery. IndexedDB is local browser storage,
  not an external backup; shared-device admins should always log out.
- Server-side staged image bytes remain transient; the local retained file is
  what allows safe retry after process replacement. No fake success is shown.

## Migration / backup / rollback

Migration: `supabase/migrations/202610270003_admin_sessions.sql` (additive,
transactional/idempotent). Verification: `supabase/admin-sessions-verify.sql`.
Rollback: `supabase/rollback/202610270003_admin_sessions.sql`: deploy prior app
first, then revoke the new RPC; retain all data. No employee schema migration
is rerun and no employee schema version is changed.

Before production application, `scripts/browser-orders-private-backup.mjs
--admin-sessions` exports a consistent external public-schema backup and restores
it into an isolated loopback-only PostgreSQL cluster with no app attached.
Tables/data fingerprints, functions, constraints, indexes, RLS and policies must
match. It then applies this migration twice, verifies permissions, rolls back
without business-row changes, and records the migration SHA-256. The archive is
DPAPI-encrypted using the existing owner-only local backup directory; no backup
or credentials are committed. Archive scope excludes Storage file bodies and
other schemas (not touched by this migration). A manifest alone is not a backup.

`scripts/admin-sessions-apply.mjs` refuses application without this exact verified
encrypted backup and explicit project `sidgtcgyqkdplgfabmmp`. It compares all
existing public business table row fingerprints before/after and verifies RLS,
anon/authenticated denial, service-role RPC and a single manifest entry.

Old in-memory sessions cannot be exported from the existing process and will
require one fresh login on the initial rollout. Subsequent restarts retain the
new DB-backed sessions. The new application must not deploy before its migration.

## Tests

- Original regression: **fails as expected** on `1d18654` process replacement.
- `test-admin-session-idle.mjs`: **24** controlled-time/real PostgreSQL checks;
  59-minute activity, exact 60-minute idle expiry, polling, restart, logout,
  password-binding change, storage 503, first/repeated migration/rollback.
- `test-admin-session-browser.mjs`: **23** actual production-server checks with
  real isolated PostgreSQL behind a local protocol adapter: browser login,
  cookie, CSRF, process restart, actual synthetic PNG staging, expiry, recovery
  after login, image retry, secret exclusion, logout and restart after logout.
  Restart after staging also requires the retained image to be restaged and
  previewed before publishing, even when the DB-backed session is still valid.
- `test-admin-activity.mjs`: **14** clock-controlled frontend checks: real input,
  untrusted events, hidden page, throttling, network retry, expiry, no heartbeat.
- Existing `test-admin-auth-boundary.mjs`: pass (HTTP boundary plus five browser
  login and five redirect scenarios); cookie expectation updated to 3600 seconds.
- Existing admin Users production-server fixture: **114 passed**, including
  employee403/guest401 and 320/390/430/768/1024/1440 widths. Logout fixture now
  supplies required CSRF; unchanged source compares to current production base.
- Existing admin edge boundary: **36 passed**. Existing admin browser editor
  publish-failure/responsive test: pass. Its stale expectation of an 'unsaved'
  label after failure also failed against original `1d18654`; it now asserts the
  actual failed state and preserved-edits text, not success.

Only synthetic data is used in application tests. Private backup restoration is
separate and never connected to an application. No production product/image,
order, reservation, receipt, bonus, stock or WhatsApp-message mutation is tested.

## Actual database release

External backup and isolated restore: **45 public tables / 102 functions**;
all recorded data/definition fingerprints matched. DPAPI archive encryption
roundtrip verified. The migration digest used in the restore and production
gate was `9e89cfd4cb8f5766d943e7cd4da039fabae778df70c8c5c94be3a4280a30edfd`.
Production application/verification passed; the existing **45 business tables
were unchanged**, new session rows were **0** immediately after migration.
Existing employee schema probe remained **6**, not modified by this migration.
Production login/logout smoke checks may create/revoke authentication session
rows only; they must not mutate business objects or perform real uploads.
The live verification helper reads up to 100 Render environment entries (the
default first page omitted admin credentials) and avoids printing cookie values
in assertion errors. Its finally block revokes its own session even when a
later smoke assertion fails.
