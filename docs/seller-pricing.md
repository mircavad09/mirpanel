# Seller package prices

Seller status is a separate customer-pricing setting, not an authentication,
moderation or employee role. Only the existing owner-admin controls endpoint can
write it. Removing the status retains stored overrides but selects catalog prices.

## Release

Apply `mirpanel-admin/community/seller-pricing-migration.sql` to the community
database before deploying the application. It is additive and repeatable, keeps
the existing `user_controls_release` value, and enables seller pricing for legacy
override accounts. Explicitly disabled accounts remain disabled on reruns.
The settings table has RLS and no public/anon/authenticated privileges.

The same seller condition applies to cart checkout, subscription options and the
legacy reservation function. Already created reservations and orders retain their
existing monetary snapshots. Price and role writes use the existing audit table,
including actor, target, creation time and before/after values.

Private display prices use a credentialed, no-store endpoint. They are kept in
document memory only. Account changes invalidate price/quote caches and in-flight
responses; cart contents stay intact. New packages have a pricing UUID; changing
their base price or stock does not change that UUID. Legacy package signatures
continue to work until a package is replaced.

## Admin use

Open **İstifadəçilər → user detail → Xüsusi qiymətlər**. Enable **Satıcı**, choose
the product and package, enter the customer's AZN price, and select **Qiyməti
saxla**. Saved rows can be reopened with **Redaktə et**. Packages without an
override use their normal price. Disabling **Satıcı** pauses all saved overrides.

## Verification

Run `scripts/test-seller-pricing.mjs`, `scripts/test-user-controls.mjs` and
`scripts/test-subscriptions.mjs` against a disposable local PostgreSQL fixture.
`MIRPANEL_SHOP_TEST_PORT` can select the existing loopback test instance.
`scripts/test-seller-pricing-browser.mjs` verifies Chrome and WebKit at mobile and
desktop sizes, including save/reload, delayed responses, account changes and a
prefilled payment screen. All synthetic business records stay in that fixture.
