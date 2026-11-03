# Receipt transport and retry recovery — 2026-11-03

## Evidence and limits

Read-only Render log audit found 29 retained `Payment upload` records: 16 HTTP422
`RECEIPT_UNSAFE` / `file_safety:RECEIPT_POLYGLOT`, 13 HTTP409
`RECEIPT_RESERVATION_INVALID`. Those records did not have an attempt correlation
ID, and the original newly reported Android JPG is unavailable. They do NOT prove
that this Android incident was another polyglot rejection. No production receipt,
order, reservation or balance was created or changed to investigate it.

Confirmed implementation defects fixed:
- Browser network/timeout and generic HTTP5xx errors shared the same generic file
  message; retry exhaustion also discarded a more specific failure description.
- Identical concurrent uploads for the same reservation were decoded/stored twice.
  Baseline regression against commit 1fbf0a5 fails `one decoder ...: 2 !== 1`;
  the current test passes.
- Reservation state could change during decoding/storage without a fresh check
  before success. Both sides of storage now check the reservation capability and
  active expiry; this race is covered independently of the unconfirmed incident.

## Changes

Every browser HTTP attempt has a random UUID `X-Upload-Trace`. The narrow proxy
forwards it and returns/logs a safe proxy status; backend returns the same ID and
logs only ID, stage, HTTP status, code, byte count, detected format and duration.
No original filenames, contents, card data, reservation IDs, cookies, credentials,
receipt proof tokens or customer data are logged. The final UI error has one copy
of the message and a correlation reference. Long names and errors wrap safely.

An in-flight-only map coalesces identical raw bytes after reservation ownership
checks; failure always evicts the entry. No completed/failed cache bypasses fresh
reservation checks or file security. Durable identity remains the private
reservation-scoped canonical-content-hash object; retries reconcile an existing
object after a lost response. No database migration or retention changes.

## Verification

- 832 full-stack assertions, 72 browser format/viewport cases: real proxy handler,
  real safety child process, production Supabase JS Storage adapter talking to an
  isolated authenticated HTTP filesystem service, and disposable local PostgreSQL
  reservation/order/browser-owner RPCs. Includes JPEG, PNG, WhatsApp, safe PDF,
  Samsung SEF, Android progressive/palette variants, EXIF, iPhone HDR/MPF, long
  Unicode/spaced filenames, exact5MiB, response loss and storage/worker failures.
  These are local measurements, not production Storage write tests.
- 35 retry/race assertions: one in-flight decoder/write, expiry during decode,
  cancellation during storage, invalid capability, response loss, preserved File
  and preview, no automatic WhatsApp/order, specific storage error and recovery.
- 59 iPhone compatibility/security assertions; 144 explicit-Continue UI assertions;
  15 real decoder runtime assertions. OCR calls: zero. Corrupt/active/oversized
  payloads remain rejected. Original Android JPG: not tested. No physical Safari
  device claim; browser mobile checks use Chromium emulation and compatible files.

Production verification is limited to deployed assets/version, safe health/runtime
information and deployment status. The specific customer failure remains
unconfirmed until a correlated attempt or original file is available.
