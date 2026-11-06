# Guest sign-in panel and authenticated checkout — 2026-11-07

Scope: shared account-header guest panel and authentication at checkout. No
migration, catalog, stock/price rules, payment transaction, Gmail or credential
configuration changes. Existing email/Google/signup and `/odenis` return allowlist
are reused.

Guests retain catalog, plan selection, terms and protected draft/cart creation.
The cart closes before opening the anchored sign-in panel. Direct payment URLs
also require login before choosing payment. Fresh session state is checked on
the payment return and shared with the header, without rebuilding the cart.
Opaque draft references/quantities/terms survive login and verification return;
server draft ownership is claimed through the existing owner-cookie checks.

Server shop checkout always requires a verified, permitted account. The deployed
legacy payment handlers also require their configured account resolver before a
new reservation/order. Existing submitted guest checkout reads/idempotent retries
remain usable by their original browser; their records are not reassigned.
An old unsubmitted guest hold can only be finalized after authentication by its
own browser, then is linked to that account in the existing transaction.

Header dependencies checked: authenticated avatar/menu/notifications unchanged;
desktop balance insertion excludes guest controls; mobile search can shrink.
Account CSS is persistent across client navigation. Asset versions are advanced
for the affected loader chain only.

Synthetic evidence: 320/360/390/430/1440, guest and signed-in headers on all seven
main routes, toggle/outside/Escape close, sign-out, normal warning/fields/cart
entry, two products with quantity 2 and PIN 0012, login and modeled email
verification return to payment choice, reload without duplicates, direct API
guest rejection before reservations, and existing submitted guest read/retry.
Existing cart transaction/receipt/idempotency and profile tests were retained;
checkout fixtures now authenticate before purchase to reflect the new policy.

The new browser test uses real forms against synthetic authentication responses;
external Google consent and real email delivery are not claimed by that test.
No live customer purchase, reservation, receipt or money operation is created.
