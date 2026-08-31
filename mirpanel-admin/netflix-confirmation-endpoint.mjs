import { CONNECTION_ERROR, RESULT_HEADERS } from "./netflix-verification-policy.mjs";

function corsHeaders(request, allowedOrigins) {
  const origin = String(request.headers?.origin || "");
  if (!origin || !allowedOrigins.has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

function writeJson(request, response, status, body, allowedOrigins) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...RESULT_HEADERS, ...corsHeaders(request, allowedOrigins) });
  response.end(JSON.stringify(body));
}

/**
 * Server-only endpoint factory. It is intentionally not mounted by server.mjs
 * until reviewed profiles and an account repository are available. The default
 * kill switch is false, so accidental deployment cannot expose Gmail data.
 */
export function createNetflixConfirmationEndpoint({ gate, enabled = () => false, rateLimit = () => true, allowedOrigins = [] } = {}) {
  const origins = new Set(allowedOrigins);
  return async function handle(request, response) {
    if (request.url !== "/api/netflix/confirmation") return false;
    const origin = String(request.headers?.origin || "");
    if (origin && !origins.has(origin)) { writeJson(request, response, 403, { status: "forbidden" }, origins); return true; }
    if (request.method === "OPTIONS") {
      if (!origin) return false;
      response.writeHead(204, { ...RESULT_HEADERS, ...corsHeaders(request, origins), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
      response.end(); return true;
    }
    if (request.method !== "POST") return false;
    if (!enabled()) { writeJson(request, response, 404, { status: "unavailable", message: "Netflix təsdiqi xidməti hazırda aktiv deyil." }, origins); return true; }
    if (!rateLimit(request)) { writeJson(request, response, 429, { status: "rate_limited", message: "Çox tez-tez sorğu göndərildi. Bir qədər sonra yenidən cəhd edin." }, origins); return true; }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 4096) { writeJson(request, response, 413, { status: "invalid", message: CONNECTION_ERROR }, origins); return true; } chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const result = await gate(body?.email);
      writeJson(request, response, result.status === "connection_error" ? 503 : 200, result, origins); return true;
    } catch { writeJson(request, response, 503, { status: "connection_error", message: CONNECTION_ERROR }, origins); return true; }
  };
}
