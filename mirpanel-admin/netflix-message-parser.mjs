import { allowedConfirmationLink, normalizeGmail } from "./netflix-verification-policy.mjs";
import { verifyForwardingEvidence } from "./netflix-forwarding-verifier.mjs";

// Conservative, fixture-driven parser. It intentionally returns no result unless
// the sender, language/template, source recipient and safe link all match a
// reviewed profile. Real profiles stay disabled until authenticated samples are
// reviewed; this module is not imported by server.mjs.
const SENDER = "info@account.netflix.com";
const PROFILES = Object.freeze([
  { id: "fixture-tr", language: "tr", host: "www.netflix.com", ttlMs: 15 * 60 * 1000, path: "/account/temporary-access", queryKeys: ["token"] },
  { id: "fixture-ru", language: "ru", host: "www.netflix.com", ttlMs: 15 * 60 * 1000, path: "/account/temporary-access", queryKeys: ["token"] },
  { id: "fixture-en", language: "en", host: "www.netflix.com", ttlMs: 15 * 60 * 1000, path: "/account/temporary-access", queryKeys: ["token"] }
]);

const templates = Object.freeze({
  tr: { subject: /^Netflix\s+geçici erişim kodunuz$/i, marker: /kodu\s*al/i },
  ru: { subject: /^Netflix\s+код временного доступа$/i, marker: /получить\s+код/i },
  en: { subject: /^Your Netflix temporary access code$/i, marker: /get\s+code/i }
});

function header(headers, name) {
  const found = (headers || []).find((h) => String(h.name || "").toLowerCase() === name.toLowerCase());
  return String(found?.value || "");
}

function extractLink(body, profile) {
  const match = String(body || "").match(/https:\/\/[^\s<>"']+/i);
  return match ? allowedConfirmationLink(match[0].replace(/[).,]+$/, ""), profile) : null;
}

export function parseNetflixTemporaryAccess(message, { accountEmail, now = Date.now } = {}) {
  const email = normalizeGmail(accountEmail);
  const headers = message?.headers;
  const sender = header(headers, "From").trim().toLowerCase();
  const subject = header(headers, "Subject").trim();
  const source = normalizeGmail(header(headers, "X-Forwarded-For-Account"));
  if (!email || sender !== SENDER || source !== email) return null;
  const body = String(message?.body || "");
  if (!verifyForwardingEvidence(message?.evidence)) return null;
  for (const [language, template] of Object.entries(templates)) {
    if (!template.subject.test(subject) || !template.marker.test(body)) continue;
    const profile = PROFILES.find((item) => item.language === language);
    const sentAt = Number(message?.originalSentAt);
    if (!Number.isSafeInteger(sentAt) || sentAt > now() || now() - sentAt > profile.ttlMs) return null;
    const href = extractLink(body, profile);
    if (!href) return null;
    return Object.freeze({ messageId: String(message.id || ""), profileId: profile.id, language, sourceRecipient: email, originalSentAt: sentAt, href, kind: "temporary_access" });
  }
  return null;
}

export { PROFILES as FIXTURE_PROFILES };
