# Spotify admin delivery prefill

The delivery GET previously returned product messages and Netflix room details,
but not Spotify's order-snapshot credentials. The protected, no-store admin GET
now projects only the selected own-account Spotify line's saved email/password.
No profile/contact fallback, catalogue mutation, migration or new mail flow.

- `test-spotify-delivery-prefill.mjs`: 19 checks; encrypted modern/legacy values,
  field aliases/types, missing fields, ready-account exclusion, per-line isolation,
  read-only projection and sanitized corrupt-cipher failure.
- `test-spotify-delivery-prefill-browser.mjs`: Chromium/WebKit, 390/1440 px,
  two synthetic orders; editable plaintext password, reopen, switching lines,
  early admin edits, closed-dialog late replies and single submission.
- `test-spotify-delivery-postgres.mjs`: disposable local PostgreSQL on loopback;
  real draft -> wallet checkout -> delivery preview -> edited delivery -> owner
  projection. Other owner denied; encryption retained; retry creates one delivery
  and one mail event. No mail worker or production writes.
- Existing `test-customer-order-delivery.mjs` stops at its old empty-outbox
  expectation after receipt submission: current main already queues the receipt
  review message. This unrelated expectation was not changed in this task.

Each dialog owns its drafts. Responses for closed dialogs are ignored, and user
input before the preview response takes precedence over prefill. No credential
values are persisted in browser storage or added to logging or email payloads.
