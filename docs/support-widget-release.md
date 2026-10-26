# Support UI — 2026-10-26

Scope: remove the standalone game runtime/HTML; move existing WhatsApp support to bottom-left; add bottom-right AI support launcher/panel. No payment/order/receipt/history/navigation-button changes. Old game strings in CMS configuration and unused shared stylesheet rules are deliberately not purged; no game UI, canvas, event handler or animation loop remains in the home runtime.

`support-widget.js` / `.css` are loaded once through `site-header.js`. The existing WhatsApp anchor/href/target is reused; pages without it use the same verified Mirpanel support address. No WhatsApp message template or order link is changed. Existing modal-visibility rules are respected. New UI has scoped CSS, 44px controls, visible focus, focus loop/return, Escape/backdrop/X closing, reduced motion, body-scroll restoration and contained panel scrolling. VisualViewport events adjust the panel above an onscreen keyboard. Closing clears the local draft.

No functioning AI chat service/endpoint was found in project routes or client integrations. No key, paid service or fabricated replies were added. The panel displays `AI dəstək hazırda aktiv deyil. Operatorla əlaqə saxlaya bilərsiniz.` The message field is a local unsent draft; Send is disabled and form submission is prevented. Operator opens the existing WhatsApp support link.

Tests:
- `test-support-widget.mjs`: 560 checks, 18 combinations (320/390/430/768/1024/1440 × home/detail/history), JS errors=0, new404=0. Covers full icon/label containment, non-overlapping launchers above bottom nav, no game DOM, opening/fade/closing, keyboard focus, blocked draft submission, intercepted operator popup (no WhatsApp network/message), page scroll after close, duplicate-init prevention, reduced motion and 400px viewport approximation of keyboard space. This does not certify a physical iPhone software keyboard.
- `test-receipt-manual-continue.mjs`: 144 checks, unchanged explicit Continue/receipt/WhatsApp order behavior, no production operations.
- `test-browser-orders-ui.mjs`: 170 checks, history/nav preserved, six widths, no overflow/JS errors/new404.
- Commercial snapshot was unchanged by game-only runtime removal. Incoming admin content updates are preserved separately when merging main.

Shared header references use `support-20261026-1`; the home app reference is refreshed. Generated page templates preserve this loader version in later admin content updates. Other page edits are script-version references only. No migration or production business-data write is needed.

Incoming admin commits `5d07d87` and `00fbf31` were preserved by normal merge. Commercial state hash matches `00fbf31` exactly (`de63a4ebed893ae77d387dae05a3897e23ce4a6f50586874404f770485023e49`, 22 active products); only game runtime was removed from app.js. Support checks passed again after merge.

Changed files (relative to the preserved incoming main):
- `app.js`
- `docs/support-widget-release.md`
- `elaqe`
- `haqqimizda`
- `index.html`
- `mehsul.page`
- `mehsul/adobe-creative-cloud.page`
- `mehsul/amazon-prime-video.page`
- `mehsul/canva-premium.page`
- `mehsul/capcut-pro.page`
- `mehsul/captions-ai.page`
- `mehsul/chatgpt-plus-ortaq-hesab.page`
- `mehsul/chatgpt-plus.page`
- `mehsul/cloud-ai-pro.page`
- `mehsul/duolingo-super.page`
- `mehsul/google-ai-pro-ultra.page`
- `mehsul/google-ai-pro-v3.page`
- `mehsul/grok-ai.page`
- `mehsul/hbo-max.page`
- `mehsul/netflix-sexsi-yenilemek.page`
- `mehsul/netflix-sexsi.page`
- `mehsul/netflix-umumi.page`
- `mehsul/spotify-premium.page`
- `mehsul/surfshark-vpn.page`
- `mehsul/tiktok-jeton.page`
- `mehsul/youtube-eyni-hesab.page`
- `mehsul/youtube-premium.page`
- `mehsul/zoom-pro.page`
- `mirpanel-admin/product-pages.mjs`
- `scripts/test-support-widget.mjs`
- `sertler`
- `sifarislerim.html`
- `site-header.js`
- `support-widget.css`
- `support-widget.js`
