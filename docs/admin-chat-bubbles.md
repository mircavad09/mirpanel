# Embedded admin chat appearance — 2026-11-02

Only the embedded admin chat renderer/styles, its protected asset route and asset
versions changed. Existing group endpoints, actor resolution, moderation policy,
audit retention, messages, account data and payment/inventory/Gmail code are unchanged.

- Compact left/right bubbles keyed to internal author ID, not display name.
- Existing shared PNG avatar/message frame decorator; each author's own avatar.
- Explicit Asia/Baku 24-hour HH:mm and day separators, safe textContent rendering.
- Avatar, name and menu open an admin-only dialog backed by the same directory API.
- Existing moderation UI/server authorization reused; mute/ban toggle visibility is
  based on fresh server details. Owner-protection remains server/database enforced.
- Single fixed-height grid, only the message list scrolls. Header and composer stay
  visible. Near-bottom auto-follow; otherwise preserve visible message anchor and
  show a new-message button. SSE removal drops the public DOM node, not audit rows.

`node scripts/test-admin-community.mjs`: 83 checks, zero failures; real server and
isolated PostgreSQL. Includes existing admin/employee/CSRF/owner boundaries plus
390/1440px browser tests for bubbles, avatars/badges, Baku 21:20 for 17:20 UTC,
day separators, name/menu profile opening, real mute/unmute menu actions, incoming
message scroll preservation, new-message jump, long URL wrapping, pinned composer
and immediate removal. No application JS errors. Synthetic fixtures only.

The long-message test caught inherited admin grid sizing allowing the list to
cover the composer. Explicit column/row assignment, stretch and size containment
fixed it; no forced browser clicks were used. No migration or production test
messages are required.
