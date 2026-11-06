// Explicit public projection: encrypted/private inputs never enter order lists.
export function orderLines(snapshot){return snapshot?.cartVersion===2&&Array.isArray(snapshot.items)?snapshot.items.map(x=>({productId:x.productId,title:x.title,planName:x.planName,quantity:x.quantity,unitCents:x.unitCents})):[];}
