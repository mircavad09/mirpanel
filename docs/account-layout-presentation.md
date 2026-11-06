# Profile/order presentation — 2026-11-06

Scope: account layout, order-card rendering and read-only image/warranty DTO
enrichment. No order/payment/status/checkout/inventory/employee/Gmail writes or
migrations. The existing profile editor, uploads, tier calculation and receipt
authorization are retained.

Baseline fixture reproduced horizontal desktop tabs and order rows without
product-image structure. The account panel now uses a desktop identity/sidebar
plus content layout (1024 px and wider); narrower screens retain scrolling tabs.
Profile hero becomes one column inside the content area. Shared account styles
are awaited and marked persistent so route toggling cannot disable them.

Orders retain their parent ID and render stored item lines, unit/line/total
amounts, Baku date/time and status badges. Approved payments are not labelled
completed. Topups retain their own actual status/time. Warranty comes only from
stored order metadata/explicit purchased label; absent warranty is omitted.
Historical images use the stored snapshot first, then catalog by stable product
ID, and a neutral placeholder when absent. No credentials or stock messages are
projected into the customer order list.

Synthetic checks: 320/360/390/430/1440, single/multi-line orders, all primary
statuses, topup, long plan, missing image, empty account, receipt view, tab URL,
refresh/back-forward, no extra document loads and account isolation. Existing
API suite covers auth, paging, receipt ownership and no-store proxy. The older
owner-only standalone UI suite has an obsolete post-logout heading expectation
after the account-panel redirect; its API-only suite passes. Current integrated
UI coverage runs in test-account-panel.mjs.

No real customer order or financial operation is used for visual tests. Images
in payment-test-artifacts/account-panel are labelled synthetic fixture evidence.
