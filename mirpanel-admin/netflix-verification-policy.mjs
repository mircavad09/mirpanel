// Isolated pilot policy, NOT a mail authenticator or an enabled public endpoint.
// A production verifier must first prove raw-message authenticity, forwarding,
// signed source recipient, template and original timestamp. Never construct
// evidence from customer input or trust an Authentication-Results string alone.

export const REVIEWED_NETFLIX_PROFILES = Object.freeze([]);
// Sanitized parser-only profiles. These are deliberately not trusted by the
// production gate: they contain synthetic tokens and cannot prove a real
// Netflix forwarding template or link contract.
export const REVIEWED_NETFLIX_FIXTURE_PROFILES = Object.freeze([
  { id: "fixture-tr", language: "tr", host: "www.netflix.com", path: "/account/temporary-access", queryKeys: ["token"], ttlMs: 15 * 60 * 1000 },
  { id: "fixture-ru", language: "ru", host: "www.netflix.com", path: "/account/temporary-access", queryKeys: ["token"], ttlMs: 15 * 60 * 1000 },
  { id: "fixture-en", language: "en", host: "www.netflix.com", path: "/account/temporary-access", queryKeys: ["token"], ttlMs: 15 * 60 * 1000 }
]);
export const NO_CONFIRMATION = "Yeni uyğun təsdiq tapılmadı. Netflix-də e-poçtla təsdiq göndərilməsini seçib yenidən yoxlayın.";
export const CONNECTION_ERROR = "Təsdiq xidmətinə qoşulmaq mümkün olmadı. Bir qədər sonra yenidən cəhd edin.";
export const RESULT_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff"
});

export function normalizeGmail(value) {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  // ASCII only: no display names, URL syntax, controls or Unicode lookalikes.
  const match = /^([a-z0-9]+(?:\.[a-z0-9]+)*)(?:\+([a-z0-9][a-z0-9._-]*))?@(gmail\.com|googlemail\.com)$/.exec(email);
  if (!match || email.split("@")[0].length > 64) return null;
  return `${match[1].replaceAll(".", "")}@gmail.com`;
}

export function previewAccountImport(text, existing = []) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 64 * 1024) {
    throw new Error("Siyahı çox böyükdür. Bir dəfəyə ən çox 500 ünvan əlavə edin.");
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > 500) throw new Error("Bir dəfəyə ən çox 500 sətir əlavə edin.");
  const seen = new Set();
  for (const value of existing) {
    const normalized = normalizeGmail(value);
    if (normalized) seen.add(normalized);
  }
  const result = { valid: [], duplicates: [], invalid: [] };
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    const email = normalizeGmail(lines[index]);
    const line = index + 1;
    if (!email) {
      // Do not reflect arbitrary invalid input into the future admin UI/logs.
      result.invalid.push({ line, reason: "Gmail ünvanı düzgün deyil." });
    } else if (seen.has(email)) {
      result.duplicates.push({ line, email });
    } else {
      seen.add(email);
      result.valid.push({ line, email });
    }
  }
  result.counts = {
    valid: result.valid.length, duplicates: result.duplicates.length,
    invalid: result.invalid.length
  };
  return result;
}

// Exact profiles are supplied only from reviewed server code, never the API or
// an admin-editable arbitrary URL. There are currently NO production profiles.
export function allowedConfirmationLink(value, profile) {
  if (typeof value !== "string" || value.length > 4096 ||
      !value.startsWith("https://") || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!profile || !["netflix.com", "www.netflix.com"].includes(profile.host) ||
      typeof profile.path !== "string" || !profile.path.startsWith("/") ||
      !Array.isArray(profile.queryKeys) || !profile.queryKeys.length) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== profile.host ||
        url.username || url.password || url.port || url.hash || url.pathname !== profile.path) return null;
    // Do not accept normalized host/path spellings, explicit ports, dot segments,
    // percent-encoded paths or a different URL that happens to normalize identically.
    if (value.split("?")[0] !== `https://${profile.host}${profile.path}`) return null;
    const entries = [...url.searchParams.entries()];
    if (entries.length !== profile.queryKeys.length || new Set(entries.map(([key]) => key)).size !== entries.length) return null;
    for (const [key, token] of entries) {
      if (!profile.queryKeys.includes(key) || !/^[A-Za-z0-9_-]{1,2048}$/.test(token)) return null;
    }
    return url.href;
  } catch { return null; }
}

function noMatch() { return { status: "no_match", message: NO_CONFIRMATION }; }

/**
 * The injected verifier is a SERVER-ONLY trust boundary; this gate cannot
 * authenticate Gmail. Tests inject synthetic evidence, not real email claims.
 * Production wiring is deliberately absent until raw forwarded samples and
 * their DKIM/ARC/recipient provenance are verified. No To/From/body fallback.
 */
export function createConfirmationGate({
  getAccount, getCandidates, verify, profiles = REVIEWED_NETFLIX_PROFILES,
  isEnabled = async () => false, now = Date.now
}) {
  return async function lookup(input) {
    try {
      if (!await isEnabled() || !profiles.length) {
        return { status: "unavailable", message: "Netflix təsdiqi xidməti hazırda aktiv deyil." };
      }
      const email = normalizeGmail(input);
      if (!email) return noMatch();
      const account = await getAccount(email);
      if (!account || account.active !== true || account.deletedAt || account.email !== email) return noMatch();
      const candidates = await getCandidates(account.id);
      if (!Array.isArray(candidates) || candidates.length > 50) throw new Error("CANDIDATE_SOURCE_INVALID");
      const usable = new Map();
      for (const candidate of candidates) {
        const proof = await verify(candidate);
        if (!proof || proof.authenticated !== true || proof.forwardingVerified !== true ||
            proof.originalTimestampVerified !== true || proof.sourceRecipientVerified !== true ||
            proof.kind !== "temporary_access" || !Array.isArray(proof.sourceRecipients) ||
            proof.sourceRecipients.length !== 1 || normalizeGmail(proof.sourceRecipients[0]) !== email ||
            typeof proof.messageId !== "string" || !proof.messageId ||
            typeof proof.requestId !== "string" || !proof.requestId) continue;
        const profile = profiles.find(item => item.id === proof.profileId && item.language === proof.language);
        if (!profile || !Number.isSafeInteger(profile.ttlMs) || profile.ttlMs <= 0) continue;
        // Original authenticated send time, NEVER central-inbox arrival time.
        const sentAt = proof.originalSentAt;
        const expiresAt = sentAt + profile.ttlMs;
        if (!Number.isSafeInteger(sentAt) || sentAt > now() || !Number.isSafeInteger(expiresAt) || expiresAt <= now()) continue;
        const href = allowedConfirmationLink(proof.href, profile);
        if (!href) continue;
        const previous = usable.get(proof.messageId);
        if (previous && (previous.href !== href || previous.requestId !== proof.requestId || previous.sentAt !== sentAt)) return noMatch();
        usable.set(proof.messageId, { href, sentAt, expiresAt, requestId: proof.requestId });
      }
      const matches = [...usable.values()].sort((a, b) => b.sentAt - a.sentAt);
      if (!matches.length) return noMatch();
      // Distinct outstanding requests may belong to distinct customers/devices.
      // Never choose the mailbox's newest message merely because it is newest.
      if (new Set(matches.map(item => item.requestId)).size !== 1 ||
          new Set(matches.map(item => item.href)).size !== 1) return noMatch();
      const latest = matches[0];
      // Recheck AFTER cache/read/verification: archive/disable wins over cache.
      const current = await getAccount(email);
      if (!await isEnabled()) return { status: "unavailable", message: "Netflix təsdiqi xidməti hazırda aktiv deyil." };
      if (!current || current.id !== account.id || current.email !== email || current.active !== true ||
          current.deletedAt || current.version !== account.version || latest.expiresAt <= now()) return noMatch();
      // No address, message body, profile, device, location, usage guarantee or
      // central mailbox identifiers may cross the customer response boundary.
      return { status: "available", href: latest.href, expiresAt: new Date(latest.expiresAt).toISOString(),
        message: "Uyğun müvəqqəti təsdiq keçidi tapıldı. Keçidin artıq istifadə olunub-olunmadığı məlum deyil." };
    } catch {
      // Never return upstream OAuth errors, messages, tokens or addresses.
      return { status: "connection_error", message: CONNECTION_ERROR };
    }
  };
}
