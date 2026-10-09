import { bakuDate } from "./payment-order-lifecycle.mjs";
import { aggregateSnapshotRows, decimalToCents, normalizeFinancialStatistics } from "./payment-order-report.mjs";

// Persisted duration wins. Parsing is only for orders created before that field existed.
export function orderDuration(row = {}) {
  const structured = row.duration_months ?? row.durationMonths;
  if (structured !== null && structured !== undefined && structured !== "") {
    const months = Number(structured);
    if (Number.isSafeInteger(months) && months > 0) return String(months);
  }
  const label = String(row.plan_name ?? row.planName ?? "").normalize("NFKC").toLocaleLowerCase("az-AZ");
  const match = /(?:^|[^\p{L}\p{N}])([1-9]\d*)\s*ay(?:l[ıi]q)?(?=$|[^\p{L}\p{N}])/u.exec(label);
  const months = Number(match?.[1]);
  return Number.isSafeInteger(months) && months > 0 ? String(months) : "other";
}

export function durationOptions(rows = []) {
  return [...new Set(rows.map(orderDuration))]
    .sort((a, b) => a === "other" ? 1 : b === "other" ? -1 : Number(a) - Number(b))
    .map((value) => ({ value, label: value === "other" ? "Digər" : `${value} aylıq` }));
}

export function normalizeDurationFilter(value, legacyPlanName = "") {
  const text = String(value ?? "").trim();
  if (text === "other") return text;
  if (/^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text))) return String(Number(text));
  return legacyPlanName ? orderDuration({ plan_name: legacyPlanName }) : "";
}

// A duration can span many full plan labels. Use the existing immutable finance
// snapshots and decimal aggregation, never current prices or new financial writes.
export function durationStatistics(rows = []) {
  const completed = rows.filter((row) => ["approved", "completed"].includes(row.status) && row.completed_at);
  const metric = (items) => {
    const known = items.filter((row) => row.cost_price_snapshot !== null && row.cost_price_snapshot !== undefined);
    const sale = known.reduce((sum, row) => sum + decimalToCents(row.sale_price_snapshot ?? row.amount ?? 0), 0n);
    const profit = known.reduce((sum, row) => sum + decimalToCents(row.profit_snapshot ?? 0), 0n);
    return { ...aggregateSnapshotRows(items), missingCostCount: items.length - known.length,
      profitMargin: sale === 0n ? null : Number((Number(profit) / Number(sale) * 100).toFixed(2)) };
  };
  const group = (key, metadata) => {
    const groups = new Map();
    for (const row of completed) {
      const id = key(row);
      if (!groups.has(id)) groups.set(id, { metadata: metadata(row), rows: [] });
      groups.get(id).rows.push(row);
    }
    return [...groups.values()].map((item) => ({ ...item.metadata, ...metric(item.rows) }));
  };
  const products = group((row) => JSON.stringify([row.product_id, row.product_title]),
    (row) => ({ productId: row.product_id, title: row.product_title }));
  products.sort((a, b) => b.count - a.count || String(a.title).localeCompare(String(b.title), "az"));
  const plans = group((row) => JSON.stringify([row.product_id, row.product_title, row.plan_id, row.plan_name]),
    (row) => ({ productId: row.product_id, productTitle: row.product_title, planId: row.plan_id, planName: row.plan_name }));
  plans.sort((a, b) => b.count - a.count || String(a.productTitle).localeCompare(String(b.productTitle), "az") || String(a.planName).localeCompare(String(b.planName), "az"));
  const days = group((row) => bakuDate(new Date(row.completed_at)), (row) => ({ date: bakuDate(new Date(row.completed_at)) }));
  days.sort((a, b) => b.date.localeCompare(a.date));
  const knownProducts = new Map();
  for (const row of completed) {
    if (row.cost_price_snapshot === null || row.cost_price_snapshot === undefined) continue;
    const key = JSON.stringify([row.product_id, row.product_title]);
    const item = knownProducts.get(key) || { title: row.product_title, sale: 0n, profit: 0n };
    item.sale += decimalToCents(row.sale_price_snapshot ?? row.amount ?? 0);
    item.profit += decimalToCents(row.profit_snapshot ?? 0);
    knownProducts.set(key, item);
  }
  const topProfit = [...knownProducts.values()].filter((item) => item.sale > 0n)
    .sort((a, b) => a.profit === b.profit ? String(a.title).localeCompare(String(b.title), "az") : a.profit > b.profit ? -1 : 1);
  return normalizeFinancialStatistics({ ...metric(completed), products, plans, days,
    topProduct: products[0]?.title || "—", topProfitProduct: topProfit[0]?.title || "—" });
}
