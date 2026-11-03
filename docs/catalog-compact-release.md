# Compact catalog and shared plan presentation

The old dynamic plan renderer repeated `plan.label` in the price cell when the
price was zero. That max-content cell squeezed the real label column. Both the
dynamic renderer and static/no-JS generator now show each label once. Plan rows
use a fixed radio column, flexible wrapping name, optional right-aligned price,
and a separate inventory status row. Stock decisions and selection guards are
unchanged.

`catalog-card.js` is the shared server/browser markup renderer for home and listing.
`catalog-card.css` defines the two-line title slot, compact price/sales rows, 44px
action, original 16:9 media, and two mobile columns. Listing sales use the existing
product-sales endpoint, at most four concurrent reads, without polling or invented
zero counts. Existing pricing callers still supply the price. No data migration.

Validation:
- 540 focused browser assertions at 320/360/390/430/1024/1440, including old-code
  duplicate reproduction, fixed output, blocked unavailable plans, aligned rows,
  no overflow, unchanged catalog and zero production writes.
- 306 inventory/catalog regression assertions passed (all active products,
  unavailable-plan guards and automatic first-available selection).
- Home-card regression passed five viewport cases, price/discount variants,
  search/sort, sales, URLs and protected non-catalog markup. Test serialization
  now sorts attributes so asynchronous listener binding order is not a false diff.
- Two additional legacy suites were attempted but not counted as passing:
  product-pages expects a single document H1 although the existing hidden splash
  adds another; product-order-isolation supplies an empty inventory fixture and
  consequently times out clicking the correctly disabled order button. Neither
  failure was bypassed by weakening application behavior.

No checkout, reservation, stock, cart, wallet, account, order or mail-queue business
logic changed. Generated page changes are limited to listing and zero-price plan
presentation; catalog data in app.js is untouched.
