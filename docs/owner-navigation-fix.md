# Post-login/profile and consistent navigation hotfix

Production mirpanel.com only. No preview branch changes, database migration,
auth permission/cookie/TTL/owner-role changes or registration activation.

Causes:
- Server forced Google's post-login destination to /qrup, not /profil.
- Public and owner pages built different menus. Public menu did not read the
  authenticated state, so missing Profile looked like session loss even though
  the same secure cookie remained valid. Owner menu used small text glyphs rather
  than the shared 24px SVG icons.
- Avatar alignment included the ellipsis menu height under the bubble, moving
  the avatar lower than its message.

Fixes:
- Server and login button post-login callback target /profil. OAuth redirect URI
  at Google is unchanged; owner email/subject allowlist remains enforced.
- One browser-nav.js and browser-nav.css on all five routes; authenticated state
  read with credentials/no-store on load, pageshow and foreground. Profile is
  server-derived, never inferred from a local email flag. Temporary 5xx/network
  failures do not draw a false logout. Explicit 401/403 removes Profile.
- Shared 11px label / 24px icon / >=56px touch-height menu through 850px; 5 columns
  for authenticated owner, 4 for guest. Scoped CSS separates chat typography from
  menu geometry. Chat keeps its non-scrolling full viewport and keyboard handling.
- Grid rows place avatar beside the bubble, name above and ellipsis below.
  Own/right and other/left still use canonical account IDs. PNG art unchanged.
- Asset version updates avoid stale JS/CSS without random cache-bypass URLs.

Verification (isolated PostgreSQL + signed synthetic owner session, real Chromium):
test-owner-release.mjs incl. test-owner-navigation-ui.mjs: 388 checks.
test-owner-proxy.mjs: 11 checks. test-browser-orders-proxy.mjs: 22 checks.
test-checkout-cancel.mjs: 180 checks. Total 601, no final failures.
Navigation test uses the actual community/profile backend and shared menu with
minimal public route shells, not a production customer session. 320/360/390/430/
768/1024/1440; reload, sign-out, temporary state errors, checkout menu hiding,
long messages/links, both avatar sides, functional ellipsis, no JS errors/404.
Old version's avatar regression reproduced and captured before the fix.
Screenshots payment-test-artifacts/owner-navigation/before-mobile.png and
after-mobile.png are synthetic accounts only. No production messages are created.
Real Google consent flow cannot be impersonated and is not claimed as completed
by this regression test; post-login target is configured server-side.
