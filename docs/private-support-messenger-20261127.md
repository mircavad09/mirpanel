# Private support messenger

Scope: existing private customer support and authorized employee/admin desk only. Public chat, payments and delivery are unchanged.

- Customer widget: factual bot/waiting/assigned operator status, minimize/maximize/close, scroll-preserving transcript, new-message indicator, compact topic chips, emoji insertion at the caret and desktop Enter/Shift+Enter composer.
- Shared customer/staff rendering: server-linked reply quote, jump to the original (bounded history loading), real persisted read acknowledgements and protected file downloads.
- JPG/PNG/PDF uploads up to 5 MB are checked server-side and stored in an RLS-protected table. File access always rechecks thread ownership or staff permission. Active PDF action markers and incomplete image trailers are rejected. Files are downloads, never public static URLs. No claim of antivirus scanning is made.
- Message and upload identifiers remain stable across a lost response. Thread locks, immutable payload checks and unique keys prevent duplicate rows. Failed drafts/files remain in memory for explicit retry. Logout/permission revocation clears private drafts and previews.
- Migration is additive and preserves existing transcript rows. Existing bot answers, handoff, claim/transfer rules and notification sound deduplication remain in use.

Validation: local isolated PostgreSQL tests cover ownership, revoked staff, cross-thread quotes/files, parallel upload/message replay and actual read acknowledgements. Browser fixtures use Chrome and WebKit at 320/390/430/1440 px for customer/admin composition, emoji, PDF, staff image preview/upload/download, reply, offline recovery, lost send response, scroll preservation and window controls. Sound tests use mocked audio and cover cross-tab event claims. No live customer messages, payment, balance or delivery writes are part of verification. Physical iPhone/Android keyboard behavior has not been tested.
