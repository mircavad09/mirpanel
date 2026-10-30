# Desktop header only — 2026-10-31

New desktop-header.js/css is loaded by shared browser navigation. At >=1000px it
keeps the original brand/image, moves the same bound search form into the middle
grid column (no new search logic), and uses account tools as the right column.
The existing main navigation is reordered into six left links and operator,
orders, authenticated profile on the right. Existing mobile drawer is untouched.
Profile label and search placeholder restore on leaving the desktop breakpoint;
brand uppercase/size/colors/layout changes are CSS desktop-only. Existing home
announcement within the header is hidden only in this desktop layout.

Only authenticated existing account controls get a disabled balance preview and
cart. There is no real balance API in the existing state; 0.00 ₼ is explicitly
marked Tezliklə, tooltip/accessible label explain appearance-only, no money
transaction or click handler. Cart is likewise disabled Tezliklə. Existing
notification/account dropdown/logout logic remains unmodified. Operator uses the
same support destination. No signup/group permission changes or new backend API.

Below1000px the form returns to its existing parent, original placeholder and
profile label restore, added operator link is removed, and desktop-only elements
are hidden. No mobile menu styles are overridden. No timers or network polling.

Tests use only isolated synthetic identities/orders/media. Owner release suite
816 assertions including desktop1024/1280/1440/1920, one navigation line, >=200px
search, no horizontal overflow, disabled balance/cart and existing menu/logout.
At320/390/430/768, browser geometry/font/display snapshots for header, brand,
tools/search/account controls and bottom nav are identical with desktop module
enabled versus disabled. Existing profile/upload/security/navigation regressions
included. Proxy11 + inventory18 also pass. No migration or production data writes.

Release refreshes only header/shared-loader asset versions in middleware and owner
HTML. Community development remains separate. Checkout/stock/orders/profile data,
public registration and owner-only Google configuration are unchanged.
