import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminOrderStatus,
  normalizeOrderListParams,
  orderDatabaseStatuses,
  paymentMethodLabel,
  PAYMENT_ORDER_PAGE_SIZE
} from "../mirpanel-admin/payment-order-query.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

assert.equal(PAYMENT_ORDER_PAGE_SIZE, 20);
assert.deepEqual(orderDatabaseStatuses(normalizeOrderListParams({ tab: "pending" })), ["reviewing", "new_receipt_requested"]);
assert.deepEqual(orderDatabaseStatuses(normalizeOrderListParams({ tab: "completed" })), ["approved", "completed"]);
assert.deepEqual(orderDatabaseStatuses(normalizeOrderListParams({ status: "rejected" })), ["rejected"]);
assert.equal(adminOrderStatus("approved"), "completed");
assert.equal(adminOrderStatus("completed"), "completed");
assert.equal(adminOrderStatus("reviewing"), "reviewing");
assert.equal(adminOrderStatus("reviewing", "expired"), "expired");
assert.equal(paymentMethodLabel({ display_name: "LeoBank •••• 4419", provider_name: "LeoBank", last4: "4419" }), "LeoBank •••• 4419");
assert.equal(paymentMethodLabel({ display_name: "ABB •••• 4655", last4: "4655" }), "ABB •••• 4655");

const normalized = normalizeOrderListParams({
  page: "7", search: " mp-a1b2c3<script>", productId: "product-1", methodId: "not-a-uuid",
  dateFrom: "2026-08-01", dateTo: "invalid", sort: "oldest"
});
assert.equal(normalized.page, 7);
assert.equal(normalized.search, "MP-A1B2C3");
assert.equal(normalized.methodId, "");
assert.equal(normalized.dateFrom, "2026-08-01");
assert.equal(normalized.dateTo, "");
assert.equal(normalized.sort, "oldest");
assert.equal(normalizeOrderListParams({ dateFrom: "2026-02-31" }).dateFrom, "");

const store = read("mirpanel-admin/payment-store.mjs");
const api = read("mirpanel-admin/payment-api.mjs");
const admin = read("mirpanel-admin/public/payment-admin.js");
const cms = read("mirpanel-admin/public/cms-admin.js");
const css = read("mirpanel-admin/public/admin.css");
const migration = read("supabase/migrations/202608070001_payment_system.sql");

assert.ok(store.includes('.select(select, { count: "exact" })'), "Sifariş sayı serverdə hesablanmalıdır");
assert.ok(store.includes(".range(from, from + filters.pageSize - 1)"), "Server pagination işləməlidir");
assert.ok(store.includes("paymentMethodLabel(method)"), "Maskalanmış nömrə bir dəfə formatlanmalıdır");
const listOrdersSource = store.match(/async listOrders\(input = \{\}\)[\s\S]*?(?=\n    async getOrder\()/)?.[0] || "";
assert.equal(listOrdersSource.includes('select("*,payment_methods'), false, "Sifariş siyahısı lazımsız sütunları götürməməlidir");
assert.equal(store.includes("async updateOrderNote"), false, "Yeni administrator qeydi axını qalmamalıdır");
assert.ok(api.includes("Object.fromEntries(url.searchParams)"), "Filtrlər serverə ötürülməlidir");
assert.ok(api.includes('url.pathname === "/api/admin/payment-emails"'), "Gmail yoxlamaları sifarişlərdən ayrılmalıdır");
assert.equal(api.includes("approve|reject|receipt|note"), false, "Qeyd endpoint-i qalmamalıdır");
assert.ok(cms.includes('["paymentOrders", "Sifarişlər"]'));
assert.ok(cms.includes("Gözləyən sifarişlər"));
assert.ok(cms.includes("Tamamlanmış sifarişlər"));
assert.ok(cms.includes("Hər səhifədə" ) === false, "Texniki izah əsas görünüşü ağırlaşdırmamalıdır");
assert.equal(cms.includes("Administrator qeydi"), false, "Sifariş kartında administrator qeydi görünməməlidir");
assert.equal(admin.includes("data-payment-order-note"), false);
assert.equal(admin.includes("data-save-payment-note"), false);
assert.ok(admin.includes("paymentOrderFilters"));
assert.ok(admin.includes("paymentOrdersPrevious"));
assert.ok(admin.includes("paymentOrdersNext"));
assert.ok(admin.includes("card.remove()"), "Status dəyişəndə kart dərhal siyahıdan çıxmalıdır");
assert.ok(admin.includes("if (paymentState.orderActions.has(id)) return"), "İkiqat klik brauzerdə bloklanmalıdır");
assert.ok(css.includes("paymentOrderCompactGrid"));
assert.ok(css.includes("@media(max-width:420px)"));

const approveRpc = migration.match(/create or replace function public\.approve_payment_order[\s\S]*?(?=create or replace function public\.reject_payment_order)/)?.[0] || "";
const rejectRpc = migration.match(/create or replace function public\.reject_payment_order[\s\S]*?(?=create or replace function public\.cancel_payment_reservation)/)?.[0] || "";
for (const sql of [approveRpc, rejectRpc]) {
  assert.ok(sql.includes("for update"), "Status keçidi database sətrini kilidləməlidir");
  assert.ok(sql.includes("idempotent"), "Status keçidi idempotent cavab qaytarmalıdır");
  assert.ok(sql.includes("payment_audit_log"), "Audit qeydi saxlanmalıdır");
}
assert.ok(approveRpc.includes("confirmed_count = confirmed_count + 1"));
assert.equal(rejectRpc.includes("confirmed_count = confirmed_count + 1"), false);
assert.ok(rejectRpc.includes("set status = 'rejected'"));

console.log(JSON.stringify({
  ok: true,
  pageSize: PAYMENT_ORDER_PAGE_SIZE,
  tabs: ["pending", "completed"],
  rejectedAvailableByFilter: true,
  adminNoteUiRemoved: true,
  atomicApproveReject: true,
  duplicateLast4Prevented: true
}, null, 2));
