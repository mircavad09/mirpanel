# Customer expense report

The expenses tab now uses an owner-scoped read-only report endpoint and a separate UI module. Payment-history and profile-menu modules remain unchanged apart from their existing imports being preserved during merge.

## Financial basis

- One owned payment order is counted once even if owner links or cart lines repeat. Confirmed payment or legacy approved/completed state qualifies; unconfirmed Epoint attempts never qualify. Preparing paid orders qualify.
- Refunds use recorded order refunds and purchase-refund ledger entries, taking their maximum to avoid subtracting the same refund twice. Full refunds leave no net purchase; partial refunds reduce its amount. A paid cancelled order without an actual recorded refund remains a cost until that refund exists.
- Multiple cart lines split the recorded order amount deterministically in integer cents. Verified line cancellation quantities allocate refunds when available; otherwise refunds are proportional with exact integer-cent totals.
- The chart includes the current Baku calendar month and previous eleven months; zero months remain visible. All-time cards include older orders too. Month placement uses recorded electronic paid time when available, otherwise the saved order creation time.
- Savings use only saved oldUnitCents from immutable order/checkout line snapshots. Current catalog prices are never used. Missing historic values remain unknown.
- Provider fees use only the paid product operation's saved feeCents/feeSource. Top-up fees never enter this total. Configured tariffs are labelled estimates and missing coverage is stated. This is not a claim about competitors or legally owed consumer bank fees.
- Categories use actual catalog/saved category labels; unknown categories become Digər. Historical product and package titles remain unchanged. Repurchase links use current catalog availability and matched package identifiers/names, never initiate a purchase.

## Validation

Isolated database, actual public profile/auth route, Chrome and WebKit at 320/390/430/1440 px: empty/paid preparing/completed/unpaid/abandoned, wallet credit then purchase, full/partial refund, multi-line order, duplicate owner links, missing old prices/fees, Baku month/year boundaries, history beyond 30 records, chart focus/click, exact order links, unavailable products, error/retry and cross-account isolation. Only synthetic screenshots are produced. Financial/stock/delivery records are not changed by the report.

The existing full customer-view suite has unrelated legacy Codes fixture failures. Its --expenses mode verifies this task through the actual admin server for two customers, read-only restrictions and all viewport/engine combinations. Payment-history browser regression suite remains separate.
