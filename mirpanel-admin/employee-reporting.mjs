// Employee reporting is a separate ledger. Never use the public historical sales baseline.
import {planKey} from './payment-profit.mjs';
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
export function eligibleEmployeeOrder(employee, assignment, order) {
  const start = time(employee?.employee_started_at);
  if (start === null || !employee?.current_period_id) return false;
  return assignment?.employee_id === employee.id && assignment?.period_id === employee.current_period_id &&
    assignment?.order_id === order?.id && time(order?.created_at) !== null && time(order.created_at) >= start &&
    time(assignment?.assigned_at) !== null && time(assignment.assigned_at) >= start &&
    time(assignment?.accepted_at) !== null && time(assignment.accepted_at) >= start;
}

// Admin monthly preview only; not the live accrued-earnings counter. No ledger writes.
export function calculateMonthlyPayrollPreview({started = false, approvedOrders = 0, salaryCents = 50000,
  perOrderCents = 35, qualityCents = 5000, qualityEligible = false} = {}) {
  for (const value of [approvedOrders, salaryCents, perOrderCents, qualityCents]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Hesablama üçün mənfi olmayan tam rəqəmlər tələb olunur.');
  }
  if (!started) return {salaryCents:0,orderBonusCents:0,qualityCents:0,totalCents:0};
  const bonus = approvedOrders * perOrderCents, quality = qualityEligible ? qualityCents : 0;
  const total = salaryCents + bonus + quality;
  if (!Number.isSafeInteger(total)) throw new RangeError('Hesablama məbləği limiti aşır.');
  return {salaryCents,orderBonusCents:bonus,qualityCents:quality,totalCents:total};
}

export function exhaustedStockProducts(products, inventory) {
  // Inventory-enabled is explicit: absence of stock tracking is not "out of stock".
  return products.filter(product => product.active !== false && product.inventoryTracked === true &&
    (product.plans || []).some((plan,index) => plan.active !== false &&
      !inventory.some(unit => unit.product_id === product.id && unit.plan_id === planKey(plan,index) && unit.status === 'AVAILABLE')))
    .filter((product,index,list) => list.findIndex(item => item.id === product.id) === index).map(product => product.id);
}
