# Central decorative assets

Admin: `/admin.html#decorations`, menu “Şəkillər və fonlar”. Seven fixed slots
are grouped as bank backgrounds (kapital, m10, abb, leo), wallet hero
(wallet-card), and header buttons (header-cart, header-balance). Every slot has
its own description, checkerboard preview, upload/replace and confirmed delete.
No reason is requested. Failed upload leaves the saved asset intact.

## One source, no migration

This extends `createBankBackgrounds` rather than creating another settings
system. All existing bank keys and `payment-bank-backgrounds/{key}.webp` paths
are unchanged. New slots use the same private media namespace. No existing
image is copied, rewritten, removed or seeded during release. The old bank API
is retained as an alias to the exact same objects for compatibility, not a
second set of settings. The old payment-methods upload UI is replaced with a
link to the central section.

`/api/admin/payment-backgrounds` exposes the metadata to authenticated admin;
mutations require the existing admin session, same-origin and CSRF checks.
The existing server employee boundary also protects the new payment-prefixed
routes. PNG/JPEG/WebP <=5 MiB pass the existing bounded isolated decoder and
re-encode to WebP, preserving alpha and stripping metadata. Invalid/active/
oversized/animated/excessive-pixel media remain blocked. Stored output <=2 MiB.

`/api/payments/backgrounds` exposes only public decoration URL metadata, rate
limited and sharing the existing 30-second backend metadata cache. Dedicated
image reads expose only whitelisted decorative keys, not arbitrary Storage
paths. These contain no balances, order data, receipts or credentials. The
public proxy never forwards admin credentials, and omits account cookies on
decorative image reads. Images have versioned URLs and shared image caching;
private/payment responses retain no-store.

## Rendering and cache updates

The existing header loader adds `decorative-backgrounds.js` once. It applies
custom media to wallet hero, header cart and desktop balance without replacing
links, listeners, real text or cart count. Custom button media suppresses only
the old SVG icon. It never changes prices, balances, checkout or payment rules.
The consumer handles dynamic DOM mounts and account changes without refetching
on every mutation. There is no periodic polling. Metadata refreshes on page
entry/visibility (30-second minimum) or an admin update event across same-origin
tabs. Failed media returns to the standard view without a retry loop.

Replacement changes the version URL; deletion clears the slot and restores
the existing default (including the bundled wallet hero background). New
metadata uses no-store; new static scripts/styles use revalidation. Server
metadata/image caches are invalidated on successful mutation. Bank rendering
and bank-wide current/future-card association remain unchanged.

## Isolated verification

- `test-bank-backgrounds.mjs`: 327 checks, zero final failures; all seven slots,
  auth/CSRF and unauthorized roles, bounded image safety, alpha, replace/remove,
  cancel confirmation, persistence/reload, existing/future bank cards, actual
  Cloudflare handler + payment HTTP + decoder and filesystem Storage adapter.
- `test-decoration-consumers.mjs`: 80 checks, zero failures; 320/360/390/430/1440px,
  live balance/cart count, old icon suppression, unchanged link, version change,
  removal/default, failed image fallback, no duplicate nodes or polling.
- `test-receipt-iphone.mjs`: 59 checks, zero failures; MPF normalization and
  storage/retry/security retained, OCR calls zero.
- `check-receipt-runtime.mjs`: 15 checks, zero failures locally; also runs in
  Render's build against its actual Linux native runtime.

Production verification is read-only except the isolated verification admin
session login/logout. The four original bank metadata versions are snapshotted
before release and compared afterwards. No production test background, order,
reservation, receipt, top-up, mail or balance operation is created.
