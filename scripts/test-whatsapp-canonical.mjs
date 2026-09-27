import assert from "node:assert/strict";
import { buildCanonicalWhatsApp } from "../mirpanel-admin/payment-api.mjs";

const result = buildCanonicalWhatsApp({
  order_code: "10234",
  product_title: "Netflix Şəxsi",
  plan_name: "1 aylıq",
  amount: 5.99,
  currency: "AZN"
}, "ABB •••• 7663", "Profil adı: Aysel\n4 rəqəmli PIN: 1234", "+994 (51) 524-35-45");

const url = new URL(result.whatsappUrl);
assert.equal(url.protocol, "https:");
assert.equal(url.hostname, "wa.me");
assert.equal(url.pathname, "/994515243545");
assert.equal(url.searchParams.get("text"), result.whatsappMessage, "Mesaj yalnız bir dəfə encode edilməlidir");
for (const value of ["10234", "Netflix Şəxsi", "1 aylıq", "5.99 AZN", "ABB •••• 7663", "Profil adı: Aysel", "4 rəqəmli PIN: 1234"]) {
  assert.ok(result.whatsappMessage.includes(value), `${value} canonical mesajda yoxdur`);
}
assert.equal(result.whatsappMessage.includes("4169 0000 0000"), false);
console.log(JSON.stringify({ ok: true, canonicalHttps: true, encodedOnce: true, unicode: true, maskedPayment: true }));
