import { CONNECTION_ERROR, RESULT_HEADERS } from "./netflix-verification-policy.mjs";

function writeJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...RESULT_HEADERS });
  response.end(JSON.stringify(body));
}

/**
 * Server-only endpoint factory. It is intentionally not mounted by server.mjs
 * until reviewed profiles and an account repository are available. The default
 * kill switch is false, so accidental deployment cannot expose Gmail data.
 */
export function createNetflixConfirmationEndpoint({ gate, enabled = () => false, rateLimit = () => true } = {}) {
  return async function handle(request, response) {
    if (request.method !== "POST" || request.url !== "/api/netflix/confirmation") return false;
    if (!enabled()) { writeJson(response, 404, { status: "unavailable", message: "Netflix təsdiqi xidməti hazırda aktiv deyil." }); return true; }
    if (!rateLimit(request)) { writeJson(response, 429, { status: "rate_limited", message: "Çox tez-tez sorğu göndərildi. Bir qədər sonra yenidən cəhd edin." }); return true; }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 4096) { writeJson(response, 413, { status: "invalid", message: CONNECTION_ERROR }); return true; } chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const result = await gate(body?.email);
      writeJson(response, result.status === "connection_error" ? 503 : 200, result); return true;
    } catch { writeJson(response, 503, { status: "connection_error", message: CONNECTION_ERROR }); return true; }
  };
}
