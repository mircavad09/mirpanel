import { bakuDate, orderPeriodRange, safeCalendarDate } from "./payment-order-lifecycle.mjs";

const PAGE_SIZE = 20;
const ORDER_TABS = new Set(["pending", "today", "all", "expiring"]);
const ORDER_PERIODS = new Set([
  "", "all", "1d", "today", "yesterday", "7d", "30d", "1m", "this_month",
  "last_month", "3m", "6m", "1y", "12m", "custom"
]);

function boundedText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeOrderListParams(input = {}, now = new Date()) {
  const tab = ORDER_TABS.has(input.tab) ? input.tab : "pending";
  const requestedPeriod = ORDER_PERIODS.has(input.period) ? input.period : "";
  const period = requestedPeriod || (tab === "all" ? "this_month" : tab === "today" ? "today" : "");
  const rawSearch = boundedText(input.search, 20).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const search = rawSearch.match(/^MP-[A-F0-9]{0,6}$/)?.[0] || rawSearch.match(/^\d{1,18}$/)?.[0] || rawSearch.slice(0, 20);
  const customFrom = safeCalendarDate(input.dateFrom);
  const customTo = safeCalendarDate(input.dateTo);
  if (period === "custom") {
    if (!customFrom || !customTo) {
      throw Object.assign(new Error("Başlanğıc və son tarixini seçin."), { status: 400, code: "ORDER_DATE_RANGE_REQUIRED" });
    }
    if (customFrom > customTo) {
      throw Object.assign(new Error("Başlanğıc tarixi son tarixdən böyük ola bilməz."), { status: 400, code: "ORDER_DATE_RANGE_INVALID" });
    }
  }
  const range = orderPeriodRange(period === "custom" ? "" : period, customFrom, customTo, now);
  return {
    tab,
    period,
    search,
    productId: boundedText(input.productId, 100),
    planName: boundedText(input.planName, 160),
    methodId: /^[0-9a-f-]{36}$/i.test(String(input.methodId || "")) ? String(input.methodId) : "",
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    today: bakuDate(now),
    sort: input.sort === "oldest" ? "oldest" : "newest",
    page: Math.min(100000, positiveInteger(input.page, 1)),
    pageSize: PAGE_SIZE
  };
}

export function orderDatabaseStatuses(filters) {
  return filters.tab === "pending" ? ["reviewing", "new_receipt_requested"] : ["approved", "completed"];
}

export function adminOrderStatus(status, reservationStatus = "") {
  if (status === "approved" || status === "completed") return "completed";
  if (status === "rejected") return "rejected";
  if (status === "expired" || reservationStatus === "expired") return "expired";
  return "reviewing";
}

export function paymentMethodLabel(method = {}) {
  const last4 = String(method.last4 || method.method_last4_snapshot || "").replace(/\D/g, "").slice(-4);
  const snapshot = boundedText(method.method_name_snapshot, 80);
  const provider = boundedText(method.provider_name, 80);
  const display = boundedText(method.display_name, 80)
    .replace(/\s*(?:[•*xX]{2,}|\.{3,})\s*\d{4}\s*$/u, "")
    .trim();
  const name = snapshot || provider || display || "Ödəniş üsulu";
  return last4 ? `${name} •••• ${last4}` : name;
}

export function aggregateCompletedOrders(rows = []) {
  const byProduct = new Map();
  let revenue = 0;
  for (const row of rows) {
    const title = boundedText(row.product_title ?? row.productTitle, 160) || "Məhsul";
    revenue += Number(row.amount || 0);
    byProduct.set(title, (byProduct.get(title) || 0) + 1);
  }
  const products = [...byProduct].map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "az"));
  return {
    count: rows.length,
    revenue: Number(revenue.toFixed(2)),
    topProduct: products[0]?.title || "—",
    products
  };
}

export const PAYMENT_ORDER_PAGE_SIZE = PAGE_SIZE;
