# Prepared support answers — 2026-10-26

Only the support panel changes. Five static question buttons show the exact supplied answers as `Hazır cavab`; one WhatsApp question opens the existing support URL. One answer is expanded at a time; repeated clicks never append duplicate content. The order-history answer links to `/sifarislerim` through `Sifarişlərimə bax`.

No common guaranteed preparation time was established: catalog delivery modes vary, and generic legacy `deliveryFast` presentation text is not an authoritative universal promise. The supplied product-dependent fallback is used without invented timing or guarantee.

The greeting and prepared-answer notice replace the old unavailable-AI warning. The nonfunctional free-text/send form is removed. No AI service, key, request or generated reply is added. Left WhatsApp, AI launcher, focus/close/animation, reduced motion, contained scrolling and bottom menu positioning remain.

`test-support-faq.mjs`: 920 checks, 18 page/width combinations at 320/390/430/768/1024/1440. Exact labels/answers, single visible answer, repeated clicks, no form, history navigation, isolated operator popup, 44px targets, geometry, close/Escape, reduced motion; JS errors=0 and new404=0. WhatsApp popup is fulfilled locally, never a real message. `test-support-widget.mjs` remains a compatible entry point for the new contract. The same test can run read-only live with `MIRPANEL_SUPPORT_LIVE=1`, blocking non-read requests.

Cache version `support-faq-20261026-1`: support assets and their shared loader reference. Other HTML/product-template edits are only shared loader cache-version references, not menu/product/checkout changes. No migration or business-data writes.
