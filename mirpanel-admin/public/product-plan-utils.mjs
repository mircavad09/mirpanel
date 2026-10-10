// Shared by the detail page, server renderer and CMS validator; no order writes.
export function durationMonths(plan = {}) {
  const raw = plan.duration_months ?? plan.durationMonths ?? plan.months;
  if (raw !== '' && raw != null && Number.isSafeInteger(Number(raw)) && Number(raw) > 0) return Number(raw);
  const match = /(?:^|[^\p{L}\p{N}])([1-9]\d*)\s*ay(?:l[ıi]q)?(?=$|[^\p{L}\p{N}])/u.exec(String(plan.label || '').normalize('NFKC').toLocaleLowerCase('az-AZ'));
  return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
}
export function money(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return null;
  const cents = Math.round((Number(value) + Number.EPSILON) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
export function formatPrice(value) { return Number.isFinite(value) ? value.toFixed(2) : ''; }
export function planMetrics(plan = {}) {
  const cents = money(plan.price), old = money(plan.regularPrice), months = durationMonths(plan);
  const discounted = cents !== null && old !== null && old > cents && cents > 0;
  return { price: cents === null ? null : cents / 100, oldPrice: discounted ? old / 100 : null,
    savings: discounted ? (old - cents) / 100 : null, discount: discounted ? Math.round((old - cents) / old * 100) : null,
    months, monthly: months && cents !== null && cents > 0 ? cents / 100 / months : null,
    warranty: warrantyText(plan) };
}
export function warrantyText(plan = {}) {
  if (plan.warrantyMode === 'none') return 'Zəmanətsiz';
  if (plan.warrantyMode === 'guaranteed') {
    if (plan.warrantyText) return String(plan.warrantyText);
    return Number.isSafeInteger(plan.warrantyDuration) && plan.warrantyDuration > 0
      ? `${plan.warrantyDuration} ${plan.warrantyUnit === 'day' ? 'gün' : 'ay'} zəmanət` : '';
  }
  const label = String(plan.label || '');
  if (/zəmanətsiz/i.test(label)) return 'Zəmanətsiz';
  const match = /(\d+)\s*(gün|ay)\s*zəmanət(?:li)?/iu.exec(label);
  return match ? `${match[1]} ${match[2]} zəmanət` : '';
}
// Only an actual plan-specific inventory read is accepted, never product-wide stock.
export function visibleStock(plan, inventory) {
  if (plan.stockVisibility !== 'show' || !inventory || !Number.isSafeInteger(inventory.count) || inventory.count < 0) return null;
  return inventory.count;
}
export function bestValueIndex(plans = [], inventory = {}) {
  const candidates = plans.map((plan, index) => ({ plan, index, metrics: planMetrics(plan) }))
    .filter(({plan, index, metrics}) => plan.active !== false && metrics.monthly > 0 && inventory[index]?.count !== 0);
  const overrides = candidates.filter(({plan}) => plan.bestValue === true);
  const sorted = (overrides.length === 1 ? overrides : candidates).sort((a, b) =>
    a.metrics.monthly - b.metrics.monthly || b.metrics.months - a.metrics.months || a.index - b.index);
  return sorted[0]?.index ?? -1;
}
export function deliveryText(product = {}) {
  if (product.deliveryType === 'automatic') return '7/24 avtomatik təqdim olunur';
  if (product.deliveryType === 'ready_account' && product.deliveryText) return String(product.deliveryText);
  return 'Ödəniş təsdiqindən sonra təqdim olunur';
}
export function normalizePlanMetadata(plan = {}) {
  for (const field of ['price', 'regularPrice']) if (plan[field] !== undefined && plan[field] !== '' && money(plan[field]) === null)
    throw new Error('Qiymət mənfi və ya etibarsız ola bilməz.');
  const metadata = {};
  if (plan.id != null) metadata.id = String(plan.id);
  if (plan.duration_months != null) {
    const n = Number(plan.duration_months);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Müddət tam müsbət ay sayı olmalıdır.');
    metadata.duration_months = n;
  }
  for (const [field, allowed] of Object.entries({warrantyMode:['inherit','guaranteed','none'],warrantyUnit:['day','month'],stockVisibility:['show','hide']})) {
    if (plan[field] != null) {
      if (!allowed.includes(plan[field])) throw new Error('Plan məlumatı etibarsızdır.');
      metadata[field] = plan[field];
    }
  }
  if (plan.warrantyText != null) {
    const text = String(plan.warrantyText).trim();
    if (/[<>\u0000-\u001f]/u.test(text) || text.length > 300) throw new Error('Zəmanət mətni yalnız təhlükəsiz adi mətn ola bilər.');
    metadata.warrantyText = text;
  }
  if (plan.warrantyDuration != null && plan.warrantyDuration !== '') {
    const n = Number(plan.warrantyDuration);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Zəmanət müddəti tam müsbət rəqəm olmalıdır.');
    metadata.warrantyDuration = n;
  }
  for (const field of ['active','bestValue']) if (plan[field] != null) {
    if (typeof plan[field] !== 'boolean') throw new Error('Plan seçimi etibarsızdır.');
    metadata[field] = plan[field];
  }
  return metadata;
}
