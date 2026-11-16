# Influencer interactive preview

Admin → Qrup söhbəti → **Influencer görünüşünü sına** opens the owner-only test view for member 1554.

## Controls

- Influencer/customer view switches message ownership and disables self-gifting.
- Test balance is editable in AZN. Success debits only the in-memory test balance; stock/error scenarios debit nothing.
- Gift selection supports product search, packages, confirmation, insufficient balance, synthetic top-up, back, cancel and result history.
- Messages support multiline text, Ctrl/Cmd+Enter, public profile display, menu, delete confirmation and tombstone. Only the selected synthetic message changes.
- Banner product, visibility and product-page link are testable. The explicit product-page link opens the real public page in a new tab; it does not purchase anything.
- Reset clears this owner's legacy private preview messages and the current local test messages/gifts. Close, logout, session expiry and admin navigation clear local data and close child dialogs.

## Isolation and shared rendering

The only preview API operations made by the UI are GET catalog/profile and POST `action: reset`. No public message, order, wallet, inventory or notification transport is injected into the gift dialog. Legacy preview storage remains actor/target scoped with RLS and no anonymous/authenticated grants. The catalog response projects display-only fields, excluding supplier credentials and other private product configuration.

The public chat and preview share `messageBubble`. Profile/modal and gift display components are shared, transport-injected modules. **There was no real customer gift execution implementation in the inspected main version.** The new gift UI is therefore an explicitly synthetic workflow, not proof of a production gifting/payment integration. Preview does not change the real user's influencer permissions or real chat.

## Verification

- `node scripts/test-influencer-preview.mjs` against isolated PostgreSQL: target verification, concurrent retry, actor isolation, scoped reset, catalog projection and no public chat/profile writes.
- `node scripts/test-influencer-preview-browser.mjs`: Chromium/WebKit, 320/390/430/1440px, both perspectives, multiline/XSS text, selected-message deletion, gift success/deficit/top-up/stock/error/back/cancel, banner, reset, keyboard Escape, logout and network mutation audit.
- `node scripts/test-group-composer.mjs`: existing public chat composer regression checks with synthetic API data.

Real balances, orders, stock and notifications are not used as test fixtures. An unavailable connected admin browser must be reported separately from these local browser checks.

QA note (2026-11-17): targeted preview PostgreSQL checks, all 8 preview browser combinations (including a 320×640 viewport), double-confirm idempotency and all 8 public composer regressions passed. The broader `test-admin-community.mjs` did **not** complete: it timed out waiting for `.navGroup` visibility at line 89, after logging `REQUEST_FAILED`/`42P01`. This broader result is not counted as a pass. Native browser input also reported `coordinate input geometry is unavailable`; connected browser inventory reported access unavailable. Authenticated live interaction therefore remains separately unverified.
