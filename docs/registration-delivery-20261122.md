# Registration email investigation — 22 November 2026 (Baku)

## Current evidence, not a delivery claim

- Inspected live backend at 46b4d9b and current Render logs. The displayed last-24-hour result contained 50 Gmail acceptance events, zero explicit failure/uncertain events. This is a bounded visible sample, not proof that all requests succeeded.
- Gmail mailbox search `in:anywhere newer_than:2d from:(mailer-daemon@googlemail.com)` showed 23 confirmation-code threads affecting 14 distinct recipients at the time inspected. Four recipient addresses used `gamil.com` / `gmal.com`. Other responses included nonexistent Gmail/iCloud addresses and full recipient mailboxes. Thread counts are not individual-send counts; repeated sends may be grouped.
- Correlated the 22 November 11:38:56 Render acceptance provider ID `1a202319f1f03ad9` with the original Gmail message in a bounce thread. Gmail then returned `550 5.1.1 The email account that you tried to reach does not exist.` No secret or confirmation code was recorded here.
- Current Render configuration has the Gmail sender/OAuth variables; the sender mailbox contains the above live confirmation messages. `ORDER_MAIL_PROVIDER` is `resend`. Authentication mail does not use the order-mail transport.
- No evidence in the inspected sample establishes a Gmail quota or OAuth outage as the cause of those bounces. Invalid/full recipient mailboxes cannot be repaired by retrying application sends.

## Application corrections

- A resend previously replaced the valid code before provider acceptance. A failed resend therefore invalidated an otherwise usable code. Keep the last accepted hash/expiry/attempt count until a replacement is accepted.
- Keep code validity tied to creation, not a late provider response. Check request revision/expiry before transport and retry; never queue plaintext codes for delayed sending.
- One bounded in-request retry only for short, explicit transient authorization/rate rejections. No retry for uncertain Gmail sends, transport loss, 5xx, long quota waits or permanent rejection. Existing provider cooldown remains persisted.
- Add the observed `gmal.com` typo to the existing explicit correction guard; do not silently modify addresses.
- Explain last-successful-request code semantics in the email and shared verification sheet. Add a `sending` diagnostic event so an interrupted attempt can be distinguished from no request. Never log email addresses or codes in these events.

## Isolated checks

- `scripts/test-auth-mail-failures.mjs`: provider errors, bounded retry, stale retry refusal, uncertain-send no retry; zero real messages.
- `scripts/test-email-confirmation.mjs --delivery-errors`: cooldown, saved provider receipt, expiry, typo guards, pending-account recovery (390/1440), rejected resend preserves usable code, replacement invalidates old code.
- Full confirmation browser test: 320/1440 signup, refresh, resend, invalid/expired code, email change, completion and return; synthetic Google verification; duplicate-registration recovery.
- `--registration-recovery`: failed start/send can resume without duplicate signup.

## Outstanding real receipt check

The supplied separate Gmail address is the protected site-owner identity. Its registration/verification state must not be altered for testing. A different controlled Gmail for a disposable registration was requested. Inbox/spam arrival, latency, real resend, and real code verification remain unconfirmed until that address is provided and the recipient observes the messages. Acceptance is not delivery.

No customer account, balance, order, stock, or historical message was changed during diagnosis. No service/provider was changed and no paid service was enabled.
