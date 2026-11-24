// Display metadata only. Match stable IDs exactly; never infer identity from names.
export function orderArtwork(order,catalog=[]){
 const products=new Map((Array.isArray(catalog)?catalog:catalog.products||[]).map(p=>[p.id,p]));
 const snapshot=order.checkout_snapshot||{};
 const lines=snapshot.cartVersion===2&&Array.isArray(snapshot.items)&&snapshot.items.length?snapshot.items:[{productId:order.product_id,title:order.product_title,planName:order.plan_name,quantity:order.quantity||snapshot.quantity||1,image:snapshot.image}];
 return lines.map(line=>({productId:line.productId,title:String(line.title||line.productName||order.product_title||'Məhsul'),planName:String(line.planName||''),quantity:Number.isSafeInteger(Number(line.quantity))&&Number(line.quantity)>0?Number(line.quantity):1,image:safeOrderImage(line.image)||safeOrderImage(products.get(line.productId)?.image)||''}));
}
export function safeOrderImage(value){
 if(typeof value!=='string'||!value.trim()||value.length>2048)return '';
 try{const url=new URL(value,'https://mirpanel.com/');if(url.protocol!=='https:'||url.username||url.password)return '';return url.href;}catch{return '';}
}
