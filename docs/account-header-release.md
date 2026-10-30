# Signed-in account header — 2026-10-30

Uses the existing shared browser navigation's authenticated state request. No new
auth API, notification source, database table, balance system or payment system.
Only verified signed-in profiles get the account controls. Transient state network
errors do not masquerade as sign-out. Personal strings use textContent; media URL
is restricted to existing private profile-media paths. No identity in URL/storage.

account-header.js/css provides bell, circular avatar and disclosure, private
identity row, seven requested menu entries, disabled Tezliklə balance/payments,
existing profile/orders/group links, the existing WhatsApp operator destination,
and server-confirmed sign-out. Notification panel is explicitly empty (no fake
badge/count). Outside click, Escape, link selection and page scroll close panels.
Sign-out failure retains session UI, displays retryable error; timeout is 20s.
Success refreshes shared auth navigation and returns home, without a profile link.

All account buttons >=44px at six tested widths. The existing mobile search
flexes between the menu control and non-shrinking account controls. Community
pages use the same widget in their own compact header. Guest header is unchanged.
Popover is portaled to body, bounded to viewport and independently scrollable.
Shared script/loader versions refreshed in middleware, site-header and owner-nav.
Profile media upload success refreshes shared account state, without changing the
upload/edit logic or existing image storage. No bottom-nav style/route changes.

Tests: owner release suite 708 assertions, proxy 11, inventory regression 18;
737 passing, zero final failures. Guest/signed-in, every customer route, same
avatar/control geometry, six widths, disabled links, empty notifications,
outside/Escape/selection close, real isolated-session sign-out plus simulated503
failure and hidden profile link checked. Existing profile/edit/upload and nav
regressions included. Screenshots contain synthetic test users/images only.
Earlier harness failures (hidden desktop bottom nav, prior test already signed
out, outside click target under dropdown) were corrected, not product bypasses.

No production test account/order/receipt/reservation/stock/bonus/WhatsApp action.
No migration required. Owner-only Google policy and closed signup/group retained.
Production validation is source-version equality, backend deploy health and
read-only guest/registration restrictions, not an authenticated live mutation test.
