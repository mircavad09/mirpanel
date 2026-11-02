# Admin user/wallet visual polish — 2026-11-02

Scoped system/Segoe UI sans-serif, readable normal-weight activity, SVG cart and
gear capsules, stable focus/hover, responsive toolbar, compact detail tabs/header,
anthracite/yellow balance card and compact modal with X and AZN unit. Reason and
inactive debit controls removed from wallet UI; identity/amount confirmation and
same request key on retry remain. No customer credit or checkout behavior changed.

All/online/banned filters execute in the canonical PostgreSQL directory query,
including pagination/count. Presence and ban expiry are evaluated server-side.
Unknown last activity is not fabricated.

Server supplies default audit descriptions for balance credit and specified
moderation actions when reason is omitted. Existing reasons are retained for
backward-compatible retries. Actor, target, transaction ledger, before/after cents,
time, owner authorization and immutable audit remain unchanged. No migration or
modification of historical reasons/balances is involved.

Tests: 119 real-server/isolated-PostgreSQL/browser checks and 21 wallet checks,
zero failures. Includes actual filter results and invalid filter rejection,
no-reason balance UI submission and generated ledger reason, mute/unmute UI with
no reason input, no-reason ban/unban and pin audit, existing CSRF/employee/owner
checks, concurrent idempotency, and 390/1440px visual screenshots. No production
test credits, messages, account changes or Gmail operations.
