import { Buffer } from "node:buffer";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function headerValue(headers, name) {
  const wanted = String(name).toLowerCase();
  const item = (headers || []).find((entry) => String(entry.name || "").toLowerCase() === wanted);
  return item ? String(item.value || "") : "";
}

function decodeBase64Url(value) {
  const raw = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(raw + "=".repeat((4 - raw.length % 4) % 4), "base64").toString("utf8");
}

function flattenParts(part, out = []) {
  if (!part || typeof part !== "object") return out;
  if (part.body?.data) out.push({ mimeType: part.mimeType, text: decodeBase64Url(part.body.data) });
  for (const child of Array.isArray(part.parts) ? part.parts : []) flattenParts(child, out);
  return out;
}

function buildGmailQuery() {
  // User input is deliberately excluded from Gmail search syntax.
  return "from:(info@account.netflix.com) newer_than:2d";
}

export function createNetflixGmailAdapter({
  clientId = process.env.NETFLIX_GMAIL_CLIENT_ID,
  clientSecret = process.env.NETFLIX_GMAIL_CLIENT_SECRET,
  refreshToken = process.env.NETFLIX_GMAIL_REFRESH_TOKEN,
  mailbox = process.env.NETFLIX_GMAIL_MAILBOX,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = 8000,
  maxMessages = 20
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("FETCH_UNAVAILABLE");
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
      const type = String(response.headers?.get?.("content-type") || "application/json").toLowerCase();
      if (!type.includes("application/json")) throw new Error("UPSTREAM_CONTENT_TYPE");
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function accessToken() {
    if (![clientId, clientSecret, refreshToken, mailbox].every((v) => typeof v === "string" && v.trim())) throw new Error("NETFLIX_CONFIG_MISSING");
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
    const token = await request(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (typeof token.access_token !== "string" || !token.access_token) throw new Error("TOKEN_RESPONSE_INVALID");
    return token.access_token;
  }
  return Object.freeze({
    async listRecentMessageIds() {
      const token = await accessToken();
      const url = `${GMAIL_API}/messages?maxResults=${Math.min(50, Math.max(1, maxMessages))}&q=${encodeURIComponent(buildGmailQuery())}`;
      const result = await request(url, { headers: { Authorization: `Bearer ${token}` } });
      return Array.isArray(result.messages) ? result.messages.map((m) => m?.id).filter((id) => typeof id === "string").slice(0, maxMessages) : [];
    },
    async getMessage(id) {
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(String(id))) throw new Error("MESSAGE_ID_INVALID");
      const token = await accessToken();
      const message = await request(`${GMAIL_API}/messages/${encodeURIComponent(id)}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
      const headers = Array.isArray(message.payload?.headers) ? message.payload.headers : [];
      const parts = flattenParts(message.payload);
      return Object.freeze({
        id,
        internalDate: Number(message.internalDate) || 0,
        sender: headerValue(headers, "From"),
        recipients: headerValue(headers, "To"),
        subject: headerValue(headers, "Subject"),
        date: headerValue(headers, "Date"),
        parts
      });
    },
    now
  });
}

export { buildGmailQuery, decodeBase64Url };
