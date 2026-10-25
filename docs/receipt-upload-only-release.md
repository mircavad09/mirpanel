# Emergency upload-only policy

Latest user instruction temporarily disables content classification. Random photos, ordinary WhatsApp screenshots and safe PDFs are accepted regardless of content. No OCR, bank profile, receipt keyword, amount/card/date/status/reuse condition is used. No manual-review stage or payment approval is introduced.

The live API no longer imports or invokes the OCR inspector. `RECEIPT_SHAPE_ENABLED` cannot re-enable the gate in this build. Health reports `receiptCheck:file-safety-only-v1`, `ocrRequired:false`, `contentChecked:false`. OCR models may remain on disk from the prior release but no OCR process starts on upload.

`receipt-file-safety.mjs` invokes a secret-free child with 25s deadline, 192MB V8 limit, maximum two concurrent decodes. It only runs file-safety processing: JPG/PNG/PDF magic/MIME, 5MB, successful decode, 20MP/10k dimensions, PDF page/operator/image limits, active-content/attachment/JavaScript/polyglot rejection. Native memory is not covered by the V8 limit; no container-isolation claim. OCR failure or latency cannot affect this path. File safety failures and storage failures still block, with retry rather than false success.

Reservation/product/plan binding, signed encrypted upload capability, private storage and verification remain. Server confirms storage before returning `receiptUploaded:true,autoSubmit:true,contentChecked:false,paymentVerified:false`. The browser shows `Fayl uğurla yükləndi`, then invokes the same canonical order endpoint once. Only that endpoint's actual success produces the existing order confirmation. No automatic payment approval. Legacy valid upload capabilities remain compatible; no schema or migration is needed.

The ABB content-recognition work was interrupted by this new instruction and is preserved as unstaged local work, not included in this emergency release. It is not claimed as complete or deployed. Existing unrelated header/splash edits remain unstaged too. Product pages/index/generator only change checkout cache query to `receipt-upload-20261025-6`.

Test: `node scripts/test-receipt-upload-release.mjs`. Synthetic ordinary photo, WhatsApp chat, JPEG and safe PDF upload, direct multipart, auto-submit, duplicated final submit, fake MIME, oversized/corrupt image, malicious PDF, cross-checkout token, storage failure and retry, OCR permanently offline are exercised. Browser widths: 320/390/430/768/1024/1440. Tests only use disposable fixtures/local PostgreSQL; no production receipt, order, reservation or message is created.

No production SQL, key rotation, plan change or data repair. Deploy matching commit to Render and Cloudflare; verify GET health and exact JS bytes at the new version. Live visual flow can use live assets with ALL payment mutations intercepted to a local test API. Never send test receipts/orders to production.
