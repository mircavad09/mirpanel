# Bank-wide checkout backgrounds

Scope: the existing product checkout selection and payment-information cards only.
No wallet/balance page, method scheduling, inventory, receipt, order, authentication,
or Gmail queue behavior is changed.

## Persistence and access

Canonical keys: `kapital` (Birbank/Kapital Bank), `m10`, `abb`, `leo`.
The existing method theme/bank selector is used; provider aliases resolve Birbank
to Kapital too. Backgrounds are not keyed by card ID/number. All current/future
cards resolving to a bank use the same object.

The existing private media bucket (`SUPABASE_STORIES_BUCKET`, default
`mirpanel-stories`) stores four independent objects under
`payment-bank-backgrounds/{bank}.webp`. Existing story and receipt objects and
cleanup rules are untouched. No database migration or data backfill is needed.
The new namespace is not enumerated by receipt or story retention operations.
Removing a background removes only its exact bank object, never a payment card.

Admin read/write uses existing admin session and mutation CSRF/origin checks;
the server's existing employee gate denies employee access. Customer proxy
exposes only the four decorative image reads, not admin writes or Storage keys.
Public responses contain a versioned local URL, never signed URLs or secrets.
No user-provided URL or HTML is rendered. Failed image requests restore the
existing gradient theme. Media metadata failure cannot fail a reservation;
public metadata lookup has a one-second best-effort ceiling, concurrent with
method retrieval, and shares the backend's 30-second metadata cache.

Images: PNG/JPEG/WebP, <=5 MiB, <=16 million input pixels, <=10000 px per edge,
single frame. Separate child process (128 MiB JS heap, 10-second deadline,
maximum two decoders) decodes/re-encodes to WebP, fits inside 1600x1000 without
changing aspect ratio, strips metadata, caps output at 2 MiB. Failed replacement
does not overwrite the old object. Same-bank concurrent mutations are rejected.

## Verification performed (isolated)

- `node scripts/test-bank-backgrounds.mjs`: 126 assertions, zero final failures.
  Real isolated child decoder, payment HTTP handlers, Cloudflare handler and
  browser UI; filesystem Storage adapter, not a production Storage write.
  Four supplied images used when available; generated synthetic fallback assets
  keep the suite runnable without personal Temp files.
  Tests bank identity/current and future cards, PNG/JPG/WebP, corrupt/active/
  oversized/decompression-limit input, failed replacement, concurrent mutation,
  restart persistence, remove/fallback, auth/CSRF, proxy cookie isolation/cache,
  both checkout stages, card number copy, live timer/text, admin preview/upload/
  removal/reload, and 320/360/390/430/1440 px layouts.
- `test-checkout-viewport.mjs`: 180 assertions passed.
- `test-checkout-cancel.mjs`: 180 assertions passed.
- `test-checkout-cancel-proxy.mjs`: 142 assertions passed.
- `test-payment-method-selection.mjs`: six viewport scenarios passed.
- `test-payment-method-copy.mjs`: five viewport scenarios passed.
- `test-checkout-api-recovery.mjs`: legacy suite still fails its first order-code
  expectation (`undefined` vs `10001`). The identical failure was independently
  reproduced using the unmodified HEAD payment API, so it is not reported as a
  passing regression or attributed to this change. No unrelated logic changed.

Read-only production preflight: existing media bucket exists, private, WebP
allowed, namespace empty before deployment. No supplied image is automatically
installed in production; authorized admin uploads bank designs using the new UI.
No production reservation/order/receipt/top-up/test message is created.

Visual artifacts (ignored): `payment-test-artifacts/bank-backgrounds/`.
