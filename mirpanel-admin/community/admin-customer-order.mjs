import {adminOrderFields} from '../admin-order-fields.mjs';
import {orderPlayer} from '../order-player.mjs';
import {deliveryRecords,customerStatus,paid} from './order-delivery.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=id=>typeof id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
export const statusLabels={completed:'Tamamlandı',preparing:'Təhvil gözlənilir',reviewing:'Ödəniş yoxlanılır',cancelled:'Ləğv edildi',canceled:'Ləğv edildi',rejected:'Rədd edildi',expired:'Vaxtı bitdi',new_receipt_requested:'Yeni çek gözlənilir',pending:'Ödəniş gözlənilir',approved:'Ödəniş təsdiqləndi'};
export function historicalLines(o){
 const s=o.checkout_snapshot||{};
 return s.cartVersion===2&&Array.isArray(s.items)?s.items.map((x,index)=>({index,product:x.title||null,package:x.planName||null,quantity:x.quantity??null,unitCents:x.unitCents??null})):
 [{index:0,product:s.productName||o.product_title||null,package:s.planName||o.plan_name||null,quantity:o.quantity??s.quantity??null,unitCents:s.unitPrice!=null?Math.round(Number(s.unitPrice)*100):o.quantity&&o.amount!=null?Math.round(Number(o.amount)*100/Number(o.quantity)):null}];
}
export function adminOrderSummary(o,records=[]){
 const items=historicalLines(o),cancel=o.fulfillment_cancellation;
 const status=paid(o)&&!o.payment_confirmed&&!records.length&&o.completed_at?'completed':customerStatus(o,records);
 return {id:o.id,order_code:String(o.order_code),product_title:o.product_title,plan_name:o.plan_name,amount:o.amount==null?null:Number(o.amount),currency:o.currency,created_at:o.created_at,
 status,statusLabel:cancel&&!cancel.full?'Qismən təhvil / qismən ləğv':statusLabels[status]||'Vəziyyət qeydə alınmayıb',items,
 quantity:items.every(x=>Number.isFinite(Number(x.quantity))&&x.quantity!=null)?items.reduce((n,x)=>n+Number(x.quantity),0):null};
}
// Read the immutable order and delivery snapshots only. Never join current stock
// credentials, customer login credentials or current product form definitions.
export async function adminCustomerOrder(pool,security,userId,orderId){
 if(typeof userId!=='string'||!userId||userId.length>128||!uuid(orderId))throw fail(400,'Müştəri və sifariş düzgün seçilməyib.');
 const c=await pool.connect();
 try{
  await c.query('begin isolation level repeatable read read only');
  const o=(await c.query(`select o.*,coalesce(nullif(trim(ct.name),''),nullif(trim(o.customer_name),''),u.name) as order_customer_name,n.member_number::text as member_number
   from public.payment_orders o join mirpanel_community.community_order_owners l on l.order_id=o.id
   join mirpanel_community."user" u on u.id=l.user_id left join mirpanel_community.community_member_numbers n on n.user_id=u.id
   left join mirpanel_community.customer_order_contacts ct on ct.order_id=o.id
   where l.user_id=$1 and o.id=$2`,[userId,orderId])).rows[0];
  if(!o)throw fail(404,'Bu müştəriyə aid sifariş tapılmadı.');
  const records=await deliveryRecords(c,[o.id]);
  const summary=adminOrderSummary(o,records),snap=o.checkout_snapshot||{};
  const customerFields=adminOrderFields(o,{products:[]},security);
  const snapshots=snap.cartVersion===2&&Array.isArray(snap.items)?snap.items:[snap];
  for(const [index,line] of snapshots.entries()){
   const player=orderPlayer(security,line,line.productId||o.product_id);
   if(player?.verified)customerFields[index]?.fields.push({label:'Təsdiqlənmiş oyunçu adı',value:player.name,sensitive:false});
  }
  const deliveries=[];
  for(const row of (await c.query('select id,order_id,line_index,quantity,delivered_at,message_cipher from mirpanel_community.customer_order_deliveries where order_id=$1 order by delivered_at,id',[o.id])).rows){
   let value;try{value=JSON.parse(security.decryptSecret(row.message_cipher));if(value.id!==row.id||value.order!==o.id||value.line!==row.line_index)throw Error();}catch{deliveries.push({id:row.id,line:row.line_index,quantity:row.quantity,at:row.delivered_at,unavailable:true});continue;}
   deliveries.push({id:row.id,line:row.line_index,quantity:row.quantity,at:row.delivered_at,message:typeof value.message==='string'?value.message:null,
    fields:[['email','E-poçt',false],['password','Şifrə',true],['roomName','Otaq adı',false],['roomCode','Otaq kodu (PIN)',true]].filter(([key])=>typeof value[key]==='string'&&value[key]).map(([key,label,sensitive])=>({label,sensitive,value:value[key]}))});
  }
  const refund=(await c.query('select cents::text from mirpanel_community.community_refunds where order_id=$1',[o.id])).rows[0];
  const cancellation=o.fulfillment_cancellation;
  let confirmedAt=o.approved_at||null;
  if(o.payment_source==='wallet'&&snap.cartGroupId){confirmedAt=(await c.query("select created_at from mirpanel_community.wallet_ledger where request_id::text=$1 and kind='purchase_debit' and user_id=$2",[snap.cartGroupId,userId])).rows[0]?.created_at||null;}
  const lastDelivery=records.at(-1)?.delivered_at||null;
  const completionEvents=[lastDelivery,cancellation?.at].filter(v=>Number.isFinite(Date.parse(v)));
  const completedAt=completionEvents.length?completionEvents.sort((a,b)=>Date.parse(b)-Date.parse(a))[0]:o.completed_at||null;
  const result={...summary,customer:{name:o.order_customer_name,memberNumber:o.member_number},
   payment:{method:o.payment_source==='wallet'?'MirPanel balansı':o.method_name_snapshot||null,last4:o.payment_source==='wallet'?null:o.method_last4_snapshot||null,confirmed:paid(o)||o.payment_confirmed===true,status:o.payment_confirmed||paid(o)?'Ödəniş təsdiqlənib':o.status==='rejected'?'Ödəniş rədd edilib':'Ödəniş təsdiqlənməyib'},
   dates:{created:o.created_at,confirmed:confirmedAt,delivered:lastDelivery,completed:summary.status==='completed'?completedAt:null,cancelled:cancellation?.at||o.rejected_at||null},
   items:summary.items.map((x,index)=>({...x,delivered:records.filter(d=>d.line_index===index).reduce((n,d)=>n+d.quantity,0),cancelled:cancellation?.lines?.find(l=>l.index===index)?.quantity??null})),
   customerFields,deliveries,cancellation:cancellation||o.rejection_reason?{reason:cancellation?.reason||o.rejection_reason,lines:cancellation?.lines?.map(x=>({index:x.index,quantity:x.quantity})),requestedCents:cancellation?.refundCents??null,refundStatus:cancellation?.refundStatus||null}:null,
   refundedCents:refund?Number(refund.cents):0};
  await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
