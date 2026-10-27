# Admin automatic list position hotfix

Production base: `a9388d6` (60-minute persistent admin sessions). Scope is admin
list rendering and read-only pagination only. No community/customer UI, checkout,
receipt, order mutation, inventory mutation, payroll or session policy changes.

## Cause

`payment-admin.js` emptied the list to a loading placeholder on each 45-second
poll, then assigned a new innerHTML tree. Review queue polls did the same every
3 seconds; workforce rendering also closed its preview before each poll. This
collapsed scroll height, recreated open details, and inserted new top rows above
the viewed record. Offset-only pagination also shifted page membership when new
records arrived. The stock counter overwrote a blurred but unsaved field on the
next server version. There was no literal full-document reload in these paths;
the destructive full-list replacement caused the apparent reload/jump.

## Fix

- Shared `admin-live-list.js` reconciles existing nodes by canonical IDs. Only
  changed attributes/text/children are patched, preserving row identity, details
  open state, focused/dirty controls (including blurred inputs), and scroll
  anchors in both the document and nested scrolling containers.
- The first visible record is anchored to its previous viewport offset. If it
  leaves the response, the nearest surviving neighbor is used and a short
  notice is shown. Network failure retains the existing list and editor.
- Main orders and Users APIs return an ID-anchored page window without resetting
  the requested page/search/filter. The already-loaded matching ID set is used
  for orders; only the 20 selected IDs are fetched. No new database function is
  needed. Automatic order reads preserve a selected duration even when it has
  no remaining matches. Financial calculation rules are unchanged.
- New rows before the anchor are withheld until the admin clicks a visible,
  keyboard-operable sticky “Yeni sifarişlər var” button. That explicit click
  opens the first page while keeping the applied query. Draft filter fields are
  not rewritten by automatic refresh.
- Admin workforce/review reads anchor within existing 50-row RPC pages. Adjacent
  pages handle ordinary changes; a read-only binary search over the existing
  `created_at DESC, id ASC` order handles a large burst. Existing role checks and
  mutation endpoints are unchanged. Failed/inconsistent lookup keeps the old UI
  rather than inventing a successful update. Employee-only permissions unchanged.
- Automatic workforce rendering no longer closes the open preview. Existing
  explicit close/visibility and sensitive-content expiry rules are retained.
- The catalogue editor has no automatic full catalogue reload; its automatically
  polled stock field now respects unsaved edits until explicit successful save or
  product selection. Other polled admin lists use the same keyed rendering.
- No new heartbeat or activity POST is sent by the list helper. All polling is
  still GET-only, so the 60-minute idle rule remains effective.

## Tests and evidence

- `test-admin-list-position.mjs --before`: fails as expected on lost open detail.
- `test-admin-list-position.mjs`: 109 assertions, 320/390/430/768/1024/1440 widths;
  open detail, unsaved input, external dialog, stock/status text, nested scroll,
  new-row notice, intentional navigation, removed record and nearest neighbor.
- `test-admin-orders-live-position.mjs`: 85 assertions using actual payment admin
  code/helper and the synthetic fixture: controlled 45-second auto poll, page 2,
  inserted orders, same row DOM identity and viewport offset, changed amount,
  search draft/open audit preservation, no page navigation, GET-only poll, explicit
  new-orders click and filtered-out record.
- `test-admin-workforce-window.mjs`: 12 assertions, including a 300-order burst,
  exact anchored window, removed record, read-only calls and sessionless401.
- Inventory browser: 20 assertions, including blurred unsaved stock and version
  conflict/double-click handling. User repository: 40 assertions. Existing Users
  production-server fixture: 114 assertions, 401/403, responsive and no new404.
- Existing payment orders browser suite passes with the new helper: tabs, filters,
  page navigation, financial displays, audit grouping, approval/rejection,
  expiring batch and cost editor. Admin boundary and employee/admin bridge pass.
- Session idle PostgreSQL: 24; activity clock: 14. Existing admin edge: 36.

One unrelated pre-existing assertion in `test-payment-system.mjs:251` expects
commercial snapshot `de63a4eb...` and fails. Reading the original `a9388d6:app.js`
and current file through the same commercial snapshot function produces the same
`da4bdebda1cf86e25c730104fefe0e11da86fc76e34edabc3245720868d55177` hash,
31 products / 22 active. The test and catalogue are not rewritten to hide this
existing mismatch; it is not reported as passing.

## Release

No migration or environment change. Commit/push only this scoped branch, then
verify Render and Cloudflare point at the same commit. Live checks are limited
to deployment metadata, asset byte matching, admin login/read/logout and guest
denial. No real order, reservation, receipt, stock or WhatsApp message is created.
All mutating UI scenarios use isolated synthetic fixtures, never production.
The community preview branch and production session fix remain intact.
