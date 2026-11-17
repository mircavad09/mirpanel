// An estimate is based on the selected SKU, never its manual sale limit.
const checking='Təhvil məlumatı yoxlanılır…';
function manualText(value){
 const text=String(value||'').trim();
 return text&&!/anında|dərhal|avtomatik/i.test(text)?text:'';
}
export function readyDeliveryText(fulfillment,canOrder,configuredText=''){
 if(!fulfillment)return null;
 if(canOrder===false)return 'Stokda yoxdur';
 if(fulfillment.automatic&&fulfillment.ready>0)return 'Anında təqdim olunur';
 const configured=manualText(configuredText);
 if(fulfillment.allowWaiting&&fulfillment.ready===0)return configured||'15–30 dəqiqə ərzində tamamlanır';
 return configured||'Ödəniş təsdiqindən sonra təqdim olunur';
}
export function packageDeliveryText(product,index,stockPlan,{unavailable=false}={}){
 if(unavailable||!stockPlan)return checking;
 if(stockPlan.canOrder===false)return 'Stokda yoxdur';
 const plan=product.plans?.[index];
 const configured=plan?.deliveryText||product.deliveryText||'';
 const supplier=plan?.supplier??product.supplier;
 if(supplier?.provider==='epinby')return manualText(configured)||'Ödənişdən sonra avtomatik icra olunur';
 return readyDeliveryText(stockPlan.fulfillment,stockPlan.canOrder,configured)??checking;
}
