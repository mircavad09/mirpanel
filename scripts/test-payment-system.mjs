import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPaymentSecurity,
  detectReceiptType,
  receiptFromPayload
} from "../mirpanel-admin/payment-security.mjs";
import { paymentEmailContent } from "../mirpanel-admin/payment-mail.mjs";
import { commercialSnapshot } from "./payment-commercial-snapshot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const expectedSnapshot = "e496120a2b9db0319d466b65b7735cd1dcc734dd8f201bcc9d1faf17fb652abf";

function expectThrow(fn, pattern) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert.ok(thrown, "Xəta gözlənilirdi");
  if (pattern) assert.match(thrown.message, pattern);
}

const encryptionKey = crypto.randomBytes(32).toString("base64");
const tokenSecret = crypto.randomBytes(32).toString("base64");
const security = createPaymentSecurity({ encryptionKey, tokenSecret });
const fullNumber = "4169 7412 3456 7890";
const ciphertext = security.encryptNumber(fullNumber);
assert.equal(security.decryptNumber(ciphertext), "4169741234567890");
assert.equal(ciphertext.includes("4169741234567890"), false);
const encryptedParts = ciphertext.split(".");
const tamperedBytes = Buffer.from(encryptedParts[3], "base64url");
tamperedBytes[0] ^= 1;
const tampered = [encryptedParts[0], encryptedParts[1], encryptedParts[2], tamperedBytes.toString("base64url")].join(".");
expectThrow(() => security.decryptNumber(tampered));
assert.equal(security.hashToken("one-time-token"), security.hashToken("one-time-token"));
assert.notEqual(security.hashToken("one-time-token"), "one-time-token");

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5, 6, 7]);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(8)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(4)]);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", "ascii");
assert.equal(detectReceiptType(jpeg).mimeType, "image/jpeg");
assert.equal(detectReceiptType(png).mimeType, "image/png");
assert.equal(detectReceiptType(webp).mimeType, "image/webp");
assert.equal(detectReceiptType(pdf).mimeType, "application/pdf");
assert.equal(receiptFromPayload({ mimeType: "application/pdf", contentBase64: pdf.toString("base64") }).extension, "pdf");
expectThrow(() => receiptFromPayload({ mimeType: "image/png", contentBase64: jpeg.toString("base64") }), /real format/i);
expectThrow(() => receiptFromPayload({ mimeType: "application/pdf", contentBase64: Buffer.from("%PDF-1.7\n/OpenAction /JavaScript", "ascii").toString("base64") }), /Aktiv məzmun/i);
expectThrow(() => receiptFromPayload({ mimeType: "image/jpeg", contentBase64: Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString("base64") }), /5 MB/i);

const migration = read("supabase/migrations/202608070001_payment_system.sql");
for (const required of [
  "enable row level security",
  "revoke all on all tables in schema public from anon, authenticated",
  "public.consume_payment_rate_limit",
  "public.reserve_payment_method",
  "public.submit_payment_order",
  "public.approve_payment_order",
  "public.reject_payment_order",
  "public.consume_payment_review_token",
  "public.replace_payment_order_receipt",
  "payment_receipt_tokens",
  "for update",
  "mirpanel-payment-receipts",
  "false, 5242880"
]) assert.ok(migration.includes(required), `Migration hissəsi çatışmır: ${required}`);
assert.equal((migration.match(/'bank_card'|'wallet'/g) || []).length >= 6, true);
assert.equal((migration.match(/false, [1-6]\)/g) || []).length, 6, "İlkin üsullar deaktiv olmalıdır");
assert.equal(/\b(?:[0-9][ -]?){12,19}\b/.test(migration.replace(/00000000-0000-4000-8000-[0-9]{12}/g, "")), false, "Tam kart nömrəsi migration-a düşməməlidir");

const api = read("mirpanel-admin/payment-api.mjs");
const store = read("mirpanel-admin/payment-store.mjs");
const flow = read("payment-flow.js");
const confirmation = read("order-confirmation.js");
const server = read("mirpanel-admin/server.mjs");
const index = read("index.html");
const paymentAdmin = read("mirpanel-admin/public/payment-admin.js");
assert.ok(api.includes("catalogSelection"));
assert.ok(api.includes("consentAccepted !== true"));
assert.ok(api.includes("createSignedUrl") === false, "Signed URL yalnız store qatında olmalıdır");
assert.ok(store.includes("createSignedUrl"));
assert.ok(store.includes("consume_payment_review_token"));
assert.ok(store.includes("result.diagnostic"));
assert.ok(api.includes('request.method === "POST" && url.pathname === "/api/admin/payment-review-token"'));
assert.ok(flow.includes('accept="image/jpeg,image/png,image/webp,application/pdf"'));
assert.ok(flow.includes("if (!flow.receipt || !flow.reservation)"));
assert.ok(flow.includes("/api/payments/replacement-receipts"));
assert.ok(flow.includes("paymentReceiptToken"));
assert.ok(flow.includes("Göndər və WhatsApp-a keç"));
assert.ok(confirmation.includes("Ödəniş çeki Mirpanel sisteminə yüklənib"));
assert.ok(confirmation.includes("İstifadə qaydaları və şərtlər qəbul edildi: Bəli"));
assert.ok(server.includes("await paymentSystem.guardLogin(request)"));
assert.ok(server.includes("requireMutationAuth"));
assert.ok(index.includes("payment-flow.css"));
assert.ok(index.includes("payment-flow.js"));
assert.ok(paymentAdmin.includes("paymentActionDialog"));
assert.equal(/\bprompt\s*\(/.test(paymentAdmin), false, "Ödəniş adminində native prompt istifadə edilməməlidir");
assert.ok(paymentAdmin.includes("body.reason = reason"));

const mail = paymentEmailContent({
  order: { order_code: "MP-A1B2C3", product_title: "Test", plan_name: "1 aylıq", amount: 5.99, currency: "AZN", created_at: new Date().toISOString() },
  method: { display_name: "ABB •••• 4655" },
  reviewUrl: "https://mirpanel.onrender.com/admin/review?token=safe-token",
  recipient: "admin@example.com",
  fromName: "Mirpanel"
});
assert.ok(mail.textBody.includes("MP-A1B2C3"));
assert.ok(mail.htmlBody.includes("Sifarişi yoxla"));
assert.equal(mail.textBody.includes(fullNumber.replaceAll(" ", "")), false);
assert.ok(read("mirpanel-admin/payment-mail.mjs").includes('Content-Transfer-Encoding: base64'));
assert.ok(read("mirpanel-admin/payment-mail.mjs").includes("payload?.error?.errors?.[0]?.reason"));

const snapshot = commercialSnapshot();
assert.equal(snapshot.productCount, 30);
assert.equal(snapshot.activeProductCount, 21);
assert.equal(snapshot.sha256, expectedSnapshot, "Kommersiya/CMS snapshot dəyişib");

for (const file of [
  "mirpanel-admin/payment-api.mjs",
  "mirpanel-admin/payment-mail.mjs",
  "mirpanel-admin/payment-security.mjs",
  "mirpanel-admin/payment-store.mjs",
  "mirpanel-admin/public/payment-admin.js",
  "payment-flow.js",
  "payment-flow.css",
  "supabase/migrations/202608070001_payment_system.sql"
]) {
  const value = read(file);
  assert.equal(value.includes("\uFFFD"), false, `${file}: UTF-8 replacement simvolu var`);
  assert.equal(/(?:SUPABASE_SECRET_KEY|GMAIL_CLIENT_SECRET|GMAIL_REFRESH_TOKEN|PAYMENT_ENCRYPTION_KEY_B64)\s*[=:]\s*["'][^"']{8}/.test(value), false, `${file}: məxfi dəyər aşkarlandı`);
}

console.log(JSON.stringify({
  ok: true,
  tests: 46,
  commercialSnapshot: snapshot.sha256,
  products: snapshot.productCount,
  activeProducts: snapshot.activeProductCount,
  receiptTypes: ["JPG", "PNG", "WEBP", "PDF"],
  rls: true,
  privateBucket: true
}, null, 2));
