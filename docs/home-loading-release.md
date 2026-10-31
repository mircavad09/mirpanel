# Homepage loading stability — 2026-10-31

Scope: production homepage media scheduling/layout only. No schema, business data,
stock, checkout, auth policy, or preview bot changes.

## Cause and implementation

The product bundle executed before banner/story metadata requests. The initially
empty CMS banner array hid the panel; the first image decode then gated the entire
panel (up to eight seconds). Story markup was hidden until metadata arrived.
Consequently products rendered at a temporary, incorrect vertical position.

`home-loading.js` starts both public metadata reads in the head, independently of
the product bundle. It coalesces requests, keeps public session metadata for up to
120 seconds, revalidates on entry, and prioritizes only the first main banner and
the first four story covers. Existing banner refresh remains three seconds; story
metadata revalidates every 15 seconds while visible. Unchanged payloads do not
rebuild the stories. Unopened story videos and inactive banners are not primed.

`home-loading.css` reserves media/quick-link/product-list space before rendering
and the eventual account-control footprint without displaying guest account data.
Metadata is rendered without waiting for image decode. Errors do not gate products.
Existing banner focus, links, layouts, story viewer and product rendering remain.

## Actual isolated measurements

`node scripts/test-home-loading.mjs`: 53 checks, zero failures. Real homepage
scripts, synthetic API/media, identical controlled delays; one sample per case.
Warm means session-metadata reuse plus a warm-delay model, NOT a real HTTP-cache
benchmark (request interception disables browser HTTP caching).

| Width / model | Banner ms before → after | Products ms before → after | CLS before → after | Product movement px |
|---|---:|---:|---:|---:|
| 390 cold | 1550 → 800 | 884 → 768 | 1.0484 → .0572 | 388 → 0 |
| 390 warm | 623 → 231 | 254 → 210 | .6842 → .0572 | 388 → 0 |
| 390 slow | 3977 → 2089 | 1892 → 2004 | 1.0772 → .0572 | 388 → 0 |
| 1440 cold | 1660 → 1290 | 807 → 1113 | .8069 → .0029 | 564 → 0 |
| 1440 warm | 788 → 325 | 454 → 298 | 1.0876 → .0029 | 564 → 0 |
| 1440 slow | 4005 → 2481 | 1924 → 2032 | 1.0821 → .0029 | 564 → 0 |

Do not claim every product rendering time improved: some samples are slower.
The improvement is earlier media initiation and stable product placement.
Raw results/screenshots are ignored local artifacts in
`payment-test-artifacts/home-loading/`.

Other executed tests: `test-owner-release.mjs` 838, `test-owner-proxy.mjs` 11,
`test-inventory-upstream.mjs` 18. Total 920 checks, zero failures.
`check-home-loading-live.mjs before|after` observes only GET/HEAD requests, blocks
media streaming and writes, and records guest viewport screenshots/timings.
It does not create production orders, reservations, uploads or messages.

## Release

No migration. Pause frontend auto-deploy, push only these production-worktree
changes, deploy Render and confirm health/commit, restore/deploy Cloudflare,
confirm canonical commit and byte-match new public scripts. Observe live guest
homepage on mobile/desktop. Protected-preview files are not included.
