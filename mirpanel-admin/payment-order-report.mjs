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
  const profitCents = revenueCents - costCents;
  return {
    ...row,
    revenue: centsToMoney(revenueCents),
    cost: centsToMoney(costCents),
    profit: centsToMoney(profitCents),
    margin: revenueCents === 0n ? null : Number((Number(profitCents * 10000n / revenueCents) / 100).toFixed(2))
  };
}

export function normalizeFinancialStatistics(statistics = {}) {
  const normalized = normalizedMetric(statistics);
  return {
    ...normalized,
    count: Number(statistics.count || 0),
    missingCostCount: Number(statistics.missingCostCount || 0),
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
