# Registration-code incident — 23 November 2026, Baku

## Scope and evidence boundaries

The recipient is kept only in the private local diagnostic input, not in this public repository. The reported 00:48 screen and 00:49 complaint are provisionally 23 November; the requested window is **22 November 20:35–21:05 UTC = 23 November 00:35–01:05 Baku**. No screenshot file with independently verifiable date metadata was attached to this follow-up. The date must not be treated as established merely by the complaint text.

Read-only production database snapshots at 00:53:35, 00:55:50 and 00:59:20 Baku found no exact recipient in current community users, no pending confirmation whose target address matches it, no dot-normalized Gmail account variant, and no exact recipient in legacy Supabase auth users. The searches of the exact address were not date-limited. Current other registrations existed in the specified window, so the database is live, not an old offline copy. Other recipients' identifiers/receipts are not copied into this report.

**This does not prove zero requests or zero sends.** Verification records are mutable and removed on successful confirmation, and a recipient could have changed address. A UI acceptance message is not delivery evidence. Subsequent runtime correlation below found the 00:48 event and an address discrepancy without printing either actual address.

The current production registration transport is `createAuthMailer` → Gmail API, independently of the order-mail transport. Actual configuration read through the authorized Render API confirmed registration Gmail configuration and `ORDER_MAIL_PROVIDER=resend`. No evidence establishes a full mailbox, spam, quota, revoked authorization, or HTTP 401 as this recipient's cause.

## Runtime correlation completed without a browser

The official existing Render CLI automatically refreshed its existing credential. Its logs command then reported no selected workspace, rather than a renewed authentication failure. A read of the service's own workspace ID enabled direct authorized API log reads; no workspace permissions, persistent access grants or service configuration were changed.

The complete, non-truncated 20:35–21:05 UTC confirmation-log response contains four sends across three accounts, all accepted, with no failed/uncertain event. The **only 20:48 send** belongs to the same account as a 20:42 send:

| Baku time, 23 November | Send start (UTC) | Acceptance (UTC) | Gmail provider ID |
| --- | --- | --- | --- |
| 00:42:27 | 20:42:27.881584911 | 20:42:28.265151437 | `1a204fef7cbc2b6a` |
| 00:48:01 | 20:48:01.666016286 | 20:48:02.046797485 | `1a205040e85f8c04` |

The second provider ID exactly matches the account's current verification record. Its accepted timestamp is 20:48:02.039 UTC. The account was created at 19:55:04.478 UTC (22 November 23:55 Baku), remains unverified, and has no subsequent account update in this snapshot. This aligns the reported screen time with **23 November**, without asserting screenshot-file metadata that was not supplied.

The current pending recipient differs from the address supplied in the complaint by **one extra character in the local part**, not just case, dots or Gmail plus-alias normalization. The pending recipient's domain is `gmail.com`. The account's registration address is also different from its pending verification address. This establishes an address mismatch in the stored confirmation target; it does not establish whether the different mailbox exists or bounced. The first send's historical envelope is not retained in the current mutable verification record and is not inferred from the second send.

There are **two send attempts for this account in the specified window**, both accepted by Gmail; neither contains an explicit provider 401 failure. A count for the exact supplied address over all time cannot be established from address-free logs after mutable/deleted verification records. No unrelated account's provider IDs are presented here.

Read-only production proof at 01:07:52 Baku reported live runtime `130bcecd90c521d9197e6237d2d265f61113d68a`, confirming the narrow token correction was deployed. This is not a claim that the incident itself was caused by the token defect.

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

## Gmail grant and outstanding delivery evidence

Browser inventory reported `Local browser access is unavailable for this chat`. Native Chrome accessibility reads failed; a reset/reselection did not restore reliable targeting, and a screenshot selected for another window showed the active admin window. No further input was made against an uncertain target. After the owner instructed API-only continuation, browser work stopped. Existing failed Render credentials were not repeatedly retried; the official CLI's normal credential renewal restored authorized API access.

The configured Gmail refresh grant was actually exercised without sending mail: HTTP 200, scopes `openid`, `userinfo.email`, and **`gmail.send` only**. No `gmail.readonly`, `gmail.modify` or full-mail grant is present. No mailbox-read API call was attempted with that send-only grant. Thus sent-message envelopes, bounces and recipient Inbox/Spam arrival remain unverified; the application acceptance receipt is not a delivery receipt.

Remaining owner action: in the sender's already authorized Gmail, inspect the sent verification message around **23 November 00:48 Baku**, and the corresponding mailer-daemon delivery report if present. Provide only the recipient/header and SMTP diagnostic portion with all OTP/body content removed. Do not forward the code. This is needed to prove the envelope and whether a bounce occurred without expanding API permission. The customer can correct their confirmation target themselves; this audit does not alter it or initiate a resend.

No new message was sent to the reported customer; their account/verification state was not changed. The previously supplied controlled test address is the protected owner identity, so it was not used to create or alter a disposable registration. A real separate-inbox receipt test remains unperformed in this run.
