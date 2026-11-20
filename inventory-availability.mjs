// Shared public/server decision model: local ledger limits plus explicit supplier
// evidence. Supplier counts never change local reservation tracking.
export function inventoryAvailability(product, ledger) {
  const scope = ['product','plan'].includes(ledger?.scope) ? ledger.scope : product.stockEnabled === true ? 'product' : 'none';
  const count = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const salePaused = ledger?.salePaused;
  const legacyDisabled = ledger?.salesDisabled ?? (scope === 'none' && (product.soldOut === true || product.flow === 'out_of_stock'));
  const salesDisabled = (/^epinby_\d+$/.test(product.id)&&product.supplier?.provider!=='epinby') || (typeof salePaused === 'boolean' ? salePaused : legacyDisabled);
  const unlimited = scope === 'product' && ledger?.unlimited === true;
  const available = scope === 'product' && !unlimited ? count(ledger?.available ?? 0) : null;
  const plans = (product.plans || []).map((plan, index) => {
    const item = ledger?.plans?.find(p => p.planKey === String(index));
    // A newly added plan in a plan-managed product fails closed until configured.
    // Explicitly untracked plans retain their existing unlimited/manual flow.
    const tracked = (scope === 'product' && !unlimited) || (scope === 'plan' && item?.tracked !== false);
    let quantity = scope === 'product' ? available : tracked ? count(item?.available ?? 0) : null;
    const supplierStock=item?.supplierStock;
    if(supplierStock?.status==='out')quantity=0;
    else if(supplierStock?.status==='available'&&Number.isSafeInteger(supplierStock.count))quantity=quantity===null?supplierStock.count:Math.min(quantity,supplierStock.count);
    const active = plan.active !== false && item?.active !== false && Number.isFinite(Number(plan.price)) && Number(plan.price) > 0;
    return {planKey:String(index), active, tracked, available:quantity,...(supplierStock?{supplierStock}:{}),
      ...(item?.fulfillment?{fulfillment:item.fulfillment}:{}),
      canOrder:product.active !== false && active && !salesDisabled && (!supplierStock||supplierStock.status==='available') && (!tracked || quantity > 0)};
  });
  return {productId:product.id, scope, version:ledger?.version || 0, available, unlimited,
    ...(typeof salePaused === 'boolean' ? {salePaused} : {}), needsSetup:scope === 'product' && (!ledger || ledger.scope === 'none'), salesDisabled,
    canOrder:plans.some(p => p.canOrder), plans};
}
