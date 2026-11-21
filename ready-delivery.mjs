// An estimate is based on the selected SKU, never its manual sale limit.
const checking='Təhvil məlumatı yoxlanılır…';
function manualText(value){
 const text=String(value||'').trim();
 return text&&!/anında|dərhal|avtomatik/i.test(text)?text:'';
}
export function readyDeliveryText(fulfillment,canOrder){
 return canOrder!==false&&fulfillment?.automatic===true
  &&Number.isSafeInteger(fulfillment.ready)&&fulfillment.ready>0?'Anında təqdim olunur':'';
}
// Consume server evidence for the exact package, never a title or manual limit.
export function instantPlanIndices(product,plans,{valid=true}={}){
 if(!valid||product?.active===false)return [];
 return Array.from(product.plans||[]).map((plan,index)=>({plan,index,stock:plans?.find(p=>p.planKey===String(index))}))
  .filter(({plan,stock})=>plan.active!==false&&Number(plan.price)>0
   &&(plan.supplier??product.supplier)?.provider!=='epinby'
   &&stock?.canOrder===true&&readyDeliveryText(stock.fulfillment,true))
  .sort((a,b)=>Number(a.plan.price)-Number(b.plan.price)||a.index-b.index).map(p=>p.index);
}
export function packageDeliveryText(product,index,stockPlan,{unavailable=false}={}){
 const plan=product.plans?.[index];
 const configured=plan?.deliveryText||product.deliveryText||'';
 const supplier=plan?.supplier??product.supplier;
 if(supplier?.provider==='epinby'){
  if(unavailable||!stockPlan)return checking;
  if(stockPlan.canOrder===false)return 'Stokda yoxdur';
  return manualText(configured)||'Ödənişdən sonra avtomatik icra olunur';
 }
 if(unavailable||!stockPlan||!plan)return '';
 return readyDeliveryText(stockPlan.fulfillment,stockPlan.canOrder);
}
