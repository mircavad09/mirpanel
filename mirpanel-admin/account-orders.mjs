import {orderLines} from './order-lines.mjs';
import {warrantyText} from './public/product-plan-utils.mjs';
import {customerOrderStatus} from './employee-order-status.mjs';
import {customerStatus,deliveryLines,orderCodeValid} from './community/order-delivery.mjs';
const denied=()=>Object.assign(Error('Sifarişlərinizi görmək üçün hesabınıza daxil olun.'),{status:401});
export function createAccountOrders({security,store,resolve}){
 async function scope(request){if(!resolve)throw denied();const s=await resolve(request);if(!s?.userId)throw denied();return s;}
 return {
  async list(request,cursor,code){const s=await scope(request);let before=null,id=null;
   if(code&&!orderCodeValid(code))throw Object.assign(Error('Sifariş nömrəsi düzgün deyil.'),{status:400});
   if(cursor){try{const c=JSON.parse(security.decryptSecret(cursor));if(c.purpose!=='account-orders-page'||c.userId!==s.userId||!Number.isFinite(Date.parse(c.createdAt))||! /^[0-9a-f-]{36}$/.test(c.id))throw Error();before=c.createdAt;id=c.id;}catch{throw Object.assign(Error('Səhifə göstəricisi düzgün deyil.'),{status:400});}}
   let products=[];try{products=(await s.catalog?.())?.products||[];}catch{}const imageFor=id=>products.find(p=>p.id===id)?.image||'';
   const [rows,target]=await Promise.all([s.page(before,id),!cursor&&code?s.byCode?.(code):null]),page=rows.slice(0,20),last=page.at(-1);
   if(target&&!page.some(o=>o.id===target.id))page.unshift(target);
   const deliveries=await s.deliveries?.(page.map(o=>o.id)),flows=!deliveries&&page.length&&store.workforceOrders?await store.workforceOrders(page.map(o=>o.id)):new Map();
   return {...(!cursor&&s.topups?{topups:await s.topups()}:{}),orders:page.map(o=>{
    const records=(deliveries||[]).filter(d=>d.order_id===o.id);
    const status=deliveries?customerStatus(o,records):o.status;
    return {id:o.id,orderCode:o.order_code,product:o.product_title,items:orderLines(o.checkout_snapshot).map((x,i)=>({...x,image:o.checkout_snapshot.items[i].image||imageFor(x.productId),warranty:warrantyText({...o.checkout_snapshot.items[i],label:x.planName})})),image:o.checkout_snapshot?.image||imageFor(o.product_id||o.checkout_snapshot?.productId),quantity:o.quantity||o.checkout_snapshot?.quantity||1,warranty:warrantyText({...o.checkout_snapshot,label:o.plan_name}),plan:o.plan_name,amount:o.amount===null?null:Number(o.amount),currency:o.currency,createdAt:o.created_at,status,statusMessage:status==='preparing'?'Ödəniş təsdiqləndi. Sifariş hazırlanır.':customerOrderStatus(status,flows.get(o.id)?.state),deliveries:['preparing','completed'].includes(status)?records.map(d=>({id:d.id,line:d.line_index,quantity:d.quantity})):[],receiptAvailable:!o.receipt_deleted_at&&!!o.receipt_path};
   }),nextCursor:rows.length>20?security.encryptSecret(JSON.stringify({purpose:'account-orders-page',userId:s.userId,createdAt:last.created_at,id:last.id})):null};
  },
  async codes(request,id){
   const s=await scope(request),rows=await s.codes?.(id)||[];
   if(id){const r=rows[0];if(!r)throw Object.assign(Error('Təhvil məlumatı tapılmadı.'),{status:404});const value=JSON.parse(security.decryptSecret(r.message_cipher));if(value.id!==r.id||value.order!==r.order_id||value.line!==r.line_index)throw Error('DELIVERY_REFERENCE_MISMATCH');return {text:value.message};}
   let products=[];try{products=(await s.catalog?.())?.products||[];}catch{}
   return {codes:rows.map(r=>{const x=deliveryLines({...r,quantity:r.order_quantity})[r.line_index];return{id:r.id,title:x.title,plan:x.planName,image:x.image||products.find(p=>p.id===x.productId)?.image||'',quantity:r.quantity,deliveredAt:r.delivered_at};})};
  },
  async receipt(request,id){const s=await scope(request),o=await s.owned(id);if(!o)throw Object.assign(Error('Sifariş tapılmadı.'),{status:404});if(!o.receipt_path||o.receipt_deleted_at)throw Object.assign(Error('Çek artıq mövcud deyil'),{status:410});
   try{return {url:await store.signedReceipt(o.receipt_path,60,'account-owner',o.id),mime:o.receipt_mime,expiresIn:60};}catch(e){if(e.status===404||Number(e.cause?.statusCode)===404)throw Object.assign(Error('Çek artıq mövcud deyil'),{status:410});throw Object.assign(Error('Çeki açmaq mümkün olmadı. Yenidən cəhd edin.'),{status:503});}
  }
 };
}
