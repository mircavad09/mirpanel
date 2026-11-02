# Community latency follow-up, 2026-11-02

Scope: production `2e6d88e`, isolated worktree. No Gmail, checkout, stock,
account data, roles, thresholds or moderation-policy changes. No migration.

## Evidence

The live SSE connection was observed for 305011 ms, with 15 heartbeat frames;
the client deliberately aborted at the end. No production message was sent.
This proves stream persistence, not authenticated message delivery.

Read-only Windows-to-production-PostgreSQL snapshot benchmark (five samples):
before [1282,163,160,172,160] ms, median 163, p95 1282;
after [617,82,83,83,81] ms, median 83, p95 617.
The first sample includes fresh connections; four original queries became one.
These numbers are NOT Render-internal or end-to-end browser timings.

Live guest browser BEFORE (five samples each; p95 = slowest sample):

| Width | Route | Median ms | p95 ms |
|---|---|---:|---:|
|390|group|1627|3804|
|1440|group|1629|2953|
|390|login|1665|2093|
|1440|login|1606|2113|

History measurement only waited for `main`, so its 188 ms result is a shell
measurement and is not comparable to the group's data-ready measurement.
Group startup made 2–3 API requests. Login made one.

## Change

Public message snapshot now joins only the necessary public author fields,
purchase aggregate, tags, hidden-ID reconciliation and config in one read-only
query. Existing authorization, hidden-row retention and amount calculation
remain unchanged. No cached permissions or stale message snapshot is used.
Guest stream attachment no longer notifies every other viewer to reload data.
Initial counts and snapshot run concurrently; delivery stays serialized with
notifications to prevent an older snapshot racing a new message/deletion.
`Server-Timing` exposes only release-gate and auth durations, no identity.

## Tests and limitations

Initial DB was stopped; PostgreSQL completed crash recovery without reset.
An earlier local run passed 199 assertions. Repeated runs exposed test scenario
overlap (moderation refresh counted as navigation polling) and auth attempt
limits; tests now finish the moderation page before measuring fresh navigation
and respect a new limiter window rather than disabling security.
Proxy 8/8, checkout-cancel 180/180, inventory API 58/58 passed this turn.
Final full suite: 199 assertions, zero failures. Total with proxy, checkout and
inventory: 445 assertions, zero failures. Synthetic browser delivery samples
[53,35,62,34,37,36] ms: median 36.5, p95 62. Historical polling-JavaScript
baseline in the same isolated environment: median 1875.5, p95 2366 ms.
This historical baseline is not yesterday's already-deployed SSE implementation.
Three test streams, one stream per group visit, zero primary message polling.
Live release results still require post-deployment checks.
No live authenticated sending/deletion is tested: real messages are untouched.
