# Community realtime release — 2026-11-01

## Scope and causes

Public production release based on ab9ecd66b59f26ffd7e769785be660a2d0e0900c. Excludes the local historical Gmail sender/supervisor commits and all preview data.

Previously: HTML waited for session/ban checks; state then messages/presence loaded sequentially; profile hydration queried each author's purchase total separately. Messages used 4-second polling and infrequent snapshots; merged snapshots did not remove hidden messages. Navigation started with signed=false and rebuilt the fifth navigation item after each state response. Cloudflare imposed a 30-second abort on every upstream response, unsuitable for a persistent stream.

## Changes

- Public group/login HTML contains no private state and no longer waits for session authentication. All data APIs still authenticate/authorize as before.
- Group state bootstrap fetches profile, config, messages, settings and counts concurrently. Purchase calculations are unchanged, but author hydration is a set query rather than N+1 round trips.
- `/api/community/events` is SSE over the existing same-origin authenticated proxy. One PostgreSQL LISTEN connection per service instance; transaction `pg_notify` is delivered only after commit. No new database objects or migration.
- One stream per group tab; reconnect uses message cursor and known IDs; server pages missed messages. Message ID remains canonical. No optimistic sent status. Moderation runs before insertion/publication.
- Existing presence rows track stream lifetime; distinct accounts are counted by existing SQL. Batched 20-second liveness refresh and 45-second stale TTL cover abrupt disconnects. Public counts exclude bot and existing synthetic-domain filters. This is not a guarantee that every severed mobile network disappears instantly.
- Hiding retains database/audit rows, removes public messages and tag links/counts. Moderation emits immediate removal; reconnect reconciles known hidden IDs.
- Navigation stores only a signed-in visual hint and public avatar reference in sessionStorage, never email/session tokens or authority. Controls remain disabled until state validates; confirmed signout clears hints. Temporary errors do not pretend a logout occurred.
- Proxy retains 30-second response-header deadline, but not an arbitrary stream lifetime. Client abort propagates upstream.

## Verification before release

Production read-only: PostgreSQL LISTEN/UNLISTEN supported; public release readiness true. No production business records changed.

Tests executed:
- `node scripts/test-public-community.mjs`: 199 assertions, zero failures, real isolated PostgreSQL, captured synthetic mail (no actual email sent). Includes two distinct accounts, multiple streams/tabs, reconnect, idempotency, hidden-tag removal, repeated group/profile navigation, six widths 320/390/430/768/1024/1440, profile/media and permissions regressions.
- `node scripts/test-community-stream-proxy.mjs`: 8 assertions, zero failures; deterministic accelerated deadline, cancellation and origin/cookie isolation. This is a proxy unit test, not an actual Cloudflare stream test.
- `node scripts/test-checkout-cancel.mjs`: 180 assertions, zero failures.
- `node scripts/test-inventory-api.mjs`: 58 assertions, zero failures.

Total at this point: 445 assertions, zero failing assertions. Expected negative HTTP responses in test output are deliberate permission/validation tests. The first implementation incorrectly cached the release-ready flag; rollback test caught it (200 instead of 503), caching was removed and rerun passed. A second-account fixture initially omitted required signup form fields; the fixture was corrected, not signup validation.

Measured real production BEFORE, five guest navigations per route/width from this Windows host:

| Route | Width | Median ms | p95 ms |
|---|---:|---:|---:|
| /qrup |390|1524|3549|
| /qrup |1440|1510|1745|
| /hesab |390|1514|2003|
| /hesab |1440|1505|1543|
| /sifarislerim |390|992|1154|
| /sifarislerim |1440|996|1125|

Group made three data requests to ready. Small sample; p95 here is the slowest of five, not a fleet-wide statistic.

Local isolated HTTP/browser + real PostgreSQL comparison, six messages each, old production JavaScript versus new:
- Before: [2363,1849,1879,1864,1849,1871] ms; median 1867.5, p95 2363.
- After: [31,25,34,39,23,22] ms; median 28, p95 39.
- New group visits: one stream per visit and zero recurring GET message polling in the observed 4.5-second window. Presence heartbeat is server-batched, not per-tab HTTP polling.
- These are localhost measurements, NOT production internet message-delivery results. No production test message was sent.

## Release / rollback

No migration or data rollback. Publish a clean group-only commit parented on current main; do not merge local mail commits. Backend first, then Cloudflare frontend. Verify canonical commit, SSE continuing beyond 35 seconds, public bootstrap, guest/admin/history permissions, inventory and health. Repeat read-only live guest navigation measurements. Do not claim authenticated production delivery without testing it.

If application rollback is needed, redeploy previous application commit on both hosts. Existing messages, presence table, audit, purchases and roles remain intact. LISTEN/NOTIFY requires no schema rollback. Existing cached clients may take up to the prior asset TTL to refresh; the group entry script is version-bumped and shared state/header assets explicitly revalidate.
