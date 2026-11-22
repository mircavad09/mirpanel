import {adminOrderFields} from './admin-order-fields.mjs';
// Call only after resolving the authenticated order owner. Never use profile
// email/password as a fallback, or put these values in list/catalog responses.
export function customerOrderInputs(order,catalog,security){
 const snapshot=order.checkout_snapshot||{};
 const items=snapshot.cartVersion===2&&Array.isArray(snapshot.items)?snapshot.items:[snapshot];
 return items.map((item,index)=>{
  const productId=item.productId||order.product_id;
  let fields=[],unavailable=false;
  try{fields=adminOrderFields({...order,checkout_snapshot:item},catalog||{},security)[0]?.fields||[];}
  catch{unavailable=true;}
  return {index,title:item.title||catalog?.products?.find(p=>p.id===productId)?.title||order.product_title,
   planName:item.planName||order.plan_name,unavailable,
   fields:fields.map(({label,sensitive,value})=>({label,sensitive,value}))};
 });
}
