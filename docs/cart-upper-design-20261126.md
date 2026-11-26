# Upper-cart design refinement

Scope: the cart title, scroll-to-payment button and editable product cards on
`/sebet` and the existing `/odenis` upper-cart component. No order summary,
payment options, totals/stock algorithms or financial endpoints are changed.

- Separate bold cart title and lighter count; gold gradient CTA with SVG down
  arrow in a dark circle, retaining scroll-only behavior.
- Larger scoped rounded-system typography (including Azerbaijani glyphs),
  two-line product names and larger gold prices/green savings.
- Larger rectangular, centered cover-fit artwork with no added dark padding.
  The existing CapCut source was inspected: it is a wide image without external
  black padding. The old square contain-fit presentation caused letterboxing.
  Original product images and other catalog placements are unchanged.
- Dark separated lower row, delete control and compact black quantity capsule.
  Real quote reference prices, warranty and savings are retained unchanged.
- The existing fixed notice layer and bounded loading indicator are untouched.

Verification uses Chrome/WebKit at 320, 390, 430 and 1440 CSS pixels: one/multiple
products, long names, large prices, absent discounts/warranty, quantity limits,
remove, scroll-only CTA, reduced motion and unchanged lower-section styles.
Only local fixtures or anonymous read-only quote requests are used. No actual
orders, payments, balance changes or deliveries are created.

Live screenshot verification includes 368 CSS pixels, matching the supplied
reference image width; no page zoom or transforms are used to scale the design.
