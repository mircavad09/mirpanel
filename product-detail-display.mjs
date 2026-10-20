import {planMetrics, warrantyText} from './mirpanel-admin/public/product-plan-utils.mjs';

export function detailPlanMetrics(plan = {}) {
  const base = planMetrics(plan);
  const raw = plan.duration_months ?? plan.durationMonths ?? plan.months;
  const months = raw !== '' && raw != null && Number.isSafeInteger(Number(raw)) && Number(raw)>0 ? Number(raw) : null;
  return {...base, months, monthly: months>1 && base.price>0 ? base.price/months : null,
    warranty:['guaranteed','none'].includes(plan.warrantyMode) ? warrantyText(plan) : ''};
}
export function detailBestValueIndex(plans = [], unavailable = false) {
  if(unavailable) return -1;
  return plans.map((plan,index)=>({plan,index,m:detailPlanMetrics(plan)}))
    .filter(({plan,m})=>plan.active!==false && m.months>0 && m.price>0)
    .sort((a,b)=>a.m.price/a.m.months-b.m.price/b.m.months || b.m.months-a.m.months || a.index-b.index)[0]?.index ?? -1;
}
