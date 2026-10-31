# First-visit intro — 2026-10-31

Keep the existing logo, wordmark, subtitle, colours, sizing and CSS animation.
There is no separate video file/source in the production repository or its splash
history; do not invent a replacement video. If a video element is supplied, the
existing playback error/rejection fail-open remains in place.

The previous global window error/rejection handlers could hide the animation
because an unrelated background component failed. Remove that coupling. The
independent 3000 ms deadline and 2950 ms CSS exit reveal the page without waiting
for catalogue, banner or story readiness. Reduced motion stays short.

The same sessionStorage marker and secure SameSite session-cookie fallback are
kept. Mark before showing so reload, navigation and back/forward cannot replay it.
Existing visitors whose session has already seen the intro do not see it again.
No page-data loading is blocked or delayed; homepage media improvements are kept.

Tests: `node scripts/test-intro-session.mjs` — 33 assertions, zero failures,
390/1440 px. Old-code premature dismissal reproduced; patched version retains
the intro despite an unrelated error. Observed first durations 2974/2967 ms.
Checks include background loading, reload, internal routes, back/forward, new tab
and simulated video failure. Navigation documents in this component suite are
synthetic; `check-intro-live.mjs` separately verifies actual guest production
routes without mutations. No test creates production orders, reservations,
uploads or WhatsApp messages.

No migration, auth-policy change or protected-preview changes.
