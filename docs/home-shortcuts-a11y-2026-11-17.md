# Home shortcut image roles and Bing's 12 notices

The user identified Bing's inspected HTML as 21 images and the twelve notices as the six shortcut images repeated twice. The live DOM/source mapping is `#homeQuickLinks .home-quick-group:nth-child(1) img` (six) plus `#homeQuickLinks .home-quick-group:nth-child(2) img` (six). The four initial product-card images already have descriptive alternatives and are not part of this group.

## Role decisions

Each shortcut logo is inside the same anchor as a visible product name; it provides no extra status, package detail or action. All twelve remain decorative, with `alt=""`, `role="presentation"` and an `aria-hidden` logo wrapper. No informational image in this strip needs an extra alternative repeating its adjacent text. W3C WAI's decorative-image and functional-image examples explicitly support an empty alternative for an image accompanying sufficient text in the same link:

- https://www.w3.org/WAI/tutorials/images/decorative/#example-2-decorative-image-as-part-of-a-text-link
- https://www.w3.org/WAI/tutorials/images/functional/#example-2-logo-image-within-link-text

The visible name supplies the primary link's accessible name without a redundant aria-label. Full product identities are used: Netflix Şəxsi and Netflix Ümumi no longer both become “Netflix” after hydration. `home-shortcuts.js` supplies identical names/logos to the HTML generator and client renderer.

The visual duplicate group stays `aria-hidden="true"`; its links are also explicitly hidden and have `tabindex="-1"`. They remain pointer-operable to preserve the scrolling strip. Primary links have explicit `tabindex="0"`, which also prevents WebKit's default link-tab preference from skipping the strip. The fallback when the helper script fails is to retain the accessible server HTML rather than replacing it.

## Verification and limitations

`test-home-shortcuts-a11y.mjs` checks initial/hydrated parity, all twelve image roles, six accessible links (not twelve), no exposed decorative images, six keyboard focus stops, no duplicate keyboard stops, and a working pointer link in the duplicate. Chrome and WebKit pass at 390/1440px. This tests the accessibility representation and keyboard navigation; it is not an NVDA/VoiceOver speech recording.

`audit-home-shortcuts.mjs` checks the real live initial HTML and hydrated views, including Chrome's actual accessibility-tree link names. It writes `outputs/seo/shortcuts-live.json` after deployment. Bing's Live URL warning must be reported independently: a missing-alt checker can still flag valid empty decorative alternatives, and no Bing warning should be declared cleared solely because attributes exist. Until a fresh Live URL result is observed, which of its twelve notices persist remains unconfirmed.
