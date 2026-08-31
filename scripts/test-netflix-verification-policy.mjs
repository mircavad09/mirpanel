import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGmail, previewAccountImport, allowedConfirmationLink,
  createConfirmationGate, REVIEWED_NETFLIX_PROFILES, RESULT_HEADERS
} from "../mirpanel-admin/netflix-verification-policy.mjs";

// Entirely synthetic. This path/token/profile is NOT a supported Netflix format.
const profile = Object.freeze({ id: "synthetic-fixture", language: "fixture",
  host: "www.netflix.com", path: "/__synthetic_test_only__", queryKeys: ["token"], ttlMs: 15 * 60_000 });
const clock = Date.UTC(2026, 7, 31, 12);
const accountA = { id: "fixture-a", email: "testfixturea@gmail.com", active: true, version: 1 };
const accountB = { id: "fixture-b", email: "testfixtureb@gmail.com", active: true, version: 1 };
function proof(overrides = {}) {
  return { messageId: "synthetic-message", requestId: "synthetic-request", kind: "temporary_access",
    authenticated: true, forwardingVerified: true, originalTimestampVerified: true,
    sourceRecipientVerified: true, sourceRecipients: [accountA.email], profileId: profile.id,
    language: profile.language, originalSentAt: clock - 60_000,
    href: `https://${profile.host}${profile.path}?token=SYNTHETIC_NOT_A_REAL_TOKEN`, ...overrides };
}
function gate(options = {}) {
  return createConfirmationGate({ getAccount: async email => [accountA, accountB].find(a => a.email === email),
    getCandidates: async () => [proof()], verify: async candidate => candidate,
    profiles: [profile], isEnabled: async () => true, now: () => clock, ...options });
}

test("no reviewed real languages/templates: production remains closed", async () => {
  assert.equal(REVIEWED_NETFLIX_PROFILES.length, 0);
  assert.ok(Object.isFrozen(REVIEWED_NETFLIX_PROFILES));
  assert.equal((await createConfirmationGate({ isEnabled: async () => true })(accountA.email)).status, "unavailable");
});
test("Gmail case, dot, plus and googlemail aliases share one key", () => {
  for (const value of [" Test.Fixture.A+pilot@gmail.com ", "testfixturea@googlemail.com", accountA.email]) {
    assert.equal(normalizeGmail(value), accountA.email);
  }
  assert.notEqual(normalizeGmail(accountA.email), normalizeGmail(accountB.email));
});
test("reject malformed addresses and Gmail query injection", () => {
  for (const value of [null, {}, "a@gmail.com OR newer_than:1d", "a@gmail.com\r\nBcc:b@gmail.com",
    "a..b@gmail.com", ".abc@gmail.com", "abc.@gmail.com", "a@gmail.com.evil", "a@outlook.com",
    "a b@gmail.com", "а@gmail.com", "name <a@gmail.com>", "a".repeat(65) + "@gmail.com", "a+@gmail.com"]) {
    assert.equal(normalizeGmail(value), null);
  }
});
test("bulk import preview counts invalid and duplicate aliases, without mutations", () => {
  const existing = ["testfixtureb@gmail.com"];
  const result = previewAccountImport(`Test.Fixture.A@gmail.com\ntestfixturea+one@googlemail.com\n${accountB.email}\n<script>\n`, existing);
  assert.deepEqual(result.counts, { valid: 1, duplicates: 2, invalid: 1 });
  assert.equal(result.valid[0].email, accountA.email);
  assert.ok(!JSON.stringify(result).includes("<script>"));
  assert.deepEqual(existing, [accountB.email]);
  assert.throws(() => previewAccountImport("a\n".repeat(501)));
  assert.throws(() => previewAccountImport("a".repeat(65537)));
});
test("exact HTTPS host, path and token structure only", () => {
  assert.equal(allowedConfirmationLink(proof().href, profile), proof().href);
  for (const href of [
    "http://www.netflix.com/__synthetic_test_only__?token=X", "//www.netflix.com/__synthetic_test_only__?token=X",
    "https://www.netflix.com.evil.example/__synthetic_test_only__?token=X",
    "https://www.netflix.com@evil.example/__synthetic_test_only__?token=X",
    "https://evil@www.netflix.com/__synthetic_test_only__?token=X",
    "https://www.netflix.com:443/__synthetic_test_only__?token=X",
    "https://www.netflix.com/__synthetic_test_only__?token=X#fragment",
    "https://www.netflix.com/__synthetic_test_only__?token=X&token=Y",
    "https://www.netflix.com/__synthetic_test_only__?token=X&redirect=evil",
    "https://www.netflix.com/__synthetic_test_only__?token=%0d%0a",
    "https://www.netflix.com/__synthetic_test_only__?token=",
    "https://www.netflix.com/reset-password?token=X", "javascript:alert(1)",
    "https://www.netflix.com/a/../__synthetic_test_only__?token=X",
    "https://www.netflix.com\\@evil.example/__synthetic_test_only__?token=X"
  ]) assert.equal(allowedConfirmationLink(href, profile), null, href);
  assert.equal(allowedConfirmationLink(proof().href), null);
});
test("A never receives B, even when upstream candidate indexing is wrong", async () => {
  const result = await gate({ getCandidates: async () => [proof({ sourceRecipients: [accountB.email] })] })(accountA.email);
  assert.equal(result.status, "no_match");
});
test("simultaneous different accounts do not share results", async () => {
  const lookup = gate({ getCandidates: async id => [proof({ sourceRecipients: [id === accountA.id ? accountA.email : accountB.email],
    href: `https://${profile.host}${profile.path}?token=SYNTHETIC_${id === accountA.id ? "A" : "B"}` })] });
  const [a, b] = await Promise.all([lookup(accountA.email), lookup(accountB.email)]);
  assert.equal(a.status, "available"); assert.equal(b.status, "available");
  assert.notEqual(a.href, b.href);
});
for (const [label, overrides] of [
  ["spoofed sender", { authenticated: false }], ["untrusted forwarding", { forwardingVerified: false }],
  ["To alone/body address", { sourceRecipientVerified: false }], ["untrusted date", { originalTimestampVerified: false }],
  ["ambiguous source", { sourceRecipients: [accountA.email, accountB.email] }],
  ["password reset", { kind: "password_reset" }], ["normal login", { kind: "login" }],
  ["household change", { kind: "household_change" }], ["email change", { kind: "email_change" }],
  ["payment mail", { kind: "billing" }], ["unknown language", { language: "unreviewed" }],
  ["unknown template", { profileId: "unreviewed" }], ["missing request identity", { requestId: "" }],
  ["expired", { originalSentAt: clock - profile.ttlMs }], ["future date", { originalSentAt: clock + 1 }],
  ["false delivery freshness", { originalSentAt: clock - profile.ttlMs - 1, centralReceivedAt: clock }]
]) test(`fail closed: ${label}`, async () => {
  assert.equal((await gate({ getCandidates: async () => [proof(overrides)] })(accountA.email)).status, "no_match");
});
test("no real Turkish/Russian/English template is enabled", async () => {
  for (const language of ["tr", "ru", "en"]) {
    assert.equal((await gate({ getCandidates: async () => [proof({ language })] })(accountA.email)).status, "no_match");
  }
});
test("two live requests for one account are blocked; an expired one does not win", async () => {
  const a = proof(); const b = proof({ messageId: "second", requestId: "different" });
  assert.equal((await gate({ getCandidates: async () => [a, b] })(accountA.email)).status, "no_match");
  b.originalSentAt = clock - profile.ttlMs;
  assert.equal((await gate({ getCandidates: async () => [a, b] })(accountA.email)).status, "available");
});
test("duplicate message is not a new result; conflicting duplicate fails closed", async () => {
  const a = proof();
  assert.equal((await gate({ getCandidates: async () => [a, a] })(accountA.email)).status, "available");
  assert.equal((await gate({ getCandidates: async () => [a, proof({ requestId: "different" })] })(accountA.email)).status, "no_match");
});
test("unknown, deleted, inactive accounts have identical public responses", async () => {
  const results = [];
  for (const account of [null, { ...accountA, active: false }, { ...accountA, deletedAt: "2026-08-31" }]) {
    results.push(await gate({ getAccount: async () => account, getCandidates: async () => { throw new Error("must not read"); } })(accountA.email));
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});
test("deactivation/archive after cache lookup blocks stale result", async () => {
  for (const changed of [{ ...accountA, active: false }, { ...accountA, deletedAt: "now" }, { ...accountA, version: 2 }]) {
    let calls = 0;
    assert.equal((await gate({ getAccount: async () => ++calls === 1 ? accountA : changed })(accountA.email)).status, "no_match");
  }
});
test("kill switch checked again immediately before result", async () => {
  let calls = 0;
  assert.equal((await gate({ isEnabled: async () => ++calls === 1 })(accountA.email)).status, "unavailable");
});
test("connection/token/quota/parser errors are not disguised as no mail", async () => {
  for (const dependency of ["getAccount", "getCandidates", "verify"]) {
    const result = await gate({ [dependency]: async () => { throw new Error("SYNTHETIC_SECRET_DO_NOT_REFLECT"); } })(accountA.email);
    assert.equal(result.status, "connection_error");
    assert.ok(!JSON.stringify(result).includes("SYNTHETIC_SECRET"));
  }
});
test("public result contains only minimal confirmation, expiry and safe message", async () => {
  const result = await gate()(accountA.email);
  assert.deepEqual(Object.keys(result).sort(), ["status", "href", "expiresAt", "message"].sort());
  assert.ok(!JSON.stringify(result).includes("@gmail.com"));
  assert.equal(RESULT_HEADERS["Cache-Control"], "no-store");
  assert.equal(RESULT_HEADERS["Referrer-Policy"], "no-referrer");
  assert.ok(RESULT_HEADERS["X-Robots-Tag"].includes("noindex"));
});
