# iPhone JPEG / MPF safety compatibility hotfix

Read-only live Render logs returned 29 upload entries: 16 had stage
`file_safety`, code `RECEIPT_UNSAFE`, diagnostic `file_safety:RECEIPT_POLYGLOT`;
13 were unrelated invalid/expired reservation attempts. No filenames, receipt
contents, tokens or account information were output. The original IMG_0820.jpeg
and its captured HTTP response are not available, so the exact customer's bytes
and their MPF identity cannot be confirmed from this aggregate evidence.

The reproduced bug is concrete: a synthetic standards-structured MPF JPEG
(EXIF rotation 6, ICC, progressive primary plus JPEG gain map) failed the old
isolated decoder with HTTP-facing 422 / RECEIPT_UNSAFE / RECEIPT_POLYGLOT.
It now passes and stores a re-encoded primary JPEG with rotation applied,
sRGB pixels and no EXIF/ICC/MPF metadata. It is deterministic across retries.

Only a valid APP2 MPF TIFF index authorizes auxiliary JPEGs. The parser bounds
all offsets, index types/counts (2–3 images), primary length, non-overlapping
contiguous auxiliary ranges and exact JPEG endings. It decodes primary and
auxiliary pixels, caps aggregate pixels at 20M, strips indexed auxiliaries,
and re-encodes the primary in the existing isolated child process. Arbitrary
appended images, executable/ZIP/script tails, forged indexes, malformed JPEGs,
active PDFs and oversized files remain rejected. No OCR or content gate added.
HEIC under a JPEG name retains the explicit conversion-required message.

The worker's bounded output protocol additionally allows <=5 MiB normalized
JPEG output (version 3), verifies the output envelope and updates its hash before
Storage upload. Existing version-2 PDF/PNG/SEF behavior remains compatible.
The service now reports `isolated-decoder-v4-mpf`.

The upload field remains the single accessible error location, rather than
duplicating the error above and below the form. The selected File is retained in
the checkout flow and preview; the file input itself is intentionally reset so
the same file can be reselected. Retry uses the retained File and existing
idempotency flow. No order is created by upload; success still requires Storage
verification and explicit Continue remains unchanged.

Verification (isolated, synthetic; no production business writes):

- iPhone regression and HTTP/browser storage/retry/security: 59 checks passed.
- Existing mobile safety/SEF/resources/timeouts: 17 checks passed.
- Upload-only JPEG/PNG/PDF, negative inputs, browser matrix: 212 checks passed.
- Manual Continue / no auto WhatsApp / no duplicates: 144 checks passed.
- Build-runtime self-test extended with the same MPF fixture to run in Render's
  actual Linux native decoder during install; no DB/Storage/OCR connection.

References for container semantics:
- https://www.cipa.jp/std/documents/e/DC-X007_E.pdf
- https://developer.android.com/media/platform/hdr-image-format
- https://developer.apple.com/videos/play/wwdc2024/10177/

No migration, Gmail configuration/queue change, inventory change, balance change
or modification of existing orders/receipts. Central decorative-assets work is
deferred while this urgent upload fix is deployed.
