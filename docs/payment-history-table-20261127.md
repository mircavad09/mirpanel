# Payment history and immutable attempt numbers

The payment history now has a compact header, four whole-history statistics,
amount/number search, counted status/purpose dropdowns and desktop table rows.
Mobile rows retain all six fields without horizontal scrolling. Dropdowns support
arrow keys, Home/End, Enter, Escape, Tab and outside dismissal. Retry links only
navigate to the existing checkout/top-up flow; they do not initiate payments.

The server searches integral cents for both decimal comma and decimal point.
Failed filtering includes cancelled attempts, without rewriting their stored
status. Global statistics are calculated before filtering and pagination. Facet
counts respect the other filters. Existing status/late-callback projections remain
authoritative; this release does not settle or fail provider transactions.

## Numbering

The existing `balance_operation_numbers` mapping and allocator are reused. Epoint
product purchases were excluded from their initial plan/checkout trigger and their
order codes were being presented as attempt numbers. Both are now included in the
same sequence as balance attempts. A purchase receives its number when the owned
purchase row is persisted, even before the provider request is issued. The later
request/intent/callback shares that ID and cannot allocate another number.

The read-only production preflight found 883 distinct provider/manual-top-up
attempts, 729 mappings, highest number 1327, next number 1328, 154 unmapped attempts,
and zero number collisions. New activity can advance these figures before release.

The migration:

- preserves every existing mapping, including the earlier 599-based sequence;
- starts at 1000 only when no number has ever been allocated;
- respects both the mapping maximum and the durable counter high-water mark;
- assigns missing records in creation-time, UUID and source order;
- installs insert triggers on requests, purchases and legacy intents, and the
  existing submitted-manual-top-up trigger;
- serializes allocation and protects it with a global unique number constraint;
- keeps mappings for deleted/cancelled attempts and never fills allocation gaps;
- records the pre-migration mapping, existing/proposed numbers and rollback note
  in the private `balance_number_migration_backup` row `all-attempts-v2`.

Order numbers remain separate. Customer history and admin operations read the same
attempt mapping; order links are shown inside the purpose details. No amounts,
balances, stock, provider settings or disabled payment methods are changed.

Rollback is a presentation rollback to the previous application. Retain the
mapping and counter as audit records; never delete or recycle allocated numbers.
The migration is transactional and repeat-safe, so an interrupted installation
either rolls back completely or is recognized on the next startup.

## Verification

- `test-payment-history-projection.mjs`: global sums, decimal amounts, number
  search, combined facets, cancelled grouping, pagination and empty results.
- `test-all-payment-numbers.mjs` and its fresh-process restart helper: existing
  numbers/high-water mark, chronological backfill, 20 concurrent inserts, repeated
  settlement, non-reuse, admin/customer agreement and account isolation.
- `test-balance-unified-numbers.mjs`: fresh 1000 start, manual submission, all
  purposes, document consistency and permissions.
- Existing payment-history, Google Pay lifecycle, purchase and finance tests.
- `test-payment-history-table-browser.mjs`: Chrome/WebKit at 320/390/430/1440,
  dropdown keyboard/outside controls, counted filtering, both amount formats,
  pagination, summary stability, safe retry navigation and full profile shell.

All test identities and provider transports are isolated. Screenshots use synthetic
records and `example.invalid` account data; no real payment or order is created.
