import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { receiptFromBuffer } from "../mirpanel-admin/payment-security.mjs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PAYMENT_FIXTURE_PORT || 4179);
const reservationId = "11111111-1111-4111-8111-111111111111";
const methodId = "22222222-2222-4222-8222-222222222222";
let activeReservations = 0;
let cancelCalls = 0;
let successfulCancellations = 0;
let completedUses = 0;
let reservationCalls = 0;
let orderCalls = 0;
let lastUpload = null;
let failNextOrder = false;
let failuresLeft = 0;
const reservations = new Map();
const orders = new Map();
const keys = [];
let failNextCancel = false;

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  response.end(JSON.stringify(value));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const html = `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/payment-flow.css"><style>body{margin:0;background:#050505;color:#fff;font-family:Arial,sans-serif}.modal{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.75)}.modalCard{width:min(620px,calc(100vw - 28px));max-height:calc(100dvh - 20px);overflow:auto;background:#111;border-radius:16px;padding:14px}.hidden{display:none}</style></head><body><button id="start">Başla</button><div id="modal" class="modal"><div class="modalCard"><div id="mForm"></div></div></div><script>window.MIRPANEL_PAYMENT_API="http://127.0.0.1:${port}";</script><script src="/payment-flow.js"></script><script>document.getElementById("start").onclick=()=>window.MirpanelPaymentFlow.start({product:{id:"test",title:"Test məhsul"},plan:{name:"1 aylıq",price:5.99},planIndex:0}).then(order=>window.__paymentOrder=order);document.getElementById("start").click();</script></body></html>`;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html); return; }
  if (url.pathname === "/payment-flow.js" || url.pathname === "/payment-flow.css") {
    const file = path.join(root, url.pathname.slice(1));
    response.writeHead(200, { "Content-Type": url.pathname.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8" });
    response.end(fs.readFileSync(file)); return;
  }
  if (url.pathname === "/api/payments/methods") {
    json(response, 200, { anyAvailable: true, methods: [{ id: methodId, displayName: "ABB", providerName: "ABB", type: "card", last4: "4655", color: "#174f91", theme: "abb", available: true }] }); return;
  }
  if (url.pathname === "/api/payments/reservations" && request.method === "POST") {
    const input = await body(request);
    reservationCalls += 1;
    activeReservations = 1;
    const existing = [...reservations.values()].find(r => r.checkoutKey === input.checkoutKey);
    const value = existing || { reservationId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), amount: 5.99, currency: "AZN", method: { id: methodId, displayName: "ABB", providerName: "ABB", holderName: "MIRPANEL TEST", number: "4169 0000 0000 4655", type: "card", color: "#174f91", theme: "abb" } };
    reservations.set(value.reservationId, {...value, checkoutKey:input.checkoutKey});
    json(response, 201, value); return;
  }
  if (url.pathname === "/api/payments/checkout/resume") {
    const input = await body(request);
    const value = reservations.get(input.reservationId);
    if (!value || value.checkoutKey !== input.checkoutKey) { json(response,404,{error:"Rezerv tapılmadı"}); return; }
    const order = orders.get(input.reservationId);
    if (order) { json(response,200,{state:"submitted",order:{...order,idempotent:true}}); return; }
    json(response,200,{state:"reserved",productId:"test",planIndex:0,reservation:value}); return;
  }
  if (url.pathname === "/api/payments/orders" && request.method === "POST") {
    orderCalls += 1;
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const contentType = String(request.headers["content-type"] || "");
    const form = await new Request("http://localhost/api/payments/orders", { method: "POST", headers: { "Content-Type": contentType }, body: Buffer.concat(chunks) }).formData();
    const receipt = form.get("receipt");
    lastUpload = {
      contentType,
      idempotencyKey: String(request.headers["x-idempotency-key"] || ""),
      receiptType: receipt?.type || "",
      receiptSize: Number(receipt?.size || 0),
      reservationId: String(form.get("reservationId") || ""),
      productId: String(form.get("productId") || "")
    };
    keys.push(lastUpload.idempotencyKey);
    if (failuresLeft > 0) { failuresLeft--; json(response,503,{error:"Sınaq upload xətası"}); return; }
    try { receiptFromBuffer(Buffer.from(await receipt.arrayBuffer()),receipt.type); }
    catch(error) { json(response,error.status || 400,{error:error.message}); return; }
    const existingOrder = orders.get(lastUpload.reservationId);
    if (existingOrder) { json(response,200,{...existingOrder,idempotent:true}); return; }
    activeReservations = 0;
    const order = { orderId: crypto.randomUUID(), orderCode: String(971 + orders.size), status: "reviewing", paymentMethod: "ABB", productTitle:"Test məhsul",planName:"1 aylıq",amount:5.99,currency:"AZN", receiptUploaded: true };
    orders.set(lastUpload.reservationId,order);
    json(response, 201, order); return;
  }
  if (url.pathname === "/api/payments/reservations/cancel" && request.method === "POST") {
    const payload = await body(request);
    cancelCalls += 1;
    if (!reservations.has(payload.reservationId)) { json(response, 400, { error: "Yanlış rezerv" }); return; }
    if (failNextCancel) { failNextCancel = false; json(response, 503, { error: "Sınaq server xətası" }); return; }
    const idempotent = activeReservations === 0;
    if (!idempotent) { activeReservations = 0; successfulCancellations += 1; }
    json(response, 200, { ok: true, cancellation: { id: reservationId, status: "cancelled", idempotent } }); return;
  }
  if (url.pathname === "/test/fail-next-cancel" && request.method === "POST") { failNextCancel = true; json(response, 200, { ok: true }); return; }
  if (url.pathname === "/test/fail-next-order" && request.method === "POST") { failuresLeft = Number(url.searchParams.get("count") || 2); json(response, 200, { ok: true }); return; }
  if (url.pathname === "/test/state") { json(response, 200, { activeReservations, completedUses, reservationCalls, orderCalls, lastUpload, cancelCalls, successfulCancellations, failNextCancel, failNextOrder, uniqueOrders:orders.size, keys }); return; }
  if (url.pathname === "/test/shutdown" && request.method === "POST") { json(response, 200, { ok: true }); setImmediate(() => server.close()); return; }
  response.writeHead(404); response.end("Not found");
});

server.listen(port, "127.0.0.1", () => console.log(`payment fixture http://127.0.0.1:${port}`));
