# Product detail release checks — 2026-10-10

Base: `2e606e3` (same as fetched `origin/main`). No production migration, initialization,
order/status mutation, reservation or media mutation was executed. No commit/push/deploy yet.
Supabase CLI/psql, database environment variables and local `.env` connection were unavailable.
The release is gated on the user's explicit migration-applied confirmation.

## Passed

- `scripts/test-product-detail-statistics.mjs`: actual migration applied twice in isolated
  PostgreSQL/PGlite; exact 10000, weighted canonical allocation, repeated initialization,
  simultaneous requests (serialized by the isolated engine), restart, invalid sum blocked,
  optimistic version conflict, audit actor/time/before/after, anonymous access denied,
  rollback leaves fixture orders intact. Production two-connection concurrency was not tested.
- Test allocation: capcut/spotify/netflix **1471 each**, adobecc **295**, other 18 active
  products **294 each**. Sum **10000**. These are test results, not production DB values.
- Corrected test-only real sales fixtures: 5 approved/completed, including NULL completed_at;
  site total 10005. CapCut 2, Spotify 1, Netflix 1, unknown ID legacy_unknown_product 1.
  Unknown ID is reported separately, included in the global total, never guessed by title.
  Reviewing/rejected/cancelled/expired excluded. Old partial index is corrected on rerun. New product
  baseline zero. Renamed product retains count by ID. No runtime random allocation.
- Shared plan calculations: 10.99 / 6 = 1.83 per month; old 91.50 gives savings 80.51,
  discount 88%; 26.99 / 6 = 4.50. Invalid prices/durations, warranty override, missing
  inventory, stock zero, best-value ties and metadata persistence validated.
- `scripts/test-product-sales-api.mjs`: unauthenticated read/edit/initialize 401; CORS
  preflight 204; missing DB returns honest 503; shared module served with JavaScript MIME.
- `scripts/test-product-detail-browser.mjs`: 8 products × 6 sizes = 48 detail checks.
  Prime, CapCut, Spotify, Netflix Personal, Google AI, Netflix Shared, unavailable YouTube,
  TikTok. Sizes 320×568, 390×844, 768×900, 1024×768, 1440×900, 1920×1080.
  Plan selection/summary/prices, one best-value marker, existing form isolation, mobile
  admin metadata and historical stats editor, invalid-total block and double-click guards.
  All tested horizontal overflow and console errors **0**. Fixtures only; external
  mutations, card selection, receipt upload and WhatsApp were not started.
- Existing homepage visual regression helper: identical to 7be646a/restored 2e606e3 at
  320/390/768/1440; 22 cards same order/prices/layout, hero unchanged, 2 Stories / 8 media
  same IDs, viewer opens/closes, overflow/console zero. Protected source diff zero.

## Not claimed as passed

- The older broad `scripts/test-product-pages.mjs` stops at its unrelated Haqqımızda H1
  assertion (splash H1 plus content H1). Info-page code was not changed to satisfy it.
- Production DB counts, initialization, multi-connection DB concurrency, deployment,
  production admin login, physical iPhone/Android and live changed detail UI remain untested.
- There is no existing plan-level inventory in the current catalog. The UI does not invent
  counts from product-wide stock; stock text remains hidden without a real plan source.

Visual artifacts are outside the repository in the `product-detail-20261010` visualization
directory. Test DB was in memory and closed; no production test data exists to delete.

## Task-owned changed files

- `product-page.js`, `product-page.css` (detail only).
- `mirpanel-admin/core.mjs`, `mirpanel-admin/product-pages.mjs`, `mirpanel-admin/server.mjs`.
- `mirpanel-admin/product-sales-repository.mjs`.
- `mirpanel-admin/public/admin.html`, `admin.js`, `admin.css`, `product-sales-admin.js`, `product-plan-utils.mjs`.
- 22 generated `mehsul/*.page` files: adobe-creative-cloud, amazon-prime-video, canva-premium,
  capcut-pro, captions-ai, chatgpt-plus-ortaq-hesab, chatgpt-plus, cloud-ai-pro, duolingo-super,
  google-ai-pro-ultra, google-ai-pro-v3, grok-ai, hbo-max, netflix-sexsi-yenilemek,
  netflix-sexsi, netflix-umumi, spotify-premium, surfshark-vpn, tiktok-jeton,
  youtube-eyni-hesab, youtube-premium, zoom-pro.
- `scripts/test-product-detail-statistics.mjs`, `test-product-detail-browser.mjs`, `test-product-sales-api.mjs`.
- `supabase/migrations/202610100001_product_sales.sql`, `supabase/rollback/202610100001_product_sales.sql`.
- `docs/product-sales-release.md`, this report.

Pre-existing dirty `scripts/test-header-product-media.mjs` and `scripts/test-splash.mjs` were not
edited or staged by this task. No homepage/Story/order/payment source files were changed.
