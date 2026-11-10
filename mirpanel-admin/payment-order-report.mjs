const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

export function decimalToCents(value) {
  const text = String(value ?? "0").trim();
  const match = DECIMAL.exec(text);
  if (!match) throw new TypeError("Maliyyə məbləği düzgün decimal formatında deyil.");
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}

export function centsToMoney(cents) {
  const value = BigInt(cents);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function normalizedMetric(row = {}) {
  const revenueCents = decimalToCents(row.revenue ?? 0);
  const costCents = decimalToCents(row.cost ?? 0);
  const incomplete = Number(row.missingCostCount || 0) > 0;
  const profitCents = revenueCents - costCents;
  return {
    ...row,
    revenue: centsToMoney(revenueCents),
    cost: centsToMoney(costCents),
    profit: incomplete && row.profit === null ? null : centsToMoney(profitCents),
    margin: incomplete || revenueCents === 0n ? null : Number((Number(profitCents * 10000n / revenueCents) / 100).toFixed(2))
  };
}

export function normalizeFinancialStatistics(statistics = {}) {
  const normalized = normalizedMetric(statistics);
  return {
    ...normalized,
    count: Number(statistics.count || 0),
    missingCostCount: Number(statistics.missingCostCount || 0),
    estimatedCostCount: Number(statistics.estimatedCostCount || 0),
    topProduct: statistics.topProduct || "—",
    topProfitProduct: statistics.topProfitProduct || "—",
    products: (statistics.products || []).map(normalizedMetric),
    plans: (statistics.plans || []).map(normalizedMetric),
    paymentMethods: (statistics.paymentMethods || []).map(normalizedMetric),
    days: (statistics.days || []).map(normalizedMetric)
  };
}

export function aggregateSnapshotRows(rows = []) {
  let revenueCents = 0n;
  let costCents = 0n;
  let count = 0;
  for (const row of rows) {
    if (!['approved', 'completed'].includes(row.status) || !row.completed_at) continue;
    revenueCents += decimalToCents(row.sale_price_snapshot ?? row.amount ?? 0);
    costCents += decimalToCents(row.cost_price_snapshot ?? 0);
    count += 1;
  }
  return {
    count,
    revenue: centsToMoney(revenueCents),
    cost: centsToMoney(costCents),
    profit: centsToMoney(revenueCents - costCents)
  };
}

export function reportOrderFinance(order, refundCents = 0) {
  const sale = decimalToCents(order.sale_price_snapshot ?? order.amount);
  const refunded = BigInt(refundCents);
  const revenue = sale > refunded ? sale - refunded : 0n;
  const cancelled = new Map((order.fulfillment_cancellation?.lines || []).map(line => [line.index, line.quantity]));
  let cost = order.cost_price_snapshot == null ? null : decimalToCents(order.cost_price_snapshot);
  let knownCost = cost ?? 0n;
  let estimated = order.cost_source === "backfilled_current_cost";
  if (Array.isArray(order.cost_lines_snapshot)) {
    knownCost = 0n;
    estimated = false;
    let missing = false;
    for (const [index,line] of order.cost_lines_snapshot.entries()) {
      const retained = line.quantity - (cancelled.get(index) || 0);
      if (retained <= 0) continue;
      if (line.unitCost == null) missing = true;
      else {
        knownCost += decimalToCents(line.unitCost) * BigInt(retained);
        estimated ||= line.source === "estimate";
      }
    }
    cost = missing ? null : knownCost;
  } else if (cost !== null && cancelled.has(0) && order.product_id !== "__cart__") {
    const quantity = BigInt(order.quantity || 1);
    cost = (cost * (quantity - BigInt(cancelled.get(0))) + quantity / 2n) / quantity;
    knownCost = cost;
  }
  return {
    ...order,
    sale_price_snapshot: centsToMoney(revenue),
    cost_price_snapshot: cost === null ? null : centsToMoney(cost),
    known_cost_snapshot: centsToMoney(knownCost),
    profit_snapshot: cost === null ? null : centsToMoney(revenue - cost),
    estimated_cost: estimated
  };
}
