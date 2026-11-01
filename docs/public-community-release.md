# Public community release preparation — 2026-11-01 (Asia/Baku)

Status: **LOCAL PREPARATION ONLY; EXTERNAL AUTH BLOCKED.**
Production remains on `89dc79a`, owner-only login / closed public signup and group.
This branch starts from current production, not a wholesale development merge.
No preview gate, synthetic mailbox, seed accounts/messages, preview credentials,
demo payments/WhatsApp adapters or production test orders are imported.

## Prepared functionality

- Existing Better Auth password hashing, six-character minimum, email verification,
  reset flow, persistent sessions, rate limits, same-origin/CSRF protections.
- Real Gmail sending adapter (not the preview mailbox); errors fail closed.
- Verified Google identity admission for regular users; current production client
  retained. Existing owner identity/Google subject binding is preserved exclusively
  for verified `mircavad09@gmail.com`. No moderator assignment endpoint added.
- Default post-login destination `/profil`; only the exact history return target
  `/sifarislerim` is permitted as an alternative. No arbitrary redirect accepted.
- Guest group reads, authenticated/verified text writes, existing group moderation,
  tier frames/labels, private profile and covers, public avatar presentation.
- Server counts/presence (45-second TTL, distinct account count), system bot,
  rate-limited warnings, ID-bound tags/private notices/read-on-visible behavior.
- Existing header bell and bottom group link display real unread tag counts.
- Existing account-only order history and guest checkout are preserved. New signed-in
  purchases use an additive transactional wrapper to attach the authenticated account;
  old anonymous orders cannot be claimed by retry or inferred by browser/IP/email.
- Balance/top-up/cart remain disabled placeholders. No new money functionality.

`COMMUNITY_PUBLIC_ENABLED` is a **new, default-off** server gate. Existing
`COMMUNITY_OWNER_ENABLED` and all encryption/auth/payment secrets remain unchanged.
When public mode is off the previous owner repository/auth policy is used. The
public path additionally requires the new schema readiness marker.

## Production read-only findings

`node scripts/public-community-preflight.mjs` actually inspected the production
schema: user/session/account/owner identity/profile/media/member numbers/order
ownership tables exist. Presence, bot blocks/tags and public release marker do not.
Public flag is off. No customer rows were printed or changed.

The configured Gmail refresh attempt returns **HTTP 400 `invalid_grant`**. No
access token was obtained and no real email was sent. Public verification/reset
must NOT be called working until the sending account is re-authorized and a real
verification/reset delivery is tested with an authorized recipient.

Production Google JSON was previously matched to the configured client without
printing its secret: project `mirpanel-community-preview`, callback
`https://mirpanel.com/api/auth/callback/google`. Audience publishing/test-user
restriction and an actual Google callback remain **unverified**. The browser tool
still reports `Local browser use is disabled in Work settings`, even after kernel
reset and the user's screenshot showing On. No workaround through an unapproved
browser profile or security bypass is used.

## Migration and rollback

1. `mirpanel-admin/community/public-release.sql` — additive, transactional,
   idempotent, advisory lock + 5-second lock timeout. Adds missing auth fields,
   presence, bot/tag tables/system identity, private grants and account-order RPC;
   notifies PostgREST to reload its schema. Existing accounts/orders/roles are not
   overwritten or imported. The one new system bot cannot authenticate.
2. `mirpanel-admin/community/public-verification.sql` — every returned boolean must
   be true. Missing owner/profile base tables, bot identity conflict, failed grants,
   incorrect/missing RPC or false readiness is a STOP condition.
3. `mirpanel-admin/community/public-rollback.sql` — first disable public env gate
   and redeploy the last owner-only app, then set readiness false. Deletes no user,
   message, notification, media, order, audit, display number or stock data. Re-running
   migration does not silently re-enable a rolled-back release.

## Actual external backup/restore

`node scripts/public-community-backup.mjs` was executed under the desktop user's
restricted local permissions. It exported a consistent read-only snapshot of both
`public` and `mirpanel_community` to an external private directory under
`%LOCALAPPDATA%/MirpanelPrivateBackups/public-community-*`, restored to a fresh
loopback-only PostgreSQL cluster, compared original row fingerprints and function
definitions, applied the exact migration twice, verified it, and ran the rollback.
Original columns/rows stayed identical (the migration-created bot is a deliberate
exception, not an imported customer). The restored cluster was stopped.

The archive was DPAPI CurrentUser-encrypted, encryption round-trip checked, and the
plaintext dump removed. Restore-cluster files remain under the same user-only DACL.
No archive, database contents, mail links, keys or passwords are in Git/chat.
Storage object bodies are excluded; this release does not change receipt objects.
The manifest alone is not the backup: actual dump/restore was completed.

Latest verified exact SQL SHA-256:
`383f609b471faf009659b294ace0b5c335a6dfb29b4eedd43e1fc6746cba77e5`.
Encrypted archive SHA-256:
`15951e636b7bbf3f385ecef397fa31997df520ea80871f9a7e2e11ccd85daf1f`.
If SQL changes or substantial time passes before release, redo the backup/restore.

## Executed test results

| Command | Assertions | Failed |
|---|---:|---:|
| `test-public-community.mjs` | 145 | 0 |
| `test-public-moderation.mjs` | 31 | 0 |
| `test-public-order-link.mjs` | 13 | 0 |
| `test-public-bot-policy.mjs` | 39 | 0 |
| `test-community-mail.mjs` | 8 | 0 |
| `test-owner-release.mjs` | 838 | 0 |
| `test-account-orders.mjs` | 58 | 0 |
| `test-receipt-manual-continue.mjs` | 144 | 0 |
| `test-public-checkout-no-customer.mjs` | 39 | 0 |
| `test-inventory-upstream.mjs` | 18 | 0 |
| `test-owner-proxy.mjs` | 11 | 0 |
| **Total** | **1344** | **0** |

Fresh synthetic PostgreSQL, actual local HTTP/auth sessions and Chromium at
320/390/430/768/1024/1440 px. Screenshots ignored under
`payment-test-artifacts/public-community/`. Two DB connections verify competing
account attachment, retry and no anonymous relink. No real email/Google callback,
production customer upload/order/reservation/payment/message is tested.

During development, real regressions caught and fixed: owner-only pages attempted
new presence/notice endpoints before migration; initial group read forced a second
session request; floating support controls covered the group composer. Earlier
failed runs are not counted as passing. A missing local PGlite package was linked
from the already-installed test runtime and the checkout suite rerun successfully.

Bot corpus: 15 normal / 19 prohibited examples, 0 FP / 0 FN on that small corpus.
Held-out limitations remain: a long numeric serial can be falsely treated as a
phone number; base64-encoded contact can evade the deterministic filter. No claim
of exhaustive moderation, automatic ban, or AI classification.

## Remaining external steps and release order

1. Restore authorized Google Cloud browser access, OR have the owner review the
   OAuth audience at
   `https://console.cloud.google.com/auth/audience?project=mirpanel-community-preview`.
   Confirm production login is not limited to test users. Do not change/delete the
   preview client or existing callbacks. Keep the production stable callback.
2. Re-authorize the existing Gmail sender; securely update its refresh token in
   Render's environment UI (not chat/Git). The service dashboard is
   `https://dashboard.render.com/web/srv-d8ead74m0tmc73emhsvg`.
   Re-run preflight and complete real verification/reset delivery and Google return
   checks with the owner. Do not rotate unrelated keys.
3. Refresh backup proof if stale. Apply only `public-release.sql` to the production
   mirpanel-payments DB, then run verification. No other old migration is rerun.
4. Pause frontend auto-deploy; push only the reviewed release commit to main;
   deploy Render with public mode initially off. Check health, prior checkout/
   history/admin protection and commit. Deploy Cloudflare at the same commit.
5. Enable `COMMUNITY_PUBLIC_ENABLED=true` only after external auth + schema +
   deployment checks pass, redeploy Render, then check public GET messages, guest
   POST 401, member admin 403, signup/login/profile/history return and notices.
   Do not manufacture production orders/reservations/receipts/WhatsApp messages.

Current state: **production SQL not applied, env not changed, no main push or
Render/Cloudflare deployment for this branch.** Local preparation is preserved.
