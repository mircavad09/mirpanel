# Admin session outage mitigation — 2026-11-28

Status: local patch tested; NOT deployed; live blocking PID and admin recovery NOT verified.

Evidence from authorized read-only production checks:
- Last fetched origin/main and observed live Render: cb1a5813. Earlier incident observation: 1dd20975.
- Legacy mirpanel.onrender.com is a relay to Frankfurt. Anonymous /admin.html redirects to login on both. Existing normal sign-in check returned 500.
- Supabase REST/Auth health requests and admin_session_action read timed out. Direct configured PostgreSQL connection later opened in ~0.5s and SELECT 1 completed in ~0.3–1.1s. pg_stat_activity/pg_stat_get_activity read hit 3s statement timeout. No blocking PID was established; no query cancellation or termination performed.
- Supplied provider logs show lock/statement timeouts, PGRST003, 504 and repeated DDL. Render logs independently show upstream timeouts in multiple DB readers. Exact initiating live transaction is still unproven.

Confirmed code defects addressed:
- private-support and support-push setup ran BEGIN/COMMIT SQL via pool.query without guaranteed same-connection ROLLBACK after errors. Failed setup cache entries were removed, allowing repeated attempts.
- Runtime initialization retried with new pools immediately after failure; seller setup and mail telemetry repeated schema DDL. Renewal/seller work could start before remaining startup setup succeeded.

Patch:
- Dedicated setup connection/transaction, bounded setup lock + statement/idle timeout, rollback on all error paths, connection destroy if rollback fails.
- Version/checksum ledger for exact setup body; parallel process coordination and same-process coalescing; 30s failure cooldown; schema versions include seller trigger target relations so newly installed targets retain guards.
- Prepare support push before starting dependent workers. Start existing workers only after runtime setup succeeds.
- Fail-closed 503 HTML with retry for browser admin navigation on ADMIN_SESSION_STORE_UNAVAILABLE; API semantics and authorization unchanged. This is not a substitute for DB recovery.

Local checks: 22 schema/concurrency/timeout/rollback/pool saturation/start order checks; 24 real PostgreSQL admin session checks; 61 private support checks; 29 file ACL/replay checks; 22 support queue checks; 102 seller/security/browser checks. All on isolated databases; production financial/message writes zero. Full admin browser server test could not start because the current workspace dependency junction lacks pdfkit (not a production startup claim).

Remaining: inspect actual live pg_locks/pg_blocking_pids and source process after approval service is available, review current main, deploy only this patch, verify authorized live admin and health for several minutes. Automatic approval review blocked the last live read with a usage-limit/review failure; it was not an unsafe-action judgment. No workaround or live mutation attempted.


Continuation 2026-11-28:
- Permission review available again. origin/main and Render still cb1a5813 before rollout.
- Installed exact package-lock dependencies with npm ci into an isolated local runtime and replaced only this worktree node_modules junction; shared prior junction retained. No manifest or lockfile change. pdfkit 0.21.0 now loads.
- Actual server + browser + isolated PostgreSQL test: 31 checks passed including valid sign-in, anonymous/employee rejection, session expiry/restart, transient session store outage fails closed with 503 HTML, and recovery uses the same valid session.
- Schema test extended to two OS processes plus a third restart: applied once; rollback-failure destroys connection. Total 24 checks passed. 61 support and 29 media checks passed again.
- Current production session/transaction-pool probes still time out. No blocking PID identified and no production cancellation/termination issued. Rollout only replaces this application's old process, never terminates arbitrary DB sessions.
