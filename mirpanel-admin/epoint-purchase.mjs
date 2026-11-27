import {ensureBalanceNumbers} from './balance-operation-numbers.mjs';
import {readFile} from 'node:fs/promises';
import {createPaymentSecurity} from './payment-security.mjs';
import {allocateReadyStock,readyStockOrderItems} from './community/ready-stock.mjs';
import {ensureEpointCheckout} from './epoint-checkout.mjs';
import {epointDeliveryAccess,recoverManualEpointQueue} from './community/epoint-delivery-access.mjs';
const installed=new WeakMap();
const fail=(status,message)=>Object.assign(Error(message),{status});
export function ensureEpointPurchases(pool){
 if(!installed.has(pool)){
  const task=(async()=>{await ensureEpointCheckout(pool);const c=await pool.connect();try{
   await c.query('begin');await c.query("set local lock_timeout='5s'");
   await c.query('select pg_advisory_xact_lock(714025001)');
   await c.query(await readFile(new URL('./community/epoint-purchase.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('./community/fulfillment-holds.sql',import.meta.url),'utf8'));await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}await ensureBalanceNumbers(pool);})();
  installed.set(pool,task);task.catch(()=>installed.delete(pool));
 }return installed.get(pool);
}
// Called on the same transaction/row lock as the verified provider settlement.
// Returning true means this purpose must NEVER fall through to a wallet credit.
export async function settlePurchase(c,result){
 if(!(await c.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present)return false;
 const p=(await c.query('select * from mirpanel_community.epoint_purchases where id=$1 for update',[result.id])).rows[0];
 if(!p)return false;
 if(result.transaction&&(await c.query('select 1 from mirpanel_community.epoint_wallet_intents where provider_transaction=$1',[result.transaction])).rowCount)throw fail(409,'Əməliyyat balans artırmasına bağlıdır.');
 if(result.status!=='success')return true;
 if(Number(p.cents)!==result.cents||!result.transaction||p.transaction&&p.transaction!==result.transaction)throw fail(409,'Sifariş ödənişi uyğun deyil.');
 const request=(await c.query("select * from mirpanel_community.epoint_checkout_requests where id=$1 for update",[p.id])).rows[0];
 if(!request||request.purpose!=='purchase'||request.user_id!==p.user_id||request.method!==p.method||Number(request.cents)!==Number(p.cents)||request.candidate_transaction!==result.transaction||request.state!=='ready')throw fail(409,'Sifariş ödənişinin əlaqəsi təsdiqlənmədi.');
 if(p.paid_at)return true;
 const order=(await c.query('select * from public.payment_orders where id=$1 for update',[p.order_id])).rows[0];
 if(!order||order.payment_source!=='epoint'||Math.round(Number(order.amount)*100)!==Number(p.cents))throw fail(409,'Sifariş məbləği uyğun deyil.');
 const family=request.attempt_family||request.id;
 const winner=(await c.query('select p.order_id from mirpanel_community.epoint_purchases p join mirpanel_community.epoint_checkout_requests q on q.id=p.id where coalesce(q.attempt_family,q.id)=$1 and p.id<>$2 and p.paid_at is not null order by p.paid_at,p.id limit 1',[family,p.id])).rows[0];
 const state=winner?'awaiting_stock':p.reservation_released_at?'awaiting_stock':'queued';
 const fee=Math.floor((Number(p.cents)*p.fee_basis_points+5000)/10000);
 await c.query('update mirpanel_community.epoint_purchases set transaction=$2,paid_at=clock_timestamp(),state=$3,fee_cents=$4 where id=$1',[p.id,result.transaction,state,fee]);
 await c.query("update public.payment_orders set payment_confirmed=true,checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',(checkout_snapshot->'epointPayment')||$2::jsonb) where id=$1",[p.order_id,JSON.stringify({state,providerStatus:'success',recoveryIssue:null,cancelled:false,feeCents:fee,feeSource:p.fee_source,feeBasisPoints:p.fee_basis_points,paid:true})]);
 if(!winner){
  const unused=(await c.query('select p.id,o.id order_id,o.reservation_id from mirpanel_community.epoint_purchases p join mirpanel_community.epoint_checkout_requests q on q.id=p.id join public.payment_orders o on o.id=p.order_id where coalesce(q.attempt_family,q.id)=$1 and p.id<>$2 and p.paid_at is null and p.reservation_released_at is null for update of p,o',[family,p.id])).rows;
  for(const row of unused){await c.query('select public.inventory_release($1,$2)',[row.reservation_id,row.order_id]);await c.query("update public.payment_reservations set status='expired',updated_at=clock_timestamp() where (id=$1 or cart_parent_reservation_id=$1) and status in('reserved','reviewing')",[row.reservation_id]);await c.query('update mirpanel_community.epoint_purchases set reservation_released_at=clock_timestamp() where id=$1',[row.id]);}
 }
 if(winner){
  await c.query('insert into mirpanel_community.epoint_excess_payments(payment_id,family_id,winner_order_id,order_id,cents,transaction) values($1,$2,$3,$4,$5,$6) on conflict do nothing',[p.id,family,winner.order_id,p.order_id,p.cents,result.transaction]);
  await c.query("insert into mirpanel_community.fulfillment_holds(order_id,actor,reason) values($1,'epoint:excess','Artıq ödəniş — eyni alışın başqa cəhdi artıq ödənilib; ikinci təhvil verilmir') on conflict do nothing",[p.order_id]);
  await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',(checkout_snapshot->'epointPayment')||$2::jsonb) where id=$1",[p.order_id,JSON.stringify({excessPayment:true,winnerOrderId:winner.order_id,fulfillmentHold:true})]);
  await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system','epoint','payment.excess_received','order',$1,$2)",[p.order_id,{paymentId:p.id,winnerOrderId:winner.order_id,cents:Number(p.cents),transaction:result.transaction,refundCreated:false}]);
 }
 await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system','epoint','order.epoint_paid','order',$1,$2)",[p.order_id,{paymentId:p.id,method:p.method,transaction:result.transaction,cents:Number(p.cents),feeCents:fee,feeBasisPoints:p.fee_basis_points,feeSource:p.fee_source,state}]);
 return true;
}
export async function recordPurchaseStatus(pool,id,status,code){
 if(!(await pool.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present)return;
 const value={providerStatus:status,recoveryIssue:null,...(['failed','error','returned'].includes(status)?{attemptClosed:true}:{}),cancelled:['failed','error'].includes(status)&&['180','canceled','cancelled'].includes(code)};
 const c=await pool.connect();try{await c.query('begin;select pg_advisory_xact_lock(714025001)');
 const p=(await c.query('select * from mirpanel_community.epoint_purchases where id=$1 for update',[id])).rows[0];
 if(!p||p.paid_at){await c.query('commit');return;}
 const o=(await c.query('select * from public.payment_orders where id=$1 for update',[p.order_id])).rows[0];
 if(!o||o.payment_confirmed){await c.query('commit');return;}
 if(o.checkout_snapshot?.epointPayment?.providerStatus!==status||o.checkout_snapshot?.epointPayment?.cancelled!==value.cancelled)await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system','epoint','order.epoint_status','order',$1,$2)",[o.id,{paymentId:id,status,code,source:'verified-provider-status'}]);
 await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',(checkout_snapshot->'epointPayment')||$2::jsonb) where id=$1",[o.id,JSON.stringify(value)]);
 // Only a verified terminal provider result releases an unused reservation.
 if(['failed','error','returned'].includes(status)){
  const used=(await c.query('select 1 from mirpanel_community.customer_order_deliveries where order_id=$1 limit 1',[o.id])).rowCount;
  if(!used&&!o.fulfillment_cancellation){
   if(!p.reservation_released_at){await c.query('select public.inventory_release($1,$2)',[o.reservation_id,o.id]);await c.query('update mirpanel_community.epoint_purchases set reservation_released_at=clock_timestamp() where id=$1',[id]);}
   await c.query("update public.payment_reservations set status='expired',updated_at=clock_timestamp() where (id=$1 or cart_parent_reservation_id=$1) and status in('reserved','reviewing')",[o.reservation_id]);
  }
 }
 await c.query('commit');}catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function drainEpointPurchases(pool,config){
 if(!(await pool.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present)return;
 await ensureEpointPurchases(pool);
 const ids=(await pool.query("select id from mirpanel_community.epoint_purchases where (paid_at is not null and state in('queued','awaiting_stock') and next_delivery_at<=now()) or (paid_at is null and reservation_released_at is null and created_at<clock_timestamp()-interval '10 minutes') order by created_at limit 20")).rows;
 for(const {id} of ids){const c=await pool.connect();try{
  await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
  const p=(await c.query('select * from mirpanel_community.epoint_purchases where id=$1 for update',[id])).rows[0];
  const order=(await c.query('select * from public.payment_orders where id=$1 for update',[p.order_id])).rows[0];
  if(!p.paid_at&&!p.reservation_released_at&&Date.now()-Date.parse(p.created_at)>=600000){
   await c.query('select public.inventory_release($1,$2)',[order.reservation_id,order.id]);
   await c.query("update public.payment_reservations set status='expired',updated_at=clock_timestamp() where (id=$1 or cart_parent_reservation_id=$1) and status in ('reserved','reviewing')",[order.reservation_id]);
   await c.query('update mirpanel_community.epoint_purchases set reservation_released_at=clock_timestamp() where id=$1',[id]);
  }else if(p.paid_at&&['queued','awaiting_stock'].includes(p.state)){
   await c.query("update mirpanel_community.epoint_purchases set next_delivery_at=now()+interval '60 seconds' where id=$1",[id]);
   const held=(await c.query("select 1 from mirpanel_community.fulfillment_holds where order_id=$1 and released_at is null",[order.id])).rowCount;
   if(held){await c.query("update mirpanel_community.epoint_purchases set last_error='Ləğv müraciəti — təhvil dayandırılıb, geri ödəniş təsdiqlənməyib' where id=$1",[id]);await c.query('commit');continue;}
   if(order.fulfillment_cancellation||['cancelled','rejected','expired'].includes(order.status)){
    await c.query("update mirpanel_community.epoint_purchases set state='awaiting_stock',last_error='Ödənilib — stok və təhvilin operator tərəfindən yoxlanması tələb olunur' where id=$1",[id]);
    await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment,state}','\"awaiting_stock\"') where id=$1",[order.id]);
   }else{
    await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment,state}','\"ready\"') where id=$1",[order.id]);
    order.checkout_snapshot.epointPayment.state='ready';
    const items=await readyStockOrderItems(c,order);
    await allocateReadyStock(c,()=>createPaymentSecurity(config),order.id,items,'epoint:auto');
    const totals=await c.query('select line_index,sum(quantity)::int n from mirpanel_community.customer_order_deliveries where order_id=$1 group by line_index',[order.id]);
    const complete=items.length&&items.every((x,i)=>Number(totals.rows.find(r=>r.line_index===i)?.n||0)>=x.quantity);
    const access=await epointDeliveryAccess(c,order,{done:Object.fromEntries(totals.rows.map(r=>[r.line_index,r.n]))});
    // No automatic account delivery is expected for a manual service. Missing
    // ready-account stock is not a payment failure or a manual-delivery lock.
    const manual=access?.allowed&&access.lines.filter(x=>x.remaining>0).every(x=>x.allowed&&!x.requiresStock);
    if(manual){order.checkout_snapshot.epointPayment.state=p.state;await recoverManualEpointQueue(c,order,access,'epoint:queue-repair');}
    const state=complete||manual?'ready':'awaiting_stock',reason=complete||manual?null:access?.reason||'Ödəniş qəbul edildi — uyğun hesab stoku və ya avtomatik təhvil qaydası gözlənilir';
    await c.query('update mirpanel_community.epoint_purchases set state=$2,last_error=$3 where id=$1',[id,state,reason]);
    await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment,state}',to_jsonb($2::text)) where id=$1",[order.id,state]);
   }
  }
  await c.query('commit');
 }catch(e){await c.query('rollback');await pool.query("update mirpanel_community.epoint_purchases set last_error='Təhvilin təhlükəsiz təkrar yoxlanması gözlənilir' where id=$1",[id]);}finally{c.release();}}
}
export function startEpointPurchaseWorker(getPool,config){
 let busy=false;const tick=async()=>{if(busy)return;busy=true;try{await drainEpointPurchases(await getPool(),config);}catch{}finally{busy=false;}};
 const timer=setInterval(()=>void tick(),10000);timer.unref();void tick();return()=>clearInterval(timer);
}
