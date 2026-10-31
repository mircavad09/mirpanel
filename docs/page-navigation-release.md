# Page navigation / intro release — 2026-10-31

## Cause and boundaries

Previous splash.js deliberately played the ~3s logo sequence on every document
load, including product navigation/reload. The current asset is a CSS logo intro,
not an actual video file; it is retained, not replaced with a new video. Optional
video ended/error/play-rejection fail-open hooks are supported. Profile/group had
a separate small header and group reads unnecessarily refreshed the entire state.

The site remains a multi-document application. No unsafe generic SPA/HTML swap,
checkout interception or wholesale rewrite. Necessary cross-document navigations
remain native, with browser history/direct links/reload. Same-URL no-op links no
longer reload; default internal target=_blank links go to the same tab (explicit
modifier/middle-click choices are respected). No synthetic navigation delays.

## Changes

- Intro marked before playback in sessionStorage plus a non-auth session cookie
  (no expiry, SameSite=Lax, Secure on HTTPS), shared across same-site tabs. No
  replay after reload, product navigation, back/forward or leaving mid-intro.
  Watchdog/failure paths reveal the site; no loader depends on API completion.
- Shared customer-header.html copied from the current production header is used
  by both authenticated profile/group pages. Existing shared header CSS/search,
  desktop layout, account controls, mobile bottom nav and menu behavior retained.
- Group fixed viewport flex layout accommodates the full site header; only the
  message list scrolls, composer remains visible at short viewport heights.
- session-state.js coalesces concurrent header/community reads. Private data stays
  only in the current document memory (<750ms cache), never persistent storage.
  Explicit profile/account refresh invalidates it; pagehide aborts/clears it.
- Group read acknowledgements no longer fetch full account state. Group request
  controllers abort and poll interval/viewport listeners stop on pagehide. A
  persisted pageshow restores exactly one timer/listener set.
- Unsaved profile form edits register a native beforeunload guard. Dismissing it
  keeps fields; save/cancel removes it. No password/token/PII draft storage.
- Header active links are recalculated from URL instead of retaining the copied
  homepage active attribute. Loader versions refreshed, including splash.js on
  dynamically served public HTML.

## Changed files (repository root)

browser-nav.js; page-navigation.js; session-state.js; customer-header.html;
site-header.js; site-header.css; splash.js; functions/_middleware.js;
mirpanel-admin/community/service.mjs;
mirpanel-admin/community/public/community.js;
mirpanel-admin/community/public/profile.js;
mirpanel-admin/community/public/chat-layout.css;
mirpanel-admin/community/public/owner-nav.js;
scripts/test-owner-release.mjs; scripts/test-account-header.mjs;
scripts/test-navigation-lifecycle.mjs; scripts/test-page-navigation.mjs;
scripts/test-splash.mjs; scripts/test-navigation-edge.mjs; docs/page-navigation-release.md.

## Measured results

test-page-navigation.mjs uses isolated local documents, no production API/media.
Reference splash from commit6449995 versus new splash, same Chromium host.
12 subsequent navigation samples per viewport, across home/products/detail/
profile/orders/group. These measure intro/document overhead, NOT live internet
latency or a production SLA. Do not add synthetic delays to reproduce a result.

| Viewport | Before median/p95 | After median/p95 |
|---|---|---|
|390px|1512.5/2983ms|47.5/58ms|
|1440px|1504.5/2990ms|46.5/68ms|

First entry remains about3s: before3018/2975ms, after2982/2993ms (390/1440).
20 assertions passed, including same-session tab, reload/history, interrupted
intro, storage restriction, optional video failure, same-tab/default links.

Owner synthetic PostgreSQL/browser suite additionally checks one initial state
request, polling pause/resume, leaving with a deliberately3s pending request in
under1.5s, dirty-form cancellation, shared header/composer and short viewports.
Exact pending-request leave timing is saved privately in ignored
payment-test-artifacts/navigation/lifecycle.json. Profile/media, identity,
permissions, logout and stock regression tests retained.
Final executed counts: owner suite838 + navigation20 + proxy11 + inventory18 =
887, zero final failures. Additional edge-version regression:12 assertions passed. Latest pending-request leave measured235ms. Additional
short viewports320x480/390x480 and desktop1440x900 keep composer visible, message
area nonzero and horizontal overflow zero. An initial duplicate-state assertion
found the read-ack full-state refresh; that redundant request was fixed, not the
assertion weakened. Runtime/test-service interruptions required reruns; only the
completed final outputs above are counted.

Legacy test-splash.mjs replay expectations are updated to the new policy; its
entire older homepage/design test body is not claimed executed (it includes
unrelated, obsolete game/ticker assertions). New targeted intro tests above were
actually executed. No claim that every test in the whole repository was run.

No database migration, OAuth/environment change or production business write.
No production test order/reservation/receipt/stock/bonus/WhatsApp. Owner-only auth,
closed signup/group, checkout/upload, inventory and order rules unchanged.
