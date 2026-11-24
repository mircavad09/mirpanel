# Cart page presentation — 2026-11-24

Only `/sebet` becomes an inline cart. Drawers opened on product/home pages retain their modal behavior. The header shows item count and the server-quoted amount; its yellow button scrolls to `#mirpanel-order-summary` without navigating. Cart edit target is `#mirpanel-cart-edit`. The existing footer/checkout action remains under the parallel summary/payment task's control.

Integration contract: after the existing verified quote, the inline dialog stores `dialog.cartQuote={quote:q,items}` and dispatches bubbling `mirpanel:cart-quote` with the same detail. This avoids another pricing calculation/request and allows the summary module to mount even if loaded after the event. Stale responses remain protected by the existing generation check.

Cards show existing image/name/package, current quoted line price, only a higher valid former price, genuine savings, remove and stock-limited quantity controls. Explicit configured warranty shows duration and “təhvildən sonra”. Existing support computes warranty end from the actual delivered_at date; no cart has this future date, so no invented end date is displayed. Payment, stock authority, totals and success page are unchanged.

Chromium/WebKit 320/390/430/1440 presentation fixtures verify scroll/no navigation or popup, quantities and totals/savings, stock ceiling, missing discount/warranty, overflow, button color and quantity alignment. Fixtures are synthetic, not authenticated live purchases. Server savings test verifies actual quote metadata without orders.
