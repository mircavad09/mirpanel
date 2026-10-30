# Compact owner profile — 2026-10-30

Profile-only follow-up to 28bff73. No community merge, auth policy, checkout,
inventory, order or payment changes.

## Presentation

- Yellow camera glyph inside the existing avatar upload button; original PNG
  admin/tier overlay retained. Cover remains a separate file picker.
- Native collapsible details editor with the existing save/validation API.
  Reset is synchronous before opening, not an asynchronous toggle handler that
  could overwrite newly typed values. Cancel does not save; error keeps inputs.
- Greeting and compact copyable member number below editor. No internal user ID
  is rendered as the visible ID.
- Two-column balance/latest-order/subscription/savings cards. Balance is
  "Tezliklə"; no balance controls or fabricated amount. No proven savings source
  exists in this profile API, so "Məlumat yoxdur" is shown. Latest order still
  comes only from the existing authenticated account-order relationship.

## Display number migration

profile-number-migration.sql extracts only the previously prepared preview
number allocation rule. Private registry and sequence begin at 1001. Existing
accounts ordered by createdAt then immutable ID; future inserts use DB trigger.
Unique constraints and sequence handle concurrent allocation. No cascading FK:
deleted account numbers are retained and never recycled. Existing internal IDs,
roles, profile values, orders and their relationships are untouched.

Apply only after encrypted backup/restore using:
`node scripts/owner-profile-release.mjs prepare numbers`, then `apply numbers`.
Backup stores all community tables encrypted under the protected local backup
root, never in Git. Restore compares row counts/digests before migration.
First/repeat apply and retention-only rollback are checked on that separate DB.
Four verification values must all be true. Rollback is previous application
deployment first; retain registry/sequence/trigger, do not delete/reassign numbers.

## Evidence

- Owner release suite: 461 checks, zero final failures, synthetic accounts only.
- Proxy: 11; inventory upstream regression: 18; both passing.
- Browser widths 320/390/430/768/1024/1440, zero overflow, JS errors, new 404s.
- Save/reload/cancel, avatar-only versus cover-only changes, gallery opening,
  clipboard member number, guest/other-account denial, invalid upload and
  forbidden role/email/user ID changes checked.
- Concurrent six synthetic registrations yielded six distinct numbers; repeat
  migration preserved existing allocations; non-destructive rollback retained all.
- Before/after mobile and after desktop screenshots are synthetic test output.
- Fresh encrypted backup restored 19 community tables with matching digests;
  first/repeat migration and non-destructive rollback passed.
- During preparation a missing FROM in verification SQL and an asynchronous
  editor-reset race were found and corrected; final tests above passed.

No production test profile edit, media upload, account, order, reservation,
receipt, stock, bonus or WhatsApp operation is performed. Live probes must be
read-only or blocked registration, with source/asset version comparison; do not
claim a live authenticated profile mutation test.
