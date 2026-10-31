import {customerOrderStatus} from './employee-order-status.mjs';
const denied=()=>Object.assign(Error('Sifarişlərinizi görmək üçün hesabınıza daxil olun.'),{status:401});
export function createAccountOrders({security,store,resolve}){
 async function scope(request){if(!resolve)throw denied();const s=await resolve(request);if(!s?.userId)throw denied();return s;}
 return {
  async list(request,cursor){const s=await scope(request);let before=null,id=null;
   if(cursor){try{const c=JSON.parse(security.decryptSecret(cursor));if(c.purpose!=='account-orders-page'||c.userId!==s.userId||!Number.isFinite(Date.parse(c.createdAt))||! /^[0-9a-f-]{36}$/.test(c.id))throw Error();before=c.createdAt;id=c.id;}catch{throw Object.assign(Error('Səhifə göstəricisi düzgün deyil.'),{status:400});}}
   const rows=await s.page(before,id),page=rows.slice(0,20),flows=page.length&&store.workforceOrders?await store.workforceOrders(page.map(o=>o.id)):new Map(),last=page.at(-1);
   return {orders:page.map(o=>({id:o.id,orderCode:o.order_code,product:o.product_title,plan:o.plan_name,amount:o.amount===null?null:Number(o.amount),currency:o.currency,createdAt:o.created_at,status:o.status,statusMessage:customerOrderStatus(o.status,flows.get(o.id)?.state),receiptAvailable:!o.receipt_deleted_at&&!!o.receipt_path})),nextCursor:rows.length>20?security.encryptSecret(JSON.stringify({purpose:'account-orders-page',userId:s.userId,createdAt:last.created_at,id:last.id})):null};
  },
  async receipt(request,id){const s=await scope(request),o=await s.owned(id);if(!o)throw Object.assign(Error('Sifariş tapılmadı.'),{status:404});if(!o.receipt_path||o.receipt_deleted_at)throw Object.assign(Error('Çek artıq mövcud deyil'),{status:410});
   try{return {url:await store.signedReceipt(o.receipt_path,60,'account-owner',o.id),mime:o.receipt_mime,expiresIn:60};}catch(e){if(e.status===404||Number(e.cause?.statusCode)===404)throw Object.assign(Error('Çek artıq mövcud deyil'),{status:410});throw Object.assign(Error('Çeki açmaq mümkün olmadı. Yenidən cəhd edin.'),{status:503});}
  }
 };
}
