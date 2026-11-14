# Shared admin delivery latency — 2026-11-15

Baseline: main `5ca7ef0`, including the parallel Netflix Sheets integrity and
admin-profile work. Changes are limited to shared delivery latency and its
concurrency/UI regressions. No schema migration or production business-data
write is needed for deployment.

## Causes

The shared server delivery function already committed a durable mail job and
queued Netflix sheet work; neither external transport was awaited. Do not
claim email/Sheets HTTP calls caused the old delay. The actual repeated waits:

* begin and fulfillment advisory lock were separate round trips;
* order, delivery history, retry/idempotency record and dispatch-table presence
  were separate reads;
* delivery insert and durable mail job insert were separate writes;
* Netflix room binding repeated schema-presence and held-reservation reads;
* after success the admin UI fetched the whole order list again, delaying the
  visible card/counter update and rebuilding unnecessary state.

## Changes

The authoritative order/progress/retry snapshot is read together after acquiring
the shared fulfillment lock. Delivery and mail outbox insert use a data-changing
CTE in the same transaction. Netflix capabilities are obtained in that same
snapshot (no cross-request schema cache); room identity/PIN/password, expiry,
manual-review, assigned state and active reservation checks remain intact.
Held state is selected with the locked room. Sheets jobs still enter the same
durable queue, never a detached best-effort write.

Cancellation takes the same global-then-order lock sequence as delivery and
checkout. Concurrent delivery/cancellation tests require exactly one winner;
stale cancellation previews cannot refund delivered units. Existing payment,
stock, ownership, supplier-in-flight and canonical product-message checks remain.

The response is sent only after commit. Server-Timing reports non-sensitive
connection, lock, snapshot, validation, persistence, commit and total durations.
The admin service forwards this callback; email worker wake remains non-awaited.

The button immediately disables and says “Göndərilir…”. The same request UUID
and frozen submitted values survive uncertain failures. Definite failures keep
the typed fields; 409 exposes the existing preview retry control. On success,
the modal closes and only that card/progress is updated or removed. A counts-only
background request reconciles counters; no full-list request is made by success.
Old pre-delivery list replies are invalidated so they cannot resurrect the card.

## Reproducible measurement and limits

`test-admin-delivery-speed.mjs --before` loads the baseline server and changed
dependencies from Git, and the normal run uses current sources. Both use fresh
isolated PostgreSQL fixtures with the real current migrations, API dispatch
table, canonical templates, and two real encrypted Netflix room units. Every
database round trip is delayed by a fixed **146 ms**, matching the recent live
Render-to-Frankfurt observation. This is controlled emulation, not a live
production POST measurement. No production order is delivered.

Measured server time: Spotify/CapCut approximately **1.7 s → 0.92 s**,
**11 → 6** database round trips. Netflix with actual room binding and queued
Sheets write approximately **2.8 s → 1.4 s**, **18 → 9** round trips.

`test-admin-delivery-speed-browser.mjs [--before|--live]` uses Chrome and WebKit,
390 and 1440 px, and all three products. Synthetic API response latency is the
measured database time plus a fixed 200 ms normal-network budget. The old list
reload has a fixed 1000 ms response delay. Times are recorded by animation-frame
observation inside the browser, not Playwright polling overhead. `--live` checks
the deployed admin script byte-for-byte, but all mutations stay in the local
fixture. Reports: `outputs/admin-delivery-speed/`.

Mail transport is held indefinitely behind a test gate while the first delivery
commits. A real Sheets queue worker is held at its external-client call while a
different unit in the same Netflix order is newly delivered. Neither wait blocks
confirmation. Repeated/parallel UUIDs create one record and one mail job per
unit. Partial delivery, another customer's access denial, 0408 PIN preservation,
ready-stock races, and concurrent cancellation are tested.

Regression scripts: test-spotify-delivery-postgres, test-spotify-delivery-prefill-
browser, test-admin-pending-delivery-browser, test-fulfillment-cancellation,
test-netflix-sheet-customer-id, test-netflix-room-stock, test-ready-stock,
test-ready-stock-backlog, test-cart-ready-stock, test-order-retry-idempotence,
and test-admin-delivery-timing. The cancellation test's stale English URL
expectation was updated to the already-published Azerbaijani order-tab URL.

Remaining limitation: production Render is in Oregon and the database in
Frankfurt. Pool contention, global fulfillment lock contention and a cold
instance can exceed the 1–2 s target. Moving Render near the database and using
an always-on plan is an infrastructure decision, not part of this patch.
An authenticated live synthetic/staging delivery is required to claim an actual
production click-to-commit time; public read-only measurements and deployed-byte
verification cannot establish that number. No real customer order was used.
