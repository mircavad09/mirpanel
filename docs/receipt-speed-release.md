# Receipt presence: measured speed release (2026-10-25)

No SQL or migration. No payment-data comparisons, new manual-review state, changed payment approval, stock, WhatsApp, or employee transitions. Existing unrelated local edits remain outside this commit.

## Changes

- Old path started a Node process and loaded eng+aze for each document, computed unused QR/dHash/recompression/residual features, and OCRed text-layer PDFs again.
- New secret-free persistent child prewarms both language models during payment-system startup. One document runs at a time, at most four accepted jobs including the active job; overload returns retryable 503. No paid service or hosting plan change.
- Presence-only image path retains signature/MIME/size, safe decode, 20MP/10k-side, rotation, PDF page/operator/image/active-content checks. Analysis raster bounded at 1400x2200. No QR, similarity or fraud calculations in this narrow policy.
- PDFs still pass full structural/security validation and safe rendering. If their extracted text satisfies the SAME presence policy, only redundant OCR is skipped; scanned/uncertain PDFs still OCR.
- Identical validated bytes+MIME coalesce concurrent recognition. Up to 32 successful **boolean** results live in memory for 90 seconds (no OCR text, no cross-order duplicate restriction, no payment approval). Reservation binding, immutable private upload and server storage confirmation still run on every request.
- OCR child has no payment/database secrets, 192MB V8 limit, one OCR thread, 15s startup deadline, 25s queued-job deadline. Timeout/interruption kills the child, fails with 503 and allows a clean restart; no unchecked acceptance. Native/WASM memory is not covered by the V8 limit; this is not a separate container/cgroup isolation claim.
- UI immediately says `Çek yoxlanılır…`; after four seconds says `Yoxlama davam edir, zəhmət olmasa gözləyin`. It never advances on a timer. Existing 120s per-attempt network timeout, three automatic retries, cancellation and manual retry remain. Timers are cleared on success/error/cancel.
- Live visual follow-up found the old header message remained pending after a rejected upload. The catch path now sets the header to the same error, with six additional viewport assertions (presence suite: 114 checks). Final asset query: `receipt-speed-20261025-4`.
- Numeric `Server-Timing` receive/binding/recognition/storage phases contain no customer information. Health adds `runtime:warm-pool-v1` and actual OCR `warm` readiness.
- Checkout asset query updated in generator, index and 22 product pages only; their layout/content unchanged.

## Reproducible measurements

`node scripts/bench-receipt-speed.mjs before|after` measures local process/processing/model setup/OCR. Saved baseline was taken before changing the engine: 15 samples, median 1256ms, p95 2215ms. After: median 213ms, p95 1017ms (includes first cold child). Raw data in ignored `payment-test-artifacts/receipt-speed/{before,after}.json`.

`node scripts/bench-receipt-browser-speed.mjs before|after` uses synthetic JPEG/PNG/PDF/random/chat files, browser selection to visible result/order callback, two runs per type/network, 20 samples per version. Each input has distinct safe metadata so positive cache does NOT contaminate this comparison. `before` explicitly invokes the retained per-file `job.mjs` full-analysis path. Both versions use the same current upload/order fixture and browser. No external DB/storage/network latency is simulated beyond the stated mobile browser limits.

| Local isolated API + real browser | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Normal localhost (10 samples) | 1243 / 1995 ms | 394 / 546 ms |
| Mobile: 100ms latency, 750kbit/s upload, 1.5Mbit/s download (10) | 1958 / 2209 ms | 621 / 1303 ms |

Files ~25–54KB images and ~1KB text PDF. Small samples of synthetic receipts are not a production population p95. Actual stage values are included in each browser row. Mobile receive phase for 53–54KB images ~590–603ms. Local storage is an in-memory private-store fixture: its timings MUST NOT be presented as real Supabase performance.

Dedicated speed regression: cold local child 0.9–1.5s, warm 0.30–0.33s in repeated runs; three distinct parallel browser uploads finish in 0.54–1.27s each; fifth simultaneous queued request returns 503. Forced child interruption fails safely and next request recovers. A delayed local storage response gives ~5.67s with NO success/order at four seconds. 498730-byte JPEG over 256kbit/s upload, 150ms latency takes ~16.32s; disabled continue + waiting message remains until verified result. Details in `receipt-speed/tests.json` (30 checks).

## First request / idle limits

Before release three read-only production health requests measured 3388 / 1201 / 899ms. This includes transport and health dependencies: it is NOT a proven spun-down Render wake-up measurement and NOT upload end-to-end performance. No production receipt POST is allowed for these tests.

A later GET-only pass after local work returned 810 / 716 / 805ms (HTTP200). It was already awake; this does not certify the platform's spun-down start. Read-only probe script: `scripts/bench-receipt-live-read.mjs`.

Render API confirms plan `free`. Official https://render.com/docs/free says an idle free web service spins down after 15 minutes and can take about a minute to spin back up. Local OCR cold startup is tested separately from platform wake-up. No keepalive traffic/automation or paid-plan change is introduced. A guaranteed 3–4s platform cold start is not possible under these constraints. Actual fully idle production wake-up is not certified; ordinary customer traffic prevents proving idle from a single health response. Do not mark it passed based on a warm GET.

The 3–4s target is met in the stated small-file normal/mobile **isolated** measurements, including first local OCR request. It is NOT guaranteed for Render spin-up, slower real CPU/database/storage/network, large uploads, or long queues. Real production upload/creation was deliberately not tested. Live verification uses GET assets/health and live UI with every payment mutation redirected to a local fixture; no production orders/reservations/receipts/messages.

## Release and rollback

Run `node scripts/test-receipt-release.mjs` (12 packages, includes real local PostgreSQL regressions). Inspect related diff, commit, push main, await Render then Cloudflare matching SHA. Verify backend health `receiptCheck:presence-v1`, `runtime:warm-pool-v1`, `warm:true`, and matching checkout JS bytes at the new query version. No keys rotate, SQL runs, data repair or employee accounts are created. Revert this code commit to restore the former OCR path if runtime fails; schema remains compatible.
