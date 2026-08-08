const PAGE_SIZE = 20;
const ORDER_TABS = new Set(["pending", "completed", "rejected"]);
const ORDER_STATUSES = new Set(["", "reviewing", "completed", "rejected", "expired"]);

function boundedText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(text) ? "" : text;
}

export function normalizeOrderListParams(input = {}) {
  const tab = ORDER_TABS.has(input.tab) ? input.tab : "pending";
  const status = ORDER_STATUSES.has(input.status) ? input.status : "";
  const rawSearch = boundedText(input.search, 20).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const search = rawSearch.match(/MP-[A-F0-9]{0,6}/)?.[0] || rawSearch.slice(0, 9);
  const dateFrom = safeDate(input.dateFrom);
  const dateTo = safeDate(input.dateTo);
  return {
    tab,
    status,
    search,
    productId: boundedText(input.productId, 100),
    methodId: /^[0-9a-f-]{36}$/i.test(String(input.methodId || "")) ? String(input.methodId) : "",
    dateFrom,
    dateTo,
    sort: input.sort === "oldest" ? "oldest" : "newest",
    page: Math.min(100000, positiveInteger(input.page, 1)),
    pageSize: PAGE_SIZE
  };
}

export function orderDatabaseStatuses(filters) {
  if (filters.status === "reviewing") return ["reviewing", "new_receipt_requested"];
  if (filters.status === "completed") return ["approved", "completed"];
  if (filters.status === "rejected") return ["rejected"];
  if (filters.status === "expired") return [];
  if (filters.tab === "completed") return ["approved", "completed"];
  if (filters.tab === "rejected") return ["rejected"];
  return ["reviewing", "new_receipt_requested"];
}

export function adminOrderStatus(status, reservationStatus = "") {
  if (status === "approved" || status === "completed") return "completed";
  if (status === "rejected") return "rejected";
  if (status === "expired" || reservationStatus === "expired") return "expired";
  return "reviewing";
}

export function paymentMethodLabel(method = {}) {
  const last4 = String(method.last4 || "").replace(/\D/g, "").slice(-4);
  const provider = boundedText(method.provider_name, 80);
  const display = boundedText(method.display_name, 80)
    .replace(/\s*(?:[•*xX]{2,}|\.{3,})\s*\d{4}\s*$/u, "")
    .trim();
  const name = provider || display || "Ödəniş üsulu";
  return last4 ? `${name} •••• ${last4}` : name;
}

export const PAYMENT_ORDER_PAGE_SIZE = PAGE_SIZE;
