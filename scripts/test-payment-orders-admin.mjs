import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addCalendarMonthsMinusDay,
  bakuDayBounds,
  bakuDate,
  expiryStatus,
  orderPeriodRange,
  serviceDates,
  structuredDurationMonths
} from "../mirpanel-admin/payment-order-lifecycle.mjs";
import {
  aggregateCompletedOrders,
  adminOrderStatus,
  normalizeOrderListParams,
  orderDatabaseStatuses,
  paymentMethodLabel,
  PAYMENT_ORDER_PAGE_SIZE
} from "../mirpanel-admin/payment-order-query.mjs";
import { aggregateSnapshotRows, normalizeFinancialStatistics } from "../mirpanel-admin/payment-order-report.mjs";
import { validatePaymentNumber } from "../mirpanel-admin/payment-security.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

assert.equal(PAYMENT_ORDER_PAGE_SIZE, 20);
for (const tab of ["pending", "today", "all", "expiring"]) assert.equal(normalizeOrderListParams({ tab }).tab, tab);
assert.equal(normalizeOrderListParams({ tab: "all" }, new Date("2026-09-03T12:00:00+04:00")).period, "this_month");
assert.equal(normalizeOrderListParams({ tab: "today" }).period, "today");
assert.deepEqual(bakuDayBounds("2026-08-31"), { start: "2026-08-31T00:00:00+04:00", endExclusive: "2026-09-01T00:00:00+04:00" });
assert.throws(() => normalizeOrderListParams({ tab: "all", period: "custom", dateFrom: "2026-08-10" }), /Başlanğıc və son/);
assert.throws(() => normalizeOrderListParams({ tab: "all", period: "custom", dateFrom: "2026-08-19", dateTo: "2026-08-10" }), /böyük ola bilməz/);
assert.deepEqual(orderDatabaseStatuses(normalizeOrderListParams({ tab: "pending" })), ["reviewing", "new_receipt_requested"]);
assert.deepEqual(orderDatabaseStatuses(normalizeOrderListParams({ tab: "all" })), ["approved", "completed"]);
assert.equal(adminOrderStatus("approved"), "completed");
assert.equal(adminOrderStatus("reviewing", "expired"), "expired");
assert.equal(paymentMethodLabel({ display_name: "LeoBank •••• 4419", provider_name: "LeoBank", last4: "4419" }), "LeoBank •••• 4419");
assert.equal(paymentMethodLabel({ method_name_snapshot: "ABB", method_last4_snapshot: "4655" }), "ABB •••• 4655");
assert.equal(paymentMethodLabel({ method_name_snapshot: "M10", method_last4_snapshot: "0909" }), "M10 •••• 0909");
assert.equal(paymentMethodLabel({ method_name_snapshot: "Kapital Bank", method_last4_snapshot: "8332" }), "Kapital Bank •••• 8332");
assert.equal(paymentMethodLabel({ method_name_snapshot: "LeoBank", method_last4_snapshot: "7350" }), "LeoBank •••• 7350");

assert.equal(bakuDate("2026-08-08T19:59:59.999Z"), "2026-08-08");
assert.equal(bakuDate("2026-08-08T20:00:00.000Z"), "2026-08-09");
for (const [months, expected] of [[1, "2026-09-07"], [3, "2026-11-07"], [6, "2027-02-07"], [12, "2027-08-07"]]) {
  assert.equal(addCalendarMonthsMinusDay("2026-08-08", months), expected);
}
assert.deepEqual(serviceDates("2026-08-08T12:00:00+04:00", 3), { completedOn: "2026-08-08", expiresOn: "2026-11-07", notificationOn: "2026-11-06" });
assert.equal(expiryStatus("2026-11-07", new Date("2026-11-06T12:00:00+04:00")).code, "tomorrow");
assert.equal(expiryStatus("2026-11-07", new Date("2026-11-07T00:00:00+04:00")).code, "expired");
assert.equal(expiryStatus("2026-11-07", new Date("2026-11-05T12:00:00+04:00")).due, false);
assert.equal(structuredDurationMonths({ months: 6 }), 6);
assert.equal(structuredDurationMonths({ label: "6 aylıq" }), null, "Müddət görünən mətndən təxmin edilməməlidir");
assert.deepEqual(orderPeriodRange("7d", "", "", new Date("2026-08-09T12:00:00+04:00")), { dateFrom: "2026-08-03", dateTo: "2026-08-09" });
assert.deepEqual(orderPeriodRange("today", "", "", new Date("2026-08-31T23:59:59+04:00")), { dateFrom: "2026-08-31", dateTo: "2026-08-31" });
assert.deepEqual(orderPeriodRange("today", "", "", new Date("2026-09-01T00:00:00+04:00")), { dateFrom: "2026-09-01", dateTo: "2026-09-01" });
assert.deepEqual(orderPeriodRange("yesterday", "", "", new Date("2026-09-01T12:00:00+04:00")), { dateFrom: "2026-08-31", dateTo: "2026-08-31" });
assert.deepEqual(orderPeriodRange("30d", "", "", new Date("2026-08-31T12:00:00+04:00")), { dateFrom: "2026-08-02", dateTo: "2026-08-31" });
assert.deepEqual(orderPeriodRange("this_month", "", "", new Date("2026-09-15T12:00:00+04:00")), { dateFrom: "2026-09-01", dateTo: "2026-09-15" });
assert.deepEqual(orderPeriodRange("last_month", "", "", new Date("2026-09-15T12:00:00+04:00")), { dateFrom: "2026-08-01", dateTo: "2026-08-31" });
assert.deepEqual(orderPeriodRange("last_month", "", "", new Date("2024-03-15T12:00:00+04:00")), { dateFrom: "2024-02-01", dateTo: "2024-02-29" });
assert.deepEqual(orderPeriodRange("last_month", "", "", new Date("2025-03-15T12:00:00+04:00")), { dateFrom: "2025-02-01", dateTo: "2025-02-28" });
assert.deepEqual(orderPeriodRange("3m", "", "", new Date("2026-09-15T12:00:00+04:00")), { dateFrom: "2026-07-01", dateTo: "2026-09-15" });
assert.deepEqual(orderPeriodRange("6m", "", "", new Date("2026-09-15T12:00:00+04:00")), { dateFrom: "2026-04-01", dateTo: "2026-09-15" });
assert.deepEqual(orderPeriodRange("12m", "", "", new Date("2026-09-15T12:00:00+04:00")), { dateFrom: "2025-10-01", dateTo: "2026-09-15" });
assert.deepEqual(orderPeriodRange("", "2026-08-02", "2026-08-21", new Date("2026-09-15T12:00:00+04:00")), { dateFrom: "2026-08-02", dateTo: "2026-08-21" });

const stats = aggregateCompletedOrders([
  { product_title: "Netflix Şəxsi", amount: 5.99 },
  { product_title: "Netflix Şəxsi", amount: 7 },
  { product_title: "Spotify Premium", amount: 4 }
]);
assert.deepEqual(stats, { count: 3, revenue: 16.99, topProduct: "Netflix Şəxsi", products: [{ title: "Netflix Şəxsi", count: 2 }, { title: "Spotify Premium", count: 1 }] });
assert.deepEqual(aggregateSnapshotRows([
  { status: "completed", completed_at: "2026-08-10T00:00:00+04:00", sale_price_snapshot: "0.10", cost_price_snapshot: "0.03" },
  { status: "approved", completed_at: "2026-08-10T01:00:00+04:00", sale_price_snapshot: "0.20", cost_price_snapshot: "0.07" },
  { status: "reviewing", completed_at: null, sale_price_snapshot: "999.00", cost_price_snapshot: "0.00" }
]), { count: 2, revenue: "0.30", cost: "0.10", profit: "0.20" });
assert.equal(normalizeFinancialStatistics({ revenue: "10.00", cost: "3.25", profit: "999.00" }).profit, "6.75");

assert.equal(validatePaymentNumber("4098 5844 9937 4419", "bank_card"), "4098584499374419");
assert.equal(validatePaymentNumber("050 123 45 67", "wallet"), "0501234567");
assert.equal(validatePaymentNumber("", "bank_card"), "");
assert.throws(() => validatePaymentNumber("4098-5844", "bank_card"));
assert.throws(() => validatePaymentNumber("1234", "bank_card"));

const store = read("mirpanel-admin/payment-store.mjs");
const api = read("mirpanel-admin/payment-api.mjs");
const admin = read("mirpanel-admin/public/payment-admin.js");
const cms = read("mirpanel-admin/public/cms-admin.js");
const css = read("mirpanel-admin/public/admin.css");
const migration = read("supabase/migrations/202608090001_order_history_and_expiry.sql");
const capacityMigration = read("supabase/migrations/202608090003_payment_method_capacity_and_admin.sql");
const reportMigration = read("supabase/migrations/202608100001_calendar_reports_and_cost_backfill.sql");

assert.ok(store.includes('.select(select, { count: "exact" })'));
assert.ok(store.includes(".range(from, from + filters.pageSize - 1)"), "Səhifələmə serverdə işləməlidir");
assert.ok(store.includes('query.is("contacted_at", null)'));
assert.ok(store.includes('rpc("mark_payment_order_contacted"'));
assert.ok(store.includes('rpc("delete_payment_method_safely"'));
assert.ok(api.includes("structuredDurationMonths(plan)"));
assert.ok(api.includes('approve|reject|contacted|receipt'));
assert.ok(api.includes("validatePaymentNumber"));
for (const [tab, label] of [["pending", "Gözləyən sifarişlər"], ["today", "Bu gün tamamlananlar"], ["all", "Ümumi sifarişlər"], ["expiring", "Bitən məhsullar"]]) {
  assert.ok(cms.includes(`data-payment-order-tab=\"${tab}\"`), `${label} əsas tabı qorunmalıdır`);
}
assert.match(cms, /id="paymentMonthlyReports"[^>]*hidden/);
assert.ok(admin.includes('["today", "all"].includes(tab)'), "Hesab kartları Bu gün və Ümumi sifarişlərdə görünməlidir");
assert.ok(admin.includes("orderRequestSequence"), "Köhnə sorğu yeni filtr nəticəsini üstələməməlidir");
assert.ok(admin.includes("fullDateLabel"), "Tarix başlıqları Azərbaycan lokalı ilə formatlanmalıdır");
assert.ok(store.includes("endExclusive") && store.includes(".lt("), "Tarix intervalı növbəti günün başlanğıcına qədər yarıaçıq olmalıdır");
assert.equal(cms.includes('option value="rejected"'), false, "Rədd edilmiş sifarişlər əsas filtrdə olmamalıdır");
assert.ok(admin.includes('type="text" inputmode="numeric"'));
assert.equal(admin.includes('name="fullNumber" type="password"'), false);
assert.ok(admin.includes("formatNumber(event.target.value)"));
assert.ok(admin.includes("data-contacted-payment"));
assert.ok(admin.includes("data-delete-payment-method"));
assert.equal(admin.includes(">Mövzu<"), false, "Anlaşılmaz Mövzu adı qalmamalıdır");
assert.ok(admin.includes("Rəng mövzusu"));
assert.ok(admin.includes("data-payment-theme-preview"));
assert.ok(admin.includes("activeReservations"));
assert.ok(admin.includes("reviewingReceipts"));
assert.ok(admin.includes("scrollIntoView"));
assert.ok(store.includes('.is("deleted_at", null)'), "Silinmiş kartlar normal siyahıdan çıxmalıdır");
assert.ok(store.includes('rpc("update_payment_method_admin"'), "Kart redaktəsi atomik server funksiyasından keçməlidir");
assert.ok(capacityMigration.includes("PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS"));
assert.ok(capacityMigration.includes("status = 'reviewing' or (status = 'reserved' and expires_at > now())"));
assert.ok(css.includes("paymentOrderStatistics"));
assert.ok(css.includes("@media(max-width:420px)"));
for (const value of ["payment_order_profit_statistics_v2", "payment_cost_backfill_preview", "backfill_payment_order_cost_snapshots", "payment_cost_backfill_backups", "approve_payment_order_v4", "Asia/Baku"]) assert.ok(reportMigration.includes(value));
assert.ok(reportMigration.includes("for update"), "Backfill targetləri transaction daxilində kilidlənməlidir");
assert.ok(reportMigration.includes("BACKFILL_PREVIEW_CHANGED"), "Preview dəyişərsə backfill dayanmalıdır");
assert.ok(reportMigration.includes("on conflict (order_id) do nothing"), "Backup idempotent olmalıdır");
assert.ok(reportMigration.includes("o.product_id=c.product_id and o.plan_id=c.plan_id"), "Backfill yalnız sabit məhsul və plan ID-si ilə uyğunlaşmalıdır");
assert.equal(/cost_price_snapshot\s*=\s*0/i.test(reportMigration), false, "Çatışmayan maya sıfır yazılmamalıdır");
assert.ok(reportMigration.includes("revoke execute on function public.payment_cost_backfill_preview() from public,anon,authenticated"));
assert.ok(api.includes("/api/admin/payment-cost-backfill-preview"));
assert.ok(api.includes("/api/admin/payment-cost-backfill"));
assert.ok(admin.includes("paymentOrderDay"));
assert.ok(admin.includes("paymentCostBackfillPreview"));

for (const column of ["completed_at", "duration_months", "service_expires_on", "expiry_notification_on", "contacted_at", "method_name_snapshot", "method_last4_snapshot", "deleted_at"]) assert.ok(migration.includes(column));
for (const fn of ["approve_payment_order_v2", "mark_payment_order_contacted", "delete_payment_method_safely"]) {
  const source = migration.match(new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?(?=create or replace function|revoke execute|commit;)`))?.[0] || "";
  assert.ok(source.includes("for update"), `${fn}: database sətri kilidlənməlidir`);
  assert.ok(source.includes("idempotent"), `${fn}: idempotent cavab tələb olunur`);
  assert.ok(source.includes("payment_audit_log"), `${fn}: audit qeydi tələb olunur`);
}
assert.ok(migration.includes("confirmed_count = confirmed_count + 1"));
assert.equal((migration.match(/confirmed_count = confirmed_count \+ 1/g) || []).length, 1, "Sayğac yalnız təsdiq funksiyasında artırılmalıdır");
assert.ok(migration.includes("PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS"));
assert.ok(migration.includes("update public.payment_orders set completed_at = approved_at"), "Etibarlı tamamlanma tarixi itirilməməlidir");
assert.equal(/update public\.payment_orders[\s\S]*duration_months\s*=\s*.+plan_name/i.test(migration), false, "Keçmiş müddət plan mətnindən uydurulmamalıdır");

console.log(JSON.stringify({
  ok: true,
  pageSize: PAYMENT_ORDER_PAGE_SIZE,
  tabs: ["pending", "today", "all", "expiring"],
  bakuMidnight: true,
  durationMonths: [1, 3, 6, 12],
  contactedIdempotent: true,
  cardNumberVisibleOnlyWhileEditing: true,
  serverPagination: true
}, null, 2));
