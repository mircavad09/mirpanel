# Registration-code incident — 23 November 2026, Baku

## Scope and evidence boundaries

The recipient is kept only in the private local diagnostic input, not in this public repository. The reported 00:48 screen and 00:49 complaint are provisionally 23 November; the requested window is **22 November 20:35–21:05 UTC = 23 November 00:35–01:05 Baku**. No screenshot file with independently verifiable date metadata was attached to this follow-up. The date must not be treated as established merely by the complaint text.

Read-only production database snapshots at 00:53:35, 00:55:50 and 00:59:20 Baku found no exact recipient in current community users, no pending confirmation whose target address matches it, no dot-normalized Gmail account variant, and no exact recipient in legacy Supabase auth users. The searches of the exact address were not date-limited. Current other registrations existed in the specified window, so the database is live, not an old offline copy. Other recipients' identifiers/receipts are not copied into this report.

**This does not prove zero requests or zero sends.** Verification records are mutable and removed on successful confirmation, and a recipient could have changed address. Exact send/resend count, per-attempt provider response and bounce correlation still require the runtime log and sender mailbox evidence. No incident-specific provider ID has yet been established. A UI acceptance message is not delivery evidence.

The current production registration transport is `createAuthMailer` → Gmail API, independently of the order-mail transport. An incident-specific Gmail acceptance cannot be asserted without the corresponding receipt/log. No evidence currently establishes a typo, full mailbox, spam, quota, revoked authorization, or HTTP 401 as this recipient's cause.

## Version inspection

The active Render runtime before this change reported `2327bf26bae96ad0374e71a9d7124b95eb84deff`. `3347cf1` was not available in the inspected local/common Git history, the other existing local checkout histories, or remote main. GitHub's commit lookup returned HTTP 422, `No commit found for SHA: 3347cf1`. Do not claim that commit was merged or deployed.

Inspection did establish a separate defect in current main: a Gmail send rejected with 401 left the cached access token in use until its local expiry. That is a code-level finding, not the established cause of the reported incident.

## Narrow correction

For registration-code mail only, one explicit Gmail 401 rejection now invalidates the rejected cached token and requests a fresh token through the existing refresh-token grant. The same current request can then send once more. A late 401 from another in-flight request cannot clear a newer token. Concurrent refreshes share the existing pending token request.

There are at most two send attempts per logical call, including any existing short rate-limit retry. No retry is added for timeouts, lost responses, ambiguous 2xx responses or 5xx sends. The current request/hash/expiry guard runs again before token access and before sending. A superseded/expired request does not send a delayed old code. Existing cooldowns, code verification, failed-resend preservation and security limits remain unchanged. No plaintext code queue or new UI text was added. Order/reset/welcome retry rules were not broadened.

This follows Google's documented 401 handling: <https://developers.google.com/workspace/gmail/api/guides/handle-errors#resolve_a_401_error_invalid_credentials>. No OAuth permission, key or sender configuration was changed.

## Isolated tests

- Auth-mail failure suite: 14 checks; one-refresh recovery, persistent-401 stop, failed refresh, parallel refresh coalescing, stale-request refusal, rate/cooldown classification and uncertain-send no-retry. Zero real emails.
- Confirmation delivery-error suite: rejected 401 resend returns 502 / `SEND_REJECTED`, persists failure metadata, removes the pending candidate and keeps the previous accepted code usable. Existing rate-limit, expiry, typo and pending-registration recovery checks included.
- Full confirmation browser suite: 320/1440 signup, refresh, invalid/expired code, resend cooldown, email change, completion, existing-account recovery and synthetic Google states.
- Registration recovery suite: a failed start/send resumes without a duplicate signup. No production account is created, verified or modified by these tests.

## Outstanding incident work

Browser inventory in this run reported `Local browser access is unavailable for this chat`. Native Chrome accessibility reads failed; a reset/reselection did not restore reliable targeting, and a screenshot selected for another window showed the active admin window. No further input was made against an uncertain target. Existing failed Render credentials were not repeatedly retried. A single request to reconnect the sender Gmail and Render Logs browser access was made while database/code tests continued.

The remaining read-only checks are: find the recipient's original/sent/bounce messages in the sender mailbox, capture only envelope/delivery diagnostics (never OTP/body), correlate Gmail provider IDs and UTC timestamps with `COMMUNITY_EMAIL_CONFIRMATION` sending/accepted/failed events, and establish the exact attempt count and incident date. If no recipient Inbox/Spam evidence exists, delivery remains unconfirmed even if Gmail accepted the message.

No new message was sent to the reported customer; their account/verification state was not changed. The previously supplied controlled test address is the protected owner identity, so it was not used to create or alter a disposable registration. A real separate-inbox receipt test remains unperformed in this run.
