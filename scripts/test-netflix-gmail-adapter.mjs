import assert from "node:assert/strict";
import test from "node:test";
import { createNetflixGmailAdapter, buildGmailQuery, decodeBase64Url } from "../mirpanel-admin/netflix-gmail-adapter.mjs";
import { createNetflixConfirmationEndpoint } from "../mirpanel-admin/netflix-confirmation-endpoint.mjs";
import { parseNetflixTemporaryAccess } from "../mirpanel-admin/netflix-message-parser.mjs";
import { createNetflixAccountRepository } from "../mirpanel-admin/netflix-account-repository.mjs";
import { verifyForwardingEvidence } from "../mirpanel-admin/netflix-forwarding-verifier.mjs";
import { createNetflixRequestGuard } from "../mirpanel-admin/netflix-request-guard.mjs";
import fs from "node:fs/promises";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => "application/json" }, json: async () => body });
const calls = [];
const fakeFetch = async (url, options = {}) => {
  calls.push({ url, options });
  if (url === "https://oauth2.googleapis.com/token") return json({ access_token: "synthetic-access-token" });
  if (url.includes("/messages?")) return json({ messages: [{ id: "abc_123" }, { id: "bad" }] });
  if (url.includes("/messages/abc_123")) return json({ id: "abc_123", internalDate: "1720000000000", payload: { headers: [
    { name: "From", value: "info@account.netflix.com" }, { name: "To", value: "forwarded@example.invalid" }, { name: "Subject", value: "Netflix temporary access" }
  ], parts: [{ mimeType: "text/plain", body: { data: "VGVzdCBtYWls" } }] } });
  throw new Error("unexpected fixture request");
};

test("query never contains customer input", () => assert.equal(buildGmailQuery(), "from:(info@account.netflix.com) newer_than:2d"));
test("base64url decoder is deterministic", () => assert.equal(decodeBase64Url("VGVzdCBtYWls"), "Test mail"));
test("adapter exchanges readonly refresh token and returns bounded metadata", async () => {
  calls.length = 0;
  const adapter = createNetflixGmailAdapter({ clientId: "id", clientSecret: "secret", refreshToken: "refresh", mailbox: "mircavad0009@gmail.com", fetchImpl: fakeFetch });
  assert.deepEqual(await adapter.listRecentMessageIds(), ["abc_123", "bad"]);
  const message = await adapter.getMessage("abc_123");
  assert.deepEqual(message, { id: "abc_123", internalDate: 1720000000000, sender: "info@account.netflix.com", recipients: "forwarded@example.invalid", subject: "Netflix temporary access", date: "", parts: [{ mimeType: "text/plain", text: "Test mail" }] });
  assert.equal(calls.filter((c) => c.url === "https://oauth2.googleapis.com/token").length, 2);
  assert.ok(!JSON.stringify(calls).includes("mircavad0009@gmail.com"));
});
test("invalid message ids fail before upstream request", async () => {
  const adapter = createNetflixGmailAdapter({ clientId: "id", clientSecret: "secret", refreshToken: "refresh", mailbox: "box", fetchImpl: fakeFetch });
  await assert.rejects(() => adapter.getMessage("../secret"), /MESSAGE_ID_INVALID/);
});
test("endpoint stays closed while feature flag is false", async () => {
  let status; let payload;
  const response = { writeHead: (code) => { status = code; }, end: (value) => { payload = JSON.parse(value); } };
  const request = { method: "POST", url: "/api/netflix/confirmation", async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ email: "pilot@gmail.com" })); } };
  const handled = await createNetflixConfirmationEndpoint({ gate: async () => ({ status: "available" }) })(request, response);
  assert.equal(handled, true);
  assert.equal(status, 404);
  assert.equal(payload.status, "unavailable");
});

const fixture = (language, subject, marker) => ({ id: `fixture-${language}`, headers: [
  { name: "From", value: "info@account.netflix.com" },
  { name: "Subject", value: subject },
  { name: "X-Forwarded-For-Account", value: "pilot@gmail.com" }
], body: `${marker}: https://www.netflix.com/account/temporary-access?token=SYNTHETIC_${language.toUpperCase()}`, originalSentAt: 1700000000000, evidence: { dkim: "pass", arc: "pass", forwarded: true, sourceRecipientVerified: true, signedHeaders: ["from", "date", "message-id"], messageId: `m-${language}`, originalSentAt: 1700000000000 } });
for (const [language, subject, marker] of [["tr", "Netflix geçici erişim kodunuz", "Kodu Al"], ["ru", "Netflix код временного доступа", "получить код"], ["en", "Your Netflix temporary access code", "Get Code"]]) {
  test(`sanitized ${language} temporary-access fixture is accepted`, () => {
    const result = parseNetflixTemporaryAccess(fixture(language, subject, marker), { accountEmail: "pilot@gmail.com", now: () => 1700000005000 });
    assert.equal(result.language, language);
    assert.equal(result.sourceRecipient, "pilot@gmail.com");
    assert.match(result.href, /^https:\/\/www\.netflix\.com\/account\/temporary-access\?token=SYNTHETIC_/);
  });
}
for (const [name, subject, body] of [
  ["password reset", "Netflix password reset", "reset password"],
  ["ordinary login", "Your Netflix sign-in code", "Get Code"],
  ["household", "Netflix household update", "Get Code"],
  ["spoofed sender", "Netflix geçici erişim kodunuz", "Kodu Al"]
]) {
  test(`${name} fixture is rejected`, () => {
    const message = fixture("tr", subject, body);
    if (name === "spoofed sender") message.headers[0].value = "info@account.netflix.com.evil.example";
    assert.equal(parseNetflixTemporaryAccess(message, { accountEmail: "pilot@gmail.com", now: () => 1700000005000 }), null);
  });
}
test("wrong source account and expired fixture are rejected", () => {
  assert.equal(parseNetflixTemporaryAccess(fixture("en", "Your Netflix temporary access code", "Get Code"), { accountEmail: "other@gmail.com", now: () => 1700000005000 }), null);
  assert.equal(parseNetflixTemporaryAccess(fixture("en", "Your Netflix temporary access code", "Get Code"), { accountEmail: "pilot@gmail.com", now: () => 1700001000000 }), null);
});
test("account repository normalizes, deactivates and soft-deletes without exposing secrets", async () => {
  const repo = createNetflixAccountRepository(new Map());
  const first = await repo.add("Pilot.User+test@gmail.com");
  assert.equal(first.account.email, "pilotuser@gmail.com");
  assert.equal((await repo.add("pilotuser@gmail.com")).duplicate, true);
  assert.equal((await repo.get("pilot.user@gmail.com")).active, true);
  await repo.setActive("pilotuser@gmail.com", false);
  assert.equal((await repo.get("pilotuser@gmail.com")).active, false);
  await repo.remove("pilotuser@gmail.com");
  const removed = await repo.get("pilotuser@gmail.com");
  assert.equal(removed.active, false);
  assert.ok(removed.deletedAt);
});

test("forwarding verifier fails closed and requires normalized DKIM/ARC evidence", () => {
  const valid = { dkim: "pass", arc: "pass", forwarded: true, sourceRecipientVerified: true, signedHeaders: ["from", "date", "message-id"], messageId: "m", originalSentAt: 1 };
  assert.equal(verifyForwardingEvidence(valid), true);
  assert.equal(verifyForwardingEvidence({ ...valid, dkim: "fail" }), false);
  assert.equal(verifyForwardingEvidence({ ...valid, signedHeaders: ["from"] }), false);
});

test("request guard rate-limits and deduplicates in-flight work with short cache", async () => {
  const guard = createNetflixRequestGuard({ windowMs: 1000, max: 1, cacheTtlMs: 1000 });
  assert.equal(guard.allow("fixture-ip"), true);
  assert.equal(guard.allow("fixture-ip"), false);
  let runs = 0;
  const work = () => { runs += 1; return new Promise((resolve) => setTimeout(() => resolve("ok"), 5)); };
  assert.equal(await Promise.all([guard.singleFlight("k", work), guard.singleFlight("k", work)]).then((v) => v[0]), "ok");
  assert.equal(runs, 1);
  guard.setCached("c", { safe: true });
  assert.deepEqual(guard.getCached("c"), { safe: true });
});

test("Supabase migration is idempotent in shape and denies public table access", async () => {
  const sql = await fs.readFile(new URL("../supabase/migrations/20260831_netflix_accounts.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.netflix_accounts/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for all to anon using \(false\) with check \(false\)/i);
  assert.match(sql, /for all to authenticated using \(false\) with check \(false\)/i);
  assert.match(sql, /grant select, insert, update on table public\.netflix_accounts to service_role/i);
});
