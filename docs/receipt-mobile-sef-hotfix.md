# Mobile receipt file-safety hotfix (2026-10-27)

Baseline: production `3d3ee6c72ea772dd61e520afb3444ddd7a7b7173`.
No community/admin preview code is included.

## Observed failure, not an OCR theory

Sanitized Render application logs show `stage=file_safety`, HTTP 422,
`code=RECEIPT_UNSAFE`, `diagnostic=file_safety:RECEIPT_POLYGLOT`, including
2026-10-27 14:08–14:10 UTC (18:08–18:10 Baku). That rejection occurs before
Storage. These entries do not identify a customer's filename or expose bytes;
they cannot alone establish the internal format of the reported ABB file.

The reported original `Screenshot_20261027_181020_ABB Mobile.jpg` was not
provided. No customer receipt was downloaded or used as a test fixture.

The existing boundary parser accepted only whitespace after JPEG EOI / PNG
IEND. Real Samsung SEF metadata has a structured directory after that boundary.
A synthetic JPEG with a valid SEF timestamp container reproduces precisely the
same `RECEIPT_POLYGLOT` / Azerbaijani error under the unmodified baseline.
`test-receipt-mobile-format.mjs` was run before changing the implementation:
its first acceptance assertion failed with that exact error. It passes after.
This proves the SEF compatibility bug, not the unprovided original's contents.

Format reference: the maintained [ExifTool Samsung trailer parser](https://github.com/exiftool/exiftool/blob/master/lib/Image/ExifTool/Samsung.pm).

## Narrow normalization and safety

- Parse SEFH/SEFT length, version, entry count, record offsets, block headers,
  name bounds, contiguity and non-overlap. Trailer maximum 256 KiB; 128 entries.
- Only a valid indexed SEF container is removed. Unknown appended data, forged
  marker strings/offsets, ZIP/HTML suffixes and invalid images still fail closed.
- Decode the bounded underlying image using the pinned Sharp runtime. Preserve
  its original JPEG/PNG pixels and encoding: no lossy re-encoding is needed.
- Worker returns only a validated canonical byte length, not image text/data.
  Parent trims, recomputes SHA-256, and stores/tokenizes/links the resulting
  bytes consistently. The recognized metadata is never stored or served.
- Retain 5 MiB, 20 MP, 10000-pixel-side, two-worker, 192 MiB JS heap and timeout
  limits plus the existing malicious-PDF checks. No OCR/classifier is loaded.
- Worker spawn/exit/protocol/timeout/resource failures are retryable HTTP 503
  service errors, not a damaged-file verdict. No file is accepted on failure.
- Existing receipt token format remains compatible. No database migration.
- Render build now runs memory-only native decoder/PDF/process self-checks
  before deployment; failure stops the build. No DB/API/Storage calls occur.

## Actual verification

- Mobile-format regression: 8 assertions across SEF JPEG, SEF PNG with a JPG
  filename, progressive JPEG, palette PNG, WhatsApp recompressed JPEG and EXIF.
- Existing upload/security regression: 19 assertions, including exact 5 MiB,
  MIME hints/mismatch, malformed files, ZIP/HTML polyglots and malicious PDF.
- Additional SEF/process safety: 17 assertions; malformed containers, canonical
  hashes, two concurrent workers, overload rejection, repeated timeout cleanup.
- Build-runtime self-check: 10 assertions locally. Render Linux execution is
  separately confirmed from the deployment build log, not inferred from Windows.
- Browser -> real Cloudflare handler -> real API/child decoder -> authenticated
  Supabase JS Storage adapter -> isolated HTTP filesystem storage -> disposable
  real PostgreSQL -> browser ownership/order: **697 assertions**, 60 format/width
  cases at 320/390/430/768/1024/1440. Stored bytes and SHA-256 verified on disk.
  Parallel uploads, missing worker, timeout, retry, Storage outage, absent history
  cookie and click-only order creation included. OCR calls 0.
- Existing cancellation proxy/browser: 142 assertions. Separate PostgreSQL
  cancellation/concurrency: 18 assertions. Checkout viewport: 180 assertions.
- Existing payment-system suite: 81 reported checks; catalog fingerprint intact.

The filesystem test service implements the Storage HTTP protocol and uses the
production Supabase JS adapter; it is not a production Supabase bucket. The full
isolated browser pipeline ran on Windows. Render's native Linux runtime is tested
in its build separately. No production state-changing upload is used as proof.

## Release and limitations

Push only this branch's scoped hotfix to main, wait for both deployment records,
verify the Linux `RECEIPT_RUNTIME_SELFTEST` line, health engine/runtime protocol,
and committed public JS bytes/cache version. Live invalid-body cancellation
must still reach the API (400), not return a proxy 404. Keep OCR/content checks off.

Original ABB file remains untested. If it has a different unknown suffix, this
fix must not be described as confirmation of that specific file. No production
orders, reservations, receipts, inventory, bonus or WhatsApp operations are made.
No migration, secret changes or preview/main merge is required.
