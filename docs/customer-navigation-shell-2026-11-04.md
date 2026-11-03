# Customer navigation and fixed support controls

## Proven causes

* `page-navigation.js` previously only suppressed same-URL clicks; ordinary
  customer anchors still performed native document navigation. Every document
  bootstrapped the header, session readers, navigation and support widget again.
* The wallet stylesheet explicitly overrode support buttons with
  `position:static!important` and put their host into normal document flow.
  Consequently they followed the short loading message rather than the viewport.
* Shared header styles could be overridden by subsequently loaded catalogue
  styles. The isolated geometry assertion detected a one-pixel header change;
  route styles now precede the persistent shared styles.

## Implementation / boundaries

Progressively enhance a fixed allowlist of existing customer routes. Preserve
the actual header, account controls, bottom navigation and support DOM. Update
only the route content and active attributes with pushState/popstate. Native
direct links, manual reload, modifier clicks, downloads and external/new-tab
links retain browser behavior. Other routes retain their existing native loader.

Reuse only the home/catalogue DOM (including its existing filter controls), and
verified empty public HTML shells for the shop/community controllers. Never
cache rendered wallet, order or profile content, or API responses containing
balances/payment statuses. Those controllers revalidate through the existing
authenticated endpoints. Static scripts are loaded once from an explicit
same-origin allowlist. No framework, auth policy, SQL or payment API change.

Each private page mount has a disposer: cancel page requests, timers, viewport
listeners and the group's SSE/reconnect handler. Generation checks and aborts
prevent an old route from replacing a newer selection. Finite waits and retry
cards replace blank/permanent loading states. Existing session reads are shared,
not treated as sign-out on transient network failure. Header/nav links no longer
rebuild merely because the route changes.

Unsaved profile edits and active uploads prevent silent navigation loss. The
user must save/cancel the editor, or finish/cancel the existing payment flow.
No new cancellation, stock-release, payment or WhatsApp behavior is introduced.
Selected files and the server-issued receipt proof remain intact when navigation
is blocked. Account login preserves its validated return destination.

Support buttons remain fixed above the safe-area-aware mobile navigation, even
while content is loading. Bottom content clearance accounts for both rows.
Payment/receipt dialogs hide the controls; the existing group composer layout
continues hiding them on the full-screen chat route.

## Verification

`test-customer-shell.mjs`: isolated existing HTML/CSS/JS with synthetic account
and read-only fixture data, Chrome and WebKit, mobile/desktop. Covers seven menu
destinations, single document identity/navigation entry, persistent header/nav
nodes and geometry, cart counts/session visibility, fresh wallet reads, retry,
rapid navigation, history, catalogue filter/scroll, profile dirty guard, SSE
closure and login return/sign-out. Widths 320/360/390/430/768/1024/1440.

`test-shell-checkout-guard.mjs`: actual receipt API/worker with isolated in-memory
storage; 12 assertions, delayed upload and saved proof survive a blocked route
exit, no order is created. Existing support FAQ suite: 956 assertions, 18 pages,
zero final failures, no AI/API financial writes.

Local before/after timings are saved separately from the guest live-internet
benchmark. The live benchmark performs only page/data reads and records actual
top-frame document requests. No production test account, order, reserve, receipt,
balance adjustment, WhatsApp message or Gmail operation is created. A browser
engine with a mobile viewport is not a physical-device/network guarantee.

No migration or production configuration change is required.
