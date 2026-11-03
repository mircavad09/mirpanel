# Desktop-only decorative header buttons

Scope: header cart/balance rendering and their admin descriptions only.
Existing bank backgrounds and wallet hero are not changed. No migration.

Below 1000px the extra header cart is hidden; header background images are not
mounted and are removed on resize. The existing bottom navigation, cart count,
links, safe-area and checkout hide behavior remain intact. No cart capacity,
balance or checkout rule changes.

At >=1000px custom button images use their original pixels. A small client-side
alpha-bound scan (bounded by the existing uploaded image limits) measures only
fully transparent margins. It sizes/positions the original img to those bounds
without creating, changing or uploading any image asset. CSS contain prevents
distortion. The actual uploaded pair was read-only inspected: both are
1600x640 alpha images with large transparent top/bottom margins. Both currently
contain the same shopping-cart artwork; the UI does not substitute a wallet
image or change those admin choices.

Custom buttons reserve left icon space, hide only their default SVG, use
sans-serif live text and a yellow circular count badge, and remove the second
CSS border/gradient. The header badge hides at zero and caps its visual label
at 99+ (accessible label retains the actual number). Removing the custom
background restores the standard icon. No numeric limit or stored quantity was
changed. The bottom cart keeps its existing calculation and rendering.

Admin descriptions for header-cart and header-balance explicitly state:
“Yalnız kompüter görünüşündə istifadə olunur”. Original API/storage keys and
upload/delete behavior are unchanged. CSS/JS asset URLs and revalidation avoid
retaining the old header styles.

Isolated verification:
- test-header-background-layout.mjs: 237 checks, 0 failures. Actual shared header,
  account, desktop, bottom nav, cart store and background scripts; synthetic
  account/API, 320/360/390/430/768/1024/1440/1920 widths, counts 0/2/100 (99+),
  balances 0/125.50/10000 AZN, home/products navigation, signed/guest, resize,
  no horizontal overflow, image and standard-icon restoration.
- test-decoration-consumers.mjs: 80 checks, 0 failures; wallet remains mobile,
  header art desktop-only, replacement/removal/failure, unchanged live data.
- test-mobile-bottom-nav.mjs: 125 checks, 0 failures; bottom navigation, badge,
  safe area and checkout hide behavior retained.

Only decorative public assets are downloaded for isolated visual tests. No
production test account, cart transaction, order, reservation, receipt, balance
operation or Gmail queue access is performed.
