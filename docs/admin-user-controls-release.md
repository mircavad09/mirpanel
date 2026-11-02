# Admin user controls release

## Price rule
An owner-admin may save a fixed AZN price for one account and active catalog plan. It replaces the catalog's final price, without stacking another discount. Only new authenticated reservations use it. The reservation amount and account binding are stored atomically alongside the existing inventory reservation. Retries retain that amount; edits to a setting never reprice existing reservations or orders. Guests retain catalog pricing. Zero is allowed; negative or fractional-cent input is rejected.

## Other tabs
Statistics use account-linked order snapshots, actual status and recorded refunds, with Asia/Baku date boundaries. Missing cost/profit and unsupported currency conversion are not invented. Wallet credits are not sales.

Referral percentages are settings only (0–100%). No referral mechanism exists in the current production schema; no commissions or wallet payments are enabled. Clearing the override returns to the unconfigured standard rule. Private support is disabled as Tezliklə. Account view is read-only, not impersonation. Email/login edits remain read-only. Password reset uses the existing verified-email flow; Google-only accounts are directed to Google.

## Database and rollback
Apply community/user-controls-migration.sql only after the encrypted external backup has been restored separately and its matching migration hash verified. Run user-controls-verification.sql (five true results). New tables start empty; no synthetic settings or accounts are copied.

The migration permits nonnegative payment amounts for legitimate zero-priced overrides. It does not modify existing amounts. The data-preserving rollback disables future overrides; settings, audit, existing orders and reservation snapshots remain. Nonnegative constraints remain to preserve legitimate zero-priced history. Deploy the prior application only after disabling overrides; do not remove tables or renumber accounts.

## Evidence
Isolated PostgreSQL: 28 controls assertions and the retained 11 statistics assertions. Server/browser integration: 127 assertions at 390/1440 px. Public community: 221; inventory API: 58; checkout cancellation: 180. Total 625 passing assertions, zero failed in final runs. The controls database suite explicitly uses an inventory RPC fixture, not a production reservation. No real account prices, referrals, balances, bans, emails or orders were changed by tests. External inbox delivery and a real production purchase are not tested.
