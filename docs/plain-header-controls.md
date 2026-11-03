# Plain header controls — 2026-11-03

Cart and balance now use existing live text and gold SVGs on neutral dark controls.
No uploaded header art, glow, animation, canvas alpha scanning or icon substitution remains.
The wallet hero and four bank backgrounds are unchanged.

Retired `header-cart` and `header-balance` are removed from admin fields, storage
metadata allowlist and public/admin image routes. Their two existing production
objects were removed through authenticated, CSRF-protected admin endpoints before
deploy; local recovery copies were kept outside Git. Other background version URLs
were compared before/after and remained identical. No migration is required.

Validation: header layout 282, mobile navigation 125, wallet consumers 80,
bank/admin image integration 301 checks passed (788 total). Synthetic local data
only; no orders, money, reservations, receipts or mail queue writes.

Live screenshots use actual deployed markup and assets; only the private identity,
display balance and local browser cart are synthetic, not production transactions.
