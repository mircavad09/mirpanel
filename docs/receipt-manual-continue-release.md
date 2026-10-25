# Upload then explicit Continue (2026-10-25)

Supersedes the automatic continuation paragraph in receipt-upload-only-release.md. Content classification/OCR remains disabled. No SQL, migration, key rotation or production data repair.

- Upload endpoint returns `autoSubmit:false`, `receiptUploaded:true`, `contentChecked:false`, `paymentVerified:false` only after private storage confirmation.
- Browser displays `Çek uğurla yükləndi`, enables `Davam et`, and stays on the current page. No order request/WhatsApp navigation occurs on upload completion, even if a stale backend returns `autoSubmit:true`.
- Explicit submission by the enabled Continue button invokes the existing order endpoint once. The unchanged order-confirmation caller receives the canonical WhatsApp URL/message and performs its existing navigation. Implicit form submission without the Continue submitter cannot advance.
- Uploading, failed, replaced, removed and invalid new-file states do not retain an enabled Continue or an old success message. New file must obtain a fresh server capability. Duplicate clicks are blocked by the in-flight guard and existing server idempotency.
- Receipt success means stored file, not payment approval. JPEG/PNG/PDF, 5MB, safe decode/PDF checks, access control, reservation/plan binding, private storage remain unchanged.
- Only payment-flow.js, upload API `autoSubmit`, current tests, this document, and checkout asset query versions in index/22 product pages/generator are changed. Prior ABB/local work stays unstaged.

Tests: `node scripts/test-receipt-upload-release.mjs`, including `test-receipt-manual-continue.mjs`. Six widths 320/390/430/768/1024/1440; upload holds, no auto-order/navigation, file replacement, failed storage/retry, button-only advance, double click, same message/order number, PDF replacement capability, no payment approval. WhatsApp paths are intercepted or checked as data, never sent. Production verification is GET assets/health plus live UI using local isolated payment APIs only.

Asset query: `receipt-continue-20261025-7`. Both backend and frontend deploy must match the final commit. Backend remains `receiptCheck:file-safety-only-v1`, `ocrRequired:false`.
