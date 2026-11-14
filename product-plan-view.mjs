// One presentation for the first HTML response and subsequent plan updates.
import {detailPlanMetrics} from './product-detail-display.mjs';
import {deliveryText} from './mirpanel-admin/public/product-plan-utils.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number(value).toFixed(2).replace('.',',')+' ₼';
export function renderPlanTrust(product){
 const paths=['<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>','<path d="m4 16 5-5 4 3 7-9m-6 0h6v6"/>','<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>','<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'];
 return ['2024-dən fəaliyyət göstəririk','',deliveryText(product),'MirPanel əlavə komissiya tutmur'].map((value,index)=>`<li${index===1?' hidden':''}><svg viewBox="0 0 24 24" aria-hidden="true">${paths[index]}</svg><span>${esc(value)}</span></li>`).join('');
}
export function planName(plan){
 const m=detailPlanMetrics(plan),duration=m.days!==null?`${m.days} gün`:plan.durationMonths&&m.months!==null?`${m.months} ay`:'';
 const label=plan.label?.trim()||duration||(m.months===null?'Paket':`${m.months} aylıq`);
 return duration&&label!==duration?`${label} · ${duration}`:label;
}
export function renderPlanRows(product,selected=0){
 const plans=product.plans||[],delivery=product.deliveryText?.trim()||(product.deliveryType==='automatic'?'Anında':'');
 return plans.map((plan,index)=>{
  const m=detailPlanMetrics(plan),active=index===selected,name=planName(plan),id=`plan-details-${product.id}-${index}`;
  const image=!product.epinbyGroup&&plan.supplier?.provider==='epinby'&&/^\/?(?:assets|uploads)\//.test(plan.image||'')?`<img class="epinby-package-thumb" src="${esc(plan.image)}" alt="" width="52" height="38" loading="lazy">`:'';
  const named=plans.some(p=>!p.durationDays&&Number(p.months)===1&&/endirim/i.test(p.label||'')&&Number(p.regularPrice)>Number(p.price));
  const emphasis=!plan.durationDays&&Number(plan.months)===1&&m.discount>0&&(!named||/endirim/i.test(plan.label||''))?'discount-month':'standard';
  return `<div class="pp-plan-label${active?' active':''}" data-price-emphasis="${emphasis}" role="radio" aria-label="${esc(name)}" aria-checked="${active}" aria-controls="${esc(id)}" tabindex="${active?0:-1}"${plan.active===false?' hidden':''}><div class="pp-plan-left"><div class="pp-radio-circle"></div>${image}<div class="pp-plan-name">${esc(name)}${plan.bestValue===true?' <span class="product-detail-best">Ən sərfəli</span>':''}</div></div><div class="pp-plan-right">${m.oldPrice!==null?`<div class="pp-plan-price-meta"><div class="pp-old-price">${money(m.oldPrice)}</div><div class="pp-plan-disc-badge">-${m.discount}%</div></div>`:''}<div class="pp-new-price"${m.price>0?'':' hidden'}>${m.price>0?money(m.price):''}</div></div><span data-inventory-plan class="inventory-plan-count" hidden></span><span class="product-detail-plan-notes" id="${esc(id)}" role="region" aria-label="Paketin əlavə məlumatları"${active?'':' hidden'}>${delivery?`<span class="plan-fact plan-fact-delivery">${esc(delivery)}</span>`:''}${m.warranty?`<span class="plan-fact plan-fact-warranty">${esc(m.warranty)}</span>`:''}${m.rate!==null&&(m.days!==null||m.months>=2)?`<span class="product-detail-rate">${m.days!==null?'Gündə':'Ayda'} <strong>${money(m.rate)}</strong></span>`:''}</span></div>`;
 }).join('');
}
export function renderPlanSummary(product,index=0){
 const plan=product.plans?.[index];if(!plan)return '<p>Aktiv paket yoxdur.</p>';
 const m=detailPlanMetrics(plan);
 return `<p class="product-detail-summary-label">Seçilmiş paket: ${esc(planName(plan))}</p><div class="product-detail-summary-line"><div class="product-detail-summary-prices">${m.price!==null?`<strong>${money(m.price)}</strong>`:''}${m.oldPrice!==null?`<del>${money(m.oldPrice)}</del>`:''}${m.discount!==null?`<span class="product-detail-best">-${m.discount}%</span>`:''}</div>${m.savings!==null?`<p class="product-detail-savings"><strong>${money(m.savings)}</strong> <span class="product-detail-savings-caption">qənaət edirsiniz</span></p>`:''}</div><p class="product-detail-summary-delivery">${esc(deliveryText(product))}</p>`;
}
