// Shared public/server decision model. Counts come only from the inventory ledger.
export function inventoryAvailability(product, ledger) {
  const scope = ['product','plan'].includes(ledger?.scope) ? ledger.scope : product.stockEnabled === true ? 'product' : 'none';
  const count = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  // An untracked product may be explicitly withdrawn from sale. This is not a stock count.
  const salesDisabled = scope === 'none' && (product.soldOut === true || product.flow === 'out_of_stock');
  const available = scope === 'product' ? count(ledger?.available ?? 0) : null;
  const plans = (product.plans || []).map((plan, index) => {
    const item = ledger?.plans?.find(p => p.planKey === String(index));
    const tracked = scope === 'product' || (scope === 'plan' && item?.tracked === true);
    const quantity = scope === 'product' ? available : tracked ? count(item?.available ?? 0) : null;
    const active = plan.active !== false && Number.isFinite(Number(plan.price)) && Number(plan.price) > 0;
    return {planKey:String(index), active, tracked, available:quantity,
      canOrder:product.active !== false && active && !salesDisabled && (!tracked || quantity > 0)};
  });
  return {productId:product.id, scope, version:ledger?.version || 0, available,
    needsSetup:scope === 'product' && !ledger, salesDisabled,
    canOrder:plans.some(p => p.canOrder), plans};
}
