# Banner release / backup / rollback

Before production migration: retain the currently deployed commit and export the
CMS product banner settings from the existing admin state (read-only). Confirm
whether `homepage_banners` and `homepage_banner_settings` already exist.
The migration can be rerun: it retains initialized settings and banner rows,
creates missing structures only, and replaces functions without reseeding.
The migration only adds these tables and its initialization function. It does
not touch products, stories, orders, payments, or storage bucket policies.

The frontend and banner signing/finalization checks use 20 MiB (20,971,520 bytes).
The shared private bucket also contains story videos, so its global limit must
NOT be reduced to 20 MiB. Confirm a banner-prefix storage-side size restriction
in the real test project before release; this has not been verified locally.
Original images remain intact; lazy loading is used, but no unverified paid
Supabase image-transform service is enabled.

Apply first to an isolated Supabase test project, with the existing private
stories-bucket configuration. Test image upload, retry, mutation and public reads.
Then apply `supabase/migrations/202610040001_homepage_banners.sql` to production.
The first authenticated banner-list read imports the existing enabled product
banners once under a database lock. Public reads retain the old CMS rendering
until that import; an initialized empty list never falls back to old banners.

For later rollback: export BOTH banner tables (CSV or pg_dump) and download only
`homepage-banners/` objects. Redeploy the previous commit, then use
`supabase/rollback/202610040001_homepage_banners.rollback.sql` if appropriate.
Do not delete storage objects or modify the stories bucket configuration.
