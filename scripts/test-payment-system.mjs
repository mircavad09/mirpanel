import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPaymentSecurity,
  detectReceiptType,
  receiptFromBuffer,
  receiptFromPayload
} from "../mirpanel-admin/payment-security.mjs";
import { paymentOrderFromMultipart } from "../mirpanel-admin/payment-api.mjs";
import { paymentEmailContent } from "../mirpanel-admin/payment-mail.mjs";
import { commercialSnapshot } from "./payment-commercial-snapshot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const expectedSnapshot = "0bee312869703b8caeff684ba36268eb8cf6ea6973a98b6381576f9f2022d86b";

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

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5, 0xff, 0xd9]);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(4), Buffer.from("IHDR"), Buffer.alloc(8)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([8, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(4)]);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", "ascii");
assert.equal(detectReceiptType(jpeg).mimeType, "image/jpeg");
assert.equal(detectReceiptType(png).mimeType, "image/png");
assert.equal(detectReceiptType(webp).mimeType, "image/webp");
assert.equal(detectReceiptType(pdf).mimeType, "application/pdf");
assert.equal(receiptFromPayload({ mimeType: "application/pdf", contentBase64: pdf.toString("base64") }).extension, "pdf");
assert.equal(receiptFromBuffer(jpeg, "image/jpeg").extension, "jpg");
expectThrow(() => receiptFromPayload({ mimeType: "image/png", contentBase64: jpeg.toString("base64") }), /real format/i);
expectThrow(() => receiptFromPayload({ mimeType: "application/pdf", contentBase64: Buffer.from("%PDF-1.7\n/OpenAction /JavaScript\n%%EOF", "ascii").toString("base64") }), /Aktiv məzmun/i);
expectThrow(() => receiptFromPayload({ mimeType: "image/jpeg", contentBase64: Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString("base64") }), /5 MB/i);
expectThrow(() => receiptFromBuffer(Buffer.from([0xff, 0xd8, 0xff, 0, 1, 2, 3, 4, 5, 6, 7, 8]), "image/jpeg"), /zədələnib/i);
expectThrow(() => receiptFromBuffer(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)]), "image/png"), /zədələnib/i);

const multipart = new FormData();
multipart.append("reservationId", "11111111-1111-4111-8111-111111111111");
multipart.append("productId", "test-product");
multipart.append("planIndex", "2");
multipart.append("consentAccepted", "true");
multipart.append("receipt", new Blob([png], { type: "image/png" }), "receipt.png");
const multipartRequest = new Request("http://localhost/api/payments/orders", { method: "POST", body: multipart });
const parsedMultipart = await paymentOrderFromMultipart(Buffer.from(await multipartRequest.arrayBuffer()), multipartRequest.headers.get("content-type"), 5 * 1024 * 1024);
assert.equal(parsedMultipart.body.productId, "test-product");
assert.equal(parsedMultipart.body.planIndex, "2");
assert.equal(parsedMultipart.body.consentAccepted, true);
assert.equal(parsedMultipart.receipt.mimeType, "image/png");

const migration = read("supabase/migrations/202608070001_payment_system.sql");
const checkoutMigration = read("supabase/migrations/202608080001_payment_checkout_reservations.sql");
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
for (const required of [
  "checkout_key uuid",
  "payment_reservations_one_active_checkout_idx",
  "status in ('reserved', 'reviewing')",
  "reserve_payment_method_v2",
  "pg_advisory_xact_lock",
  "p_previous_reservation_id",
  "RESERVATION_ALREADY_SUBMITTED",
  "reservation.replaced",
  "payment_methods_theme_check"
]) assert.ok(checkoutMigration.includes(required), `Checkout migration hissəsi çatışmır: ${required}`);

const api = read("mirpanel-admin/payment-api.mjs");
const store = read("mirpanel-admin/payment-store.mjs");
const flow = read("payment-flow.js");
const flowCss = read("payment-flow.css");
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
assert.ok(flow.includes("new FormData()"), "Çek birbaşa multipart FormData ilə göndərilməlidir");
assert.ok(flow.includes('formData.append("receipt", flow.receipt'), "Orijinal File obyekti FormData-ya əlavə edilməlidir");
assert.equal(flow.includes("FileReader"), false, "Yeni çek axını FileReader-dən asılı olmamalıdır");
assert.equal(flow.includes("contentBase64"), false, "Yeni çek axını base64 yaratmamalıdır");
assert.ok(flow.includes("URL.createObjectURL(file)"));
assert.ok(flow.includes("URL.revokeObjectURL(flow.receiptPreviewUrl)"));
assert.ok(flow.includes("Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin."));
assert.ok(flow.includes("if (!flow.receipt || !flow.reservation)"));
assert.ok(flow.includes('const CHECKOUT_STORAGE_KEY = "mirpanel-payment-checkout-v1"'));
assert.ok(flow.includes("previousReservationId: flow.reservation?.reservationId || flow.previousReservationId || null"));
assert.ok(flow.includes("checkoutKey: flow.checkoutKey"));
assert.ok(flow.includes("choices.replaceChildren()"), "Kart seçiləndən sonra seçimlər DOM-dan çıxarılmalıdır");
assert.ok(flow.includes('id="changePaymentMethod"'));
assert.ok(flow.includes("Əvvəlki rezerv təhlükəsiz ləğv edilir"));
assert.ok(flow.includes('data-payment-stage="payment_method_selection"'));
assert.ok(flow.includes('setStage(flow, "payment_details")'));
assert.ok(flow.includes('setStage(flow, "receipt_upload")'));
assert.ok(flow.includes("Ödənişi tamamlamaq üçün qalan vaxt"));
assert.ok(flow.includes('role="timer"'));
assert.ok(flow.includes("Bu gün limit dolub"));
assert.equal(flow.includes("pendingReservations"), false, "Müştəri rezerv sayğacını görməməlidir");
assert.equal(flow.includes("method.remaining"), false, "Müştəri qalan limit sayğacını görməməlidir");
assert.ok(flow.includes('id="paymentReceiptForm"'));
assert.ok(flow.includes('id="paymentSubmit" type="submit"'));
assert.ok(flow.includes('addEventListener("submit", async (event)'));
assert.ok(flow.includes("event.preventDefault()"));
assert.ok(flow.includes("if (flow.submitting) return"));
assert.equal(flow.includes("/api/payments/replacement-receipts"), false, "İşləməyən yeni çek axını qalmamalıdır");
assert.equal(flow.includes("paymentReceiptToken"), false, "İşləməyən yeni çek tokeni qalmamalıdır");
assert.ok(flow.includes("Göndər və WhatsApp-a keç"));
assert.ok(confirmation.includes("Ödəniş çeki Mirpanel sisteminə yüklənib"));
assert.ok(confirmation.includes("İstifadə qaydaları və şərtlər qəbul edildi: Bəli"));
assert.ok(confirmation.includes("window.location.href = whatsappUrl"), "WhatsApp eyni tabda açılmalıdır");
assert.ok(confirmation.includes("https://wa.me/${phone}?text=${encodeURIComponent(message)}"));
assert.ok(confirmation.includes('verified.hostname !== "wa.me"'));
assert.ok(confirmation.includes('target="_self">WhatsApp-a keç</a>'));
assert.equal(confirmation.includes("closeOrderModal();\n    window.location"), false, "WhatsApp keçidindən əvvəl modal bağlanmamalıdır");
assert.equal(confirmation.includes('window.open(url, "_blank"'), false, "Async WhatsApp popup istifadə edilməməlidir");
assert.ok(server.includes("await paymentSystem.guardLogin(request)"));
assert.ok(server.includes("requireMutationAuth"));
assert.ok(server.includes('Supabase server key format:'));
assert.equal(server.includes("config.supabaseSecretKey.slice"), false);
assert.ok(index.includes("payment-flow.css"));
assert.ok(index.includes("payment-flow.js"));
assert.match(index, /order-confirmation\.js\?v=[a-z0-9-]+/i, "Yayımlanmış sifariş skripti keş versiyası ilə qoşulmalıdır");
assert.equal(index.includes("hbo-max-order-fix.js"), false, "Ana səhifədə legacy məhsul handler-i qalmamalıdır");
assert.equal(api.includes("pendingReservations: method.pendingReservations"), false, "Rezerv sayı public API-yə çıxmamalıdır");
assert.equal(api.includes("remaining: method.remaining"), false, "Qalan limit public API-yə çıxmamalıdır");
assert.ok(api.includes("checkoutKey"));
assert.ok(store.includes('rpc("reserve_payment_method_v2"'));
assert.ok(paymentAdmin.includes('name="theme"'), "Bank mövzusu admin paneldə seçilə bilməlidir");
assert.ok(paymentAdmin.includes("Bu gün tamamlanıb:"));
assert.ok(paymentAdmin.includes("Aktiv rezerv:"));
assert.ok(paymentAdmin.includes("Son sıfırlanma:"));
for (const theme of ["theme-leo", "theme-abb", "theme-kapital", "theme-m10", "theme-neutral"]) {
  assert.ok(flowCss.includes(theme), `Ödəniş kartı mövzusu çatışmır: ${theme}`);
}
assert.ok(flowCss.includes("safe-area-inset-bottom"));
assert.ok(flowCss.includes("paymentMagneticStripe"));
assert.ok(flowCss.includes("payment-timer-pulse"));
assert.ok(flowCss.includes("aspect-ratio:1.586/1"), "Ödəniş kartı standart nisbətdə olmalıdır");
assert.ok(flowCss.includes("max-width:380px"), "Ödəniş kartı maksimum 380px olmalıdır");
assert.ok(flowCss.includes('grid-template-areas:"top top" "stripe stripe" "holder amount" "number number" "timer timer"'), "Kartın daxili yığcam layout-u çatışmır");
assert.ok(flow.includes('window.location.href = "https://mirpanel.com/"'), "Uğurlu ləğvdən sonra eyni tabda ana səhifəyə keçilməlidir");
assert.ok(flow.includes('await finish(null, { cancel: true, redirectHome: true })'), "Ləğv server təsdiqindən sonra yönləndirməlidir");
assert.ok(flow.includes('event.preventDefault();\n              if (flow.cancelling || flow.submitting) return;'), "Ləğv düyməsi standart submit-i və təkrar kliki bloklamalıdır");
assert.ok(flow.includes('window.confirm("Aktiv rezerv ləğv ediləcək.'), "X düyməsi aktiv rezerv barədə xəbərdarlıq etməlidir");
assert.ok(api.includes("{ ok: true, cancellation }"), "Server ləğv nəticəsini brauzerə təsdiqləməlidir");
assert.ok(paymentAdmin.includes("paymentActionDialog"));
assert.equal(/\bprompt\s*\(/.test(paymentAdmin), false, "Ödəniş adminində native prompt istifadə edilməməlidir");
assert.equal(paymentAdmin.includes("data-request-receipt"), false, "Yeni çek tələb et düyməsi qalmamalıdır");
assert.equal(paymentAdmin.includes("data-cancel-payment-reservation"), false, "Ayrıca rezerv ləğvi düyməsi qalmamalıdır");
assert.equal(paymentAdmin.includes('label: "Rədd səbəbi"'), false, "Rədd səbəbi soruşulmamalıdır");
assert.ok(paymentAdmin.includes("Bu sifarişi rədd etmək istəyirsiniz?"));
assert.ok(paymentAdmin.includes("orderActions: new Set()"), "Təkrar admin klikləri brauzerdə bloklanmalıdır");
assert.ok(paymentAdmin.includes('window.open("about:blank", "_blank")'), "Çek tabı istifadəçi klikində dərhal açılmalıdır");
assert.ok(paymentAdmin.includes("receiptWindow.location.replace(result.url)"), "İmzalı çek URL-si əvvəlcədən açılmış taba yazılmalıdır");
assert.ok(paymentAdmin.includes("else window.location.assign(result.url)"), "Popup bloklanarsa çek eyni tabda açılmalıdır");
assert.equal(api.includes("new-receipt|cancel-reservation"), false, "İşləməyən admin route-ları qalmamalıdır");
assert.ok(store.includes('p_reason: "Admin tərəfindən rədd edildi."'), "Rədd əməliyyatı sistem qeydi yazmalıdır");
const capacityMigration = read("supabase/migrations/202608090003_payment_method_capacity_and_admin.sql");
const cancelRpcSql = capacityMigration.match(/create or replace function public\.cancel_customer_payment_reservation[\s\S]*?(?=create or replace function public\.update_payment_method_admin)/)?.[0] || "";
assert.ok(cancelRpcSql.includes("for update"), "Rezerv ləğvi database sətrini atomik kilidləməlidir");
assert.ok(cancelRpcSql.includes("idempotent"), "Rezerv ləğvi idempotent nəticə qaytarmalıdır");
assert.ok(cancelRpcSql.includes("RESERVATION_ALREADY_SUBMITTED"), "Çek göndərildikdən sonra müştəri rezervi ləğv edə bilməməlidir");
assert.ok(cancelRpcSql.includes("RESERVATION_CHECKOUT_MISMATCH"), "Rezerv checkout sessiyasına bağlanmalıdır");
assert.equal(cancelRpcSql.includes("payment_daily_usage"), false, "Rezerv ləğvi tamamlanmış istifadə sayğacını dəyişməməlidir");

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
assert.equal(snapshot.productCount, 31);
assert.equal(snapshot.activeProductCount, 22);
assert.equal(snapshot.sha256, expectedSnapshot, "Kommersiya/CMS snapshot dəyişib");

const productPages = fs.readdirSync(path.join(root, "mehsul")).filter((name) => name.endsWith(".page"));
assert.equal(productPages.length, 22);
for (const page of productPages) {
  const html = read(path.join("mehsul", page));
  assert.ok(html.includes("payment-flow.css?v="), `${page}: payment CSS bağlantısı yoxdur`);
  assert.ok(html.includes("payment-flow.js?v="), `${page}: payment JS bağlantısı yoxdur`);
  assert.ok(html.includes("order-confirmation.js?v=unified-payment-flow-20260810-1"), `${page}: confirmation cache versiyası köhnədir`);
  assert.equal(html.includes("hbo-max-order-fix.js"), false, `${page}: legacy məhsul handler-i vahid axını kəsməməlidir`);
}
assert.ok(read("mirpanel-admin/product-pages.mjs").includes("receipt-formdata-20260812-1"), "Yeni yaradılan məhsul səhifələrində aktual payment asset versiyası olmalıdır");

for (const file of [
  "mirpanel-admin/payment-api.mjs",
  "mirpanel-admin/payment-mail.mjs",
  "mirpanel-admin/payment-security.mjs",
  "mirpanel-admin/payment-store.mjs",
  "mirpanel-admin/public/payment-admin.js",
  "payment-flow.js",
  "payment-flow.css",
  "supabase/migrations/202608070001_payment_system.sql",
  "supabase/migrations/202608080001_payment_checkout_reservations.sql"
]) {
  const value = read(file);
  assert.equal(value.includes("\uFFFD"), false, `${file}: UTF-8 replacement simvolu var`);
  assert.equal(/(?:SUPABASE_SECRET_KEY|GMAIL_CLIENT_SECRET|GMAIL_REFRESH_TOKEN|PAYMENT_ENCRYPTION_KEY_B64)\s*[=:]\s*["'][^"']{8}/.test(value), false, `${file}: məxfi dəyər aşkarlandı`);
}

console.log(JSON.stringify({
  ok: true,
  tests: 81,
  commercialSnapshot: snapshot.sha256,
  products: snapshot.productCount,
  activeProducts: snapshot.activeProductCount,
  receiptTypes: ["JPG", "PNG", "WEBP", "PDF"],
  rls: true,
  privateBucket: true
}, null, 2));

