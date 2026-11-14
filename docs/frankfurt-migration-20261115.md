# Frankfurt migration, 15 November 2026

The user approved Starter / `0.5c-512mb` at **USD 7/month**, compared with
the old MirPanel web service at USD 0/month: **USD 7/month additional compute**.
Other services, database plans and storage were not upgraded.

## Services and traffic

- Active: `srv-dbse90u1egvs73djpp2g`, Frankfurt, Starter,
  `https://mirpanel-frankfurt.onrender.com`, branch main, auto deploy on.
- Legacy: `srv-d8ead74m0tmc73emhsvg`, Oregon, Free, auto deploy off.
  Its process now imports only `deployment-relay.mjs`; no business modules,
  mailer, supplier dispatcher, stock queue or Sheets worker starts there.
- The temporary Free Frankfurt probe is `srv-dbsdvnc9v7es73ceh3o0`.
  It is no longer required after the paid deployment and can stay suspended.
- Cloudflare public pages remain on mirpanel.com. Public API proxies, direct
  stock/media requests, admin and employee links now use Frankfurt.
- The existing onrender.com hostname cannot be made to point to a different
  Render service by changing our DNS. **The legacy Render service is retained
  as a compatibility relay**, not fully suspended: old email links, cached JS
  and already issued Epinby callback URLs would otherwise break. Do not suspend
  this relay while those URLs are still required. It replays no failed POST.

## Inventory and data

41 source environment variables were copied and compared in memory. Encryption,
session, Google, Gmail, Resend, GitHub and supplier-related keys were preserved.
No keys were printed or added to Git. Original settings and environment backup
are protected with Windows DPAPI outside tracked files.

The PostgreSQL pooler hostname is in eu-central-1 (Frankfurt). Both regions use
the **same existing database**, not a copied database. The source web service had
no persistent disk, custom domains or secret files. Durable receipt files are in
the private Supabase receipts bucket (3,781 objects at audit); stories/banners
use the other private bucket (34 objects). Product uploads are committed to the
Git repository. No uploaded files or customer data were migrated or rewritten.
In-memory editor previews/pending upload buffers are not durable storage.
The separately billed Telegram bot already runs in Frankfurt and targets
mirepin.com; it was not modified.

No database migration or business-data restore was needed for the region move.

## Handover actually performed

1. A private Free standby accepted only authenticated public reads. All
   checkout/auth/webhook mutations, workers and outbound business writes were
   disabled. Actual Epinby getMe and Sheets metadata reads succeeded there.
2. Starter was approved. Render rejected changing a Free service to paid via
   PATCH (`cannot change between free and paid plans`), so one paid Frankfurt
   service was created within the approved USD 7/month allowance.
3. Paid Frankfurt ran in `web` role: full HTTP service, no periodic workers.
   Admin login, session, catalog, stock, methods, order list and ready stock
   reads passed; unsigned webhooks and guest checkout returned 401.
4. The latest main, including parallel cancellation work, was preserved.
   Public traffic switched first. The live /admin redirect, public asset and
   browser inventory requests confirmed the Frankfurt destination.
5. Only then was the Oregon service deployed with role `relay`. Its health
   confirmed `workers:false`. A session created in Frankfurt remained valid
   through the legacy URL; webhook bytes/signatures were tested unchanged.
6. Frankfurt was promoted to `active`; only it starts periodic workers.
   Current source publishing from the admin panel also reaches Frankfurt.

## Measurements

Same Windows client, warm services, alternating region order, 10 GET samples
per target; both production HTTP paths used their normal rate limiting in the
paid comparison. This compares Oregon Free with Frankfurt Starter, so it is a
combined region/compute change, not proof of geography alone.

| Read | Oregon median / p95 | Frankfurt median / p95 |
|---|---:|---:|
| Inventory | 899 / 2772 ms | 605 / 994 ms |
| Product sales | 1058 / 1695 ms | 439 / 599 ms |

Browser comparison used identical live product HTML/assets, fresh contexts and
five samples per target/width. Only test-browser inventory/sales requests were
switched to the selected upstream. No real checkout was submitted.

| Product plans + stock ready | Oregon median | Frankfurt median |
|---|---:|---:|
| Chrome, 390 px | 1476 ms | 1160 ms |
| Chrome, 1440 px | 1543 ms | 1174 ms |

The reported 4.2-second opening was **not reproduced** in this warm comparison.
Do not claim a measured 4.2-to-1.1-second improvement. Post-switch, without
upstream substitution, Chrome 390/1440 and WebKit 390 returned inventory from
the Frankfurt hostname with no overflow and no real payment. Single observations
were 1224/928/754 ms, not a statistically comparable replacement baseline.

Remaining latency includes GitHub catalog reads (roughly 370–514 ms in probes),
Supabase HTTP, frontend/assets and client network/rendering. The browser click
measure includes Playwright actionability/animation waits. Starter removes Free
idle spin-down; no cold-start reduction was directly measured.

## Verification and limits

Passed isolated checks: shared admin sessions/revocation, two application
instances with one wallet debit on replay, only one buyer for the last stock
unit, parallel customer-mail claims sending once, ready-stock FIFO/backlog,
partial delivery, retry and reservations, automatic/manual/multiple-room Sheets
delivery, sorted rows, ownership/date preservation, concurrent Sheets locks,
Epinby uncertain response/restart/idempotent webhook, welcome-mail retries and
uncertain sends, webhook proxy signature preservation and private cookie scope.
Email-confirmation tests exercised 320/desktop signup, refresh, invalid code,
cooldown, address change and synthetic Google callbacks. No external email or
real supplier purchase was made for these tests. Live Epinby balance refresh
from the paid server returned `confirmed` without creating a supplier order.

Several older broad tests have stale assertions (guest checkout before the
login requirement, old order placeholder/toast/layout labels, mail tab names,
and a mock response missing EventEmitter methods). They are not presented as
passing. The new handover tests exercise the current behavior independently.
An interactive real customer's Google login and a real financial purchase were
not performed. Existing payment/order/stock records were not used as fixtures.

Pre-existing queue issues are retained: 20 Sheets delivery reviews (19 missing
rows, one conflicting ID); one uncertain customer mail and six failed mails.
Do not reset/replay uncertain messages as part of migration. Queue counts can
change during normal customer activity; compare identifiers/checkpoints in
protected operational evidence, not an assumption that counts remain static.

## Rollback (does not restore or roll back business data)

The old service still has the same environment and database. From an up-to-date
checkout, run `node scripts/frankfurt-release.mjs status` first.

1. `node scripts/frankfurt-release.mjs rollback-web`; wait until Frankfurt
   health reports `role:web, workers:false`.
2. `node scripts/frankfurt-release.mjs rollback-legacy`; wait until Oregon
   health reports `role:active, workers:true`.
3. `node scripts/frankfurt-release.mjs rollback-edge`; wait until Frankfurt
   health reports a worker-free relay targeting mirpanel.onrender.com.

Both public hostnames then reach the old application, with only Oregon running
periodic workers. Existing sessions, order keys and webhook signatures remain
valid. Never run steps 2/3 out of order; the operator tool checks these gates.
Do not restore a database snapshot: legitimate orders during/after handover are
in the same database and must remain. Once repaired, reverse the handover with
the same single-worker discipline before re-enabling automatic deployment.

References: [regions](https://render.com/docs/regions),
[compute plans](https://render.com/docs/compute-plans),
[pricing](https://render.com/pricing?trk=public_profile__reactions-text),
[Free limitations](https://render.com/docs/free).
