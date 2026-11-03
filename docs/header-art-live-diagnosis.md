# Live header follow-up: actual CSS and uploaded artwork

Production home and products were measured in the browser using unmodified
public HTML/CSS/JS and the actual uploaded images. Only private profile fields
were substituted with synthetic display data; no real account session or
business transaction was used. Findings, not a cache hypothesis:

- Both image slots contain byte-identical 1600x640 alpha images, SHA-256
  `4e86df873eda19a974fe0b7b63f90355bc9beaafab8ff4f73984cd431bf0d07e`.
  Both depict a cart, not a wallet. No uploaded file is altered by this fix.
- Live computed balance width was 168px although a lower-specificity selector
  requested 188px. The common `:is()` selector inherited ID specificity and won.
- Alpha>0 bounds included near-invisible edge noise (1587x623) instead of the
  visible frame (1568x485 at alpha>8). This unnecessarily shrank the picture.
- A higher-specificity badge display rule overrode `small:empty`, producing a
  yellow blank circle on an empty cart.
- Cart placement order differed between home/products due to dynamic mounting.

Fix: two 208x64 desktop buttons, 72px left icon reservation, 22px right padding,
15px sans-serif live text, 8px gap, zero second border. Bounds ignore alpha<=8
noise with four original-pixel safety padding. The image uses contain, not
distortion, and an uncropped overflow area preserves the frame/shadow. Cart
order is fixed with CSS. The explicit empty-badge rule wins. At 1000–1199px the
search column may shrink rather than overflow; mobile remains below 1000px.

When decoded pixels of both uploaded slots are identical (SHA-256 in browser),
the balance button retains the uploaded frame, masks only the embedded cart's
interior icon area with a feathered dark surface, and displays its existing
gold wallet SVG there. The old cart SVG stays hidden. This is a reversible
view-only fallback, not an asset/settings write. A distinct uploaded balance
image automatically removes this fallback and uses only that image's icon.
This avoids falsely claiming that the current uploaded asset contains a wallet.

Tests include actual shared header scripts, all previously requested widths,
empty/2/99+ cart, 0/125.50/10000 AZN, equal height, fallback/unique replacement,
standard-icon restoration, navigation and mobile/no-image behavior. Final live
screenshots are taken without local CSS/JS overrides after both deploys. Their
private account fields/count are synthetic and are explicitly reported as such.
No bank/wallet hero assets, payment/receipt business logic, database, balances,
inventory, mail, Gmail queue or real customer records are modified.
