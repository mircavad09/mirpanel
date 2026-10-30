# Profile statistics / balance layout — 2026-10-30

Follow-up to cb2ddab, only the authenticated profile presentation and its read-only
summary endpoint. No migration, business writes or auth-policy changes.

The hero now contains a compact two-cell statistics row, separate balance card,
and the existing collapsible editor, in that order. Greeting/member-number copy
row remains below the hero; latest order/subscription and logout remain below it.
Anthracite hero, darker balance, lighter editor, thin distinct borders. No badge
counter. Avatar/cover uploader, admin overlays and member numbers unchanged.

Sifariş links to existing /sifarislerim. Count is derived server-side using only
community_order_owners for the session's user and payment_orders with approved or
completed status. Pending and other users' orders excluded. No browser-provided
count is trusted. The summary does not have a persisted proven savings source:
savingsCents is null, displayed as Məlumat yoxdur, with no active savings link.
Balance is Tezliklə, not 0.00. Balansı artır is a disabled native button with no
payment/navigation handler. No new balance system, registration or group access.

Tests: owner release suite 473 assertions, zero final failures. Synthetic DB only.
Includes completed/approved/pending/other-account fixtures, count/guest access,
order link click, disabled top-up, no badge, persistence/cancel, avatar/cover
separation, clipboard, permissions and six responsive widths. Screenshots use
synthetic accounts and synthetic images/orders, not live owner data.

Public proxy and inventory regression suites rerun separately. Deployment must
compare source assets on the live domain and confirm closed guest/registration
routes; no live owner profile upload/edit, order, reserve or WhatsApp test.
