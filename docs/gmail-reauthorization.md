# Gmail sender reauthorization (local operator handoff)

This is separate from the community Google sign-in client. Do not modify that client, payment keys, or existing callbacks.

Run `node scripts/reauthorize-gmail.mjs` on the authorized Windows workstation. It reads the existing Render Gmail client credentials in memory, listens on loopback only, and expires after 30 minutes. No HTTP request URL logging is enabled.

The existing Gmail OAuth web client must permit exactly:

`http://127.0.0.1:8765/oauth/callback`

Then open `http://127.0.0.1:8765/` on the same workstation. Select the existing sender account (not necessarily the community owner account). Consent requests OpenID email identity and Gmail send only. The callback validates state, exchanges a PKCE code, verifies Google's authenticated email/sub and the send grant. A different sender is rejected.

The refresh token is saved only at `%LOCALAPPDATA%/MirpanelPrivateCredentials/gmail-reauthorized.dpapi`, encrypted with current-user Windows DPAPI and an inheritance-disabled current-user DACL. No SACL/admin privilege is needed. Never copy the file into the repository or upload it. This step does not change Render, send mail, apply SQL, or deploy.

After consent: securely decrypt in memory, prove refresh succeeds, replace only the existing Render `GMAIL_REFRESH_TOKEN`, verify other environment values are unchanged, and perform an explicitly authorized real delivery check. Never print the token or message verification links. A successful mocked mail test or a Google authorization page is not proof of delivery, inbox receipt, or community Google callback completion.

Observed pre-consent checks: local page 200, start redirect 302, Google response contains `redirect_uri_mismatch`. Therefore the loopback callback is not yet authorized and consent has NOT completed. Community Audience 'In production' is user-confirmed, not independently browser-verified. Public rollout remains pending; no production migration/push/deploy in this handoff.
