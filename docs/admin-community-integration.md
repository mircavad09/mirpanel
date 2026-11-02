# Main admin community integration — 2026-11-02

The previous directory queried Supabase Auth. Actual public registration uses
Better Auth in `mirpanel_community`. The main-panel directory and legacy API
alias now read that canonical PostgreSQL source. No accounts are imported,
created, reset or relinked. No migration is needed.

Users and group are main `/admin.html` workspaces. The legacy `/admin/users`
route redirects to the embedded workspace. Directory data is projected through
an explicit allowlist, with display member number, verified-email account state,
separate presence, bans/mutes, profile contacts, tier and linked orders (latest
50). No session/password/OAuth data is returned. Private responses are no-store.

All new APIs require the existing admin session and reject employee sessions.
Mutations additionally require existing same-origin/CSRF validation. No customer
session is created or assumed. Actor identity is resolved server-side from the
existing `owner_identity`, matching verified email, Google account subject and
protected owner role via `isOwner`. Request-supplied identities are never used.
Existing repository/group-control methods apply all bot, ban, idempotency and
audit rules. Same group tables and LISTEN/NOTIFY streams are used. Admin stream
session checks do not renew idle expiry. Message hiding retains audit/database
records and publishes immediate removal; no hard deletion was added.

## Verification

- `test-admin-community.mjs`: 49 checks, zero failures, real production server,
  isolated PostgreSQL with synthetic owner/25 directory accounts and one order.
  Tests auth/employee/CSRF boundaries, search/page/details, private field exclusion,
  owner-authored sending/retry, actual SSE delivery/removal, ban/unban/mutes,
  group settings, owner self-ban/role protection and mismatched Google subject.
  Browser tests at 390 and 1440 px run both workspaces inside admin.html, including
  clicking details, sending and checking group controls. Zero application JS errors.
- Stream proxy: 8 checks, zero failures.
- Read-only production preflight: existing owner binding valid, 2 community
  accounts, detail projection valid. No production mutations or test messages.
- Initial synthetic test caught references to absent ban/mute reason columns;
  those were removed, not added via an unnecessary migration. Owner-role update
  test correctly hit the pre-existing protection trigger and now asserts denial.

Notification monitor was deleted at user request. Sender/queue were untouched.
Checkout, inventory, payments, Gmail and account records are outside this change.
