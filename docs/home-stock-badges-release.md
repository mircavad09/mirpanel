# Homepage stock badges

Base `b5353a2`, branch `fix/home-stock-badges`. No community changes included.
Only homepage presentation and the affected index asset cache versions change.
No API, schema, stock, checkout, reservation or unlimited-policy changes.

Badges use the existing server inventory snapshot, which counts AVAILABLE units
after reservations. Product-managed stock uses that product pool. Plan-managed
stock uses the same starting-price plan the home card already represents; plan
quantities are never summed or borrowed from another plan. Other available plans
continue to be reachable through the existing product-detail selection logic.

- 0 -> Stokda yoxdur; existing order blocking remains.
- 1–9 -> Son N ədəd, compact warm yellow/orange badge below price/sales.
- 10+ -> Stok: N, compact warm capsule.
- Explicit unlimited/untracked -> no badge.
- Not loaded, missing plan/count, setup required or failed read -> no badge;
  existing fail-closed order safety is unchanged, not relabelled as actual zero.

Actual isolated tests: home-stock-badges 74, inventory-browser 40,
inventory-catalog-browser 309, inventory-api 58, inventory-availability 87,
inventory-nullable-postgres 39. Total 607; failures 0. Covers 0/1/9/10/unlimited,
initial load, network error/recovery, mixed plan pools and server/SQL regressions.
22 active products; 320/390/430/768/1024/1440 px. No badge overlap with price,
sales or order control; overflow, application errors and new 404s zero.
Production stock is never changed for verification. No migration needed.

Live screenshot comparison caught a second writer: the i18n mutation observer
parsed the new “Son 1 ədəd” as an unknown numeric label, eventually normalizing it
to “Stok: 1”. The strengthened browser regression explicitly runs locale refresh
and waits for the observer; it failed before the fix (actual Stok: 1, expected
Son 1 ədəd). The locale normalizer now leaves only homepage inventory-owned badge
text alone. All other translation, detail and checkout labels remain unchanged.
