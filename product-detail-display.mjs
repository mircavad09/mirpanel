import {planMetrics, warrantyText} from './mirpanel-admin/public/product-plan-utils.mjs';

export function detailPlanMetrics(plan = {}) {
  const base = planMetrics(plan);
  const positiveDuration = raw => Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : null;
  const days = positiveDuration(plan.durationDays);
  const months = days === null ? positiveDuration(plan.duration_months ?? plan.durationMonths ?? plan.months) : null;
  const duration = days ?? months;
  return {...base, days, months,
    rate: duration !== null && base.price > 0 ? base.price / duration : null,
    warranty:warrantyText(plan)};
}
export function detailBestValueIndex(plans = [], unavailable = false) {
  if(unavailable) return -1;
  const candidates = plans.map((plan,index)=>{
    const {days,months,price}=detailPlanMetrics(plan);
    return {plan,index,price,days:days ?? (months === null ? null : months*30)};
  }).filter(item=>item.plan.active!==false && item.days!==null && item.price>0);
  const preferred = candidates.filter(item=>item.plan.bestValue===true);
  if(preferred.length===1)return preferred[0].index;
  return candidates.sort((a,b)=>a.price/a.days-b.price/b.days || b.days-a.days || a.index-b.index)[0]?.index ?? -1;
}
