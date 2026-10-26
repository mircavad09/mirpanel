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
