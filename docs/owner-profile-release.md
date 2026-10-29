# Owner profile release — 2026-10-30

Selected from preserved development commit 808e7d1a765eb5af3ee9fcddaebcddfc6a694944.
Not a community merge. Base production includes inventory hotfix 0e7eac1.

## Included

Existing profile edit UI (names, readonly Google email, unverified international
phone/WhatsApp, HTTPS host-allowlisted social links), cancel/save/error behavior,
avatar and cover selection with existing PNG tier/admin overlays. Profile identity,
order summary, subscription placeholder and shared navigation preserved. No member
number/presence/badges/balance expansion is included. Google owner binding and
closed email/password signup are byte-identical.

Preview stored files on private local disk. Production storage adapter instead
commits sanitized media bytes and profile pointer atomically in private PostgreSQL
profile_media. Render ephemeral disk and restricted Supabase Storage API are not
used for these small profile images. No existing file is moved/deleted. No new paid
service or environment key. Input max5MiB JPEG/PNG/WebP, decoded max16M pixels and
10K side; child-process heap128MiB, 10s timeout, max2 processes and one in-flight per
user/kind. Rotate/crop/re-encode to 320x320 /1200x400 WebP, max2MiB output. Metadata
and active source payload are not served. Failed process/write leaves old image.

All APIs require the same server-verified owner identity and exact mutation Origin.
ID in request body cannot redirect an edit. Media lookup checks both media ID and
session user ID; private/no-store, no sniffing; no public Storage URL. Private
contact fields are never selected by group publicProfiles. Role/email cannot be
changed via profile POST.

## Database and recovery

mirpanel-admin/community/profile-migration.sql: transaction + advisory lock, seven
optional profile columns, private media table and manifest. No public business
table touched. profile-verification.sql: four true results (columns ready, original
profile fields preserved, RLS, anon/authenticated no media SELECT).
profile-rollback.sql is non-destructive: roll back app version first, retain new
fields/media; previous app ignores additions. No SQL drop/delete/reset.

scripts/owner-profile-release.mjs prepare creates a fresh DPAPI CurrentUser encrypted
dump under the existing owner-only local backup root, restores into an isolated
local database with no application attached, checks every row digest/count across
17 community tables. Referenced public order IDs are private FK stubs, not imported
orders. No Storage media download. First/repeat migration, verification and
retention-only rollback tested there. Initial test-tool timezone and connection
pool mismatches were corrected before production application.

Production migration applied with verified backup prerequisite; all four verification
results true. Original profile data preserved. No test account/order/reservation/
receipt/stock/bonus/WhatsApp operation created in production.

## Verification

Owner release + profile browser integration: 447 checks passed (synthetic-only,
320/360/390/430/768/1024/1440, PNG/JPEG/WebP decode/storage/authorized read, malicious
SVG and oversized payload rejection, save/cancel/refresh, foreign account 403,
readonly email and privilege-forgery prevention, shared navigation/chat regressions).
Owner proxy 11; inventory reader18; inventory API58. Existing cancel/browser tests
also run separately. Real production Google consent and profile writes are not
performed as tests. Final live verification is read-only: deployed revisions,
closed signup, guest/forged-session denial, correct media proxy path and versioned
assets. Existing unrelated Supabase traffic restriction must not be represented
as fixed by this profile release.
