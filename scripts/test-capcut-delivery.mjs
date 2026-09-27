import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { createPaymentSecurity } from "../mirpanel-admin/payment-security.mjs";

const root = new URL("../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const security = createPaymentSecurity({ encryptionKey: crypto.randomBytes(32).toString("base64"), tokenSecret: crypto.randomBytes(32).toString("base64") });
for (const value of ["capcut.user@example.com", "güclü-Şifrə-123", crypto.randomBytes(36).toString("base64url")]) {
  const cipher = security.encryptSecret(value);
  assert.notEqual(cipher.includes(value), true);
  assert.equal(security.decryptSecret(cipher), value);
}
assert.notEqual(security.hashToken("secret-a"), security.hashToken("secret-b"));

const sql = read("supabase/migrations/202609270003_capcut_delivery.sql");
assert.match(sql, /for update skip locked/i);
assert.match(sql, /CAPCUT_STOCK_EMPTY/);
assert.match(sql, /approve_payment_order_v7/i);
assert.match(sql, /status='cancelled'/i);
assert.match(sql, /account_id uuid unique/i);
assert.match(sql, /token_hash text not null unique/i);
assert.doesNotMatch(sql, /grant select[^;]+(?:anon|authenticated)/i);

const api = read("mirpanel-admin/payment-api.mjs");
assert.match(api, /security\.hashToken\(deliveryMatch\[1\]\)/);
assert.match(api, /customerPhone/);
assert.doesNotMatch(api, /password_cipher[^\n]+publicJson/);

const flow = read("payment-flow.js");
assert.match(flow, /product\.id === "capcut"/);
assert.match(flow, /window\.location\.assign\(order\.deliveryUrl\)/);
assert.match(flow, /customerPhone/);

const page = read("capcut-delivery.js");
assert.match(page, /setInterval\(refresh,4000\)/);
assert.match(page, /60000/);
assert.match(page, /Adminə bildir/);
assert.match(page, /status==="cancelled"/);

console.log("CapCut çatdırılma təhlükəsizlik və axın testləri keçdi.");
