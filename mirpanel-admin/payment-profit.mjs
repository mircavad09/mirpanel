const MAX_MONEY_CENTS = 999_999_999;

export function parseMoneyCents(value, { allowEmpty = true } = {}) {
  if (value === null || value === undefined || String(value).trim() === "") {
    if (allowEmpty) return null;
    throw Object.assign(new Error("Maya dəyərini daxil edin."), { status: 400 });
  }
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw Object.assign(new Error("Maya dəyəri mənfi olmayan və maksimum iki onluq rəqəmli məbləğ olmalıdır."), { status: 400 });
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
    throw Object.assign(new Error("Maya dəyəri icazə verilən həddi aşır."), { status: 400 });
  }
  return cents;
}

export function centsToDecimal(cents) {
  return cents === null ? null : (cents / 100).toFixed(2);
}

export function moneyMetrics(saleValue, costValue) {
  const saleCents = parseMoneyCents(saleValue, { allowEmpty: false });
  const costCents = parseMoneyCents(costValue);
  if (costCents === null) return { sale: centsToDecimal(saleCents), cost: null, profit: null, margin: null };
  const profitCents = saleCents - costCents;
  return {
    sale: centsToDecimal(saleCents),
    cost: centsToDecimal(costCents),
    profit: centsToDecimal(profitCents),
    margin: saleCents === 0 ? null : Number(((profitCents / saleCents) * 100).toFixed(2))
  };
}

export function planKey(plan, index) {
  return String(plan?.id ?? index);
}

export function catalogCostRows(catalog, savedCosts = []) {
  const costs = new Map(savedCosts.map((row) => [`${row.product_id}:${row.plan_id}`, row]));
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  return products.flatMap((product) => (product.plans || []).map((plan, index) => {
    const planId = planKey(plan, index);
    const saved = costs.get(`${product.id}:${planId}`);
    const metrics = moneyMetrics(plan.price, saved?.cost_amount ?? null);
    return {
      productId: String(product.id),
      productTitle: String(product.title || "Məhsul"),
      productActive: product.active !== false,
      category: String(product.category || "all"),
      planId,
      planName: String(plan.label || plan.name || (plan.months ? `${plan.months} aylıq` : `Plan ${index + 1}`)),
      durationMonths: Number.isInteger(Number(plan.durationMonths ?? plan.months)) ? Number(plan.durationMonths ?? plan.months) : null,
      salePrice: metrics.sale,
      costAmount: metrics.cost,
      profit: metrics.profit,
      margin: metrics.margin,
      updatedAt: saved?.updated_at || null
    };
  }));
}

export function aggregateProfitSnapshots(rows = []) {
  const completed = rows.filter((row) => ["approved", "completed"].includes(row.status));
  const known = completed.filter((row) => row.cost_price_snapshot !== null && row.cost_price_snapshot !== undefined);
  const revenue = completed.reduce((sum, row) => sum + Number(row.sale_price_snapshot ?? row.amount ?? 0), 0);
  const profitRevenue = known.reduce((sum, row) => sum + Number(row.sale_price_snapshot ?? row.amount ?? 0), 0);
  const cost = known.reduce((sum, row) => sum + Number(row.cost_price_snapshot || 0), 0);
  const profit = known.reduce((sum, row) => sum + Number(row.profit_snapshot || 0), 0);
  return {
    count: completed.length,
    revenue: Number(revenue.toFixed(2)),
    cost: Number(cost.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    margin: profitRevenue ? Number(((profit / profitRevenue) * 100).toFixed(2)) : null,
    missingCostCount: completed.length - known.length
  };
}
