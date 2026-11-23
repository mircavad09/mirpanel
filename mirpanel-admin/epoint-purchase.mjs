import {readFile} from 'node:fs/promises';
import {createPaymentSecurity} from './payment-security.mjs';
import {allocateReadyStock,readyStockOrderItems} from './community/ready-stock.mjs';
const installed=new WeakMap();
const fail=(status,message)=>Object.assign(Error(message),{status});
export function ensureEpointPurchases(pool){
 if(!installed.has(pool)){
  const task=(async()=>{const c=await pool.connect();try{
   await c.query('begin');await c.query("set local lock_timeout='5s'");
   await c.query('select pg_advisory_xact_lock(714025001)');
   await c.query(await readFile(new URL('./community/epoint-purchase.sql',import.meta.url),'utf8'));await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}})();
  installed.set(pool,task);task.catch(()=>installed.delete(pool));
 }return installed.get(pool);
}
// Called on the same transaction/row lock as the verified provider settlement.
// Returning true means this purpose must NEVER fall through to a wallet credit.
export async function settlePurchase(c,result){
 if(!(await c.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present)return false;
 const p=(await c.query('select * from mirpanel_community.epoint_purchases where id=$1 for update',[result.id])).rows[0];
 if(!p)return false;
 if(result.status!=='success')return true;
 if(Number(p.cents)!==result.cents||!result.transaction||p.transaction&&p.transaction!==result.transaction)throw fail(409,'Sifariş ödənişi uyğun deyil.');
 const request=(await c.query("select * from mirpanel_community.epoint_checkout_requests where id=$1 for update",[p.id])).rows[0];
 if(!request||request.purpose!=='purchase'||request.user_id!==p.user_id||request.method!==p.method||Number(request.cents)!==Number(p.cents)||request.candidate_transaction!==result.transaction||request.state!=='ready')throw fail(409,'Sifariş ödənişinin əlaqəsi təsdiqlənmədi.');
 if(p.paid_at)return true;
 const order=(await c.query('select * from public.payment_orders where id=$1 for update',[p.order_id])).rows[0];
 if(!order||order.payment_source!=='epoint'||Math.round(Number(order.amount)*100)!==Number(p.cents))throw fail(409,'Sifariş məbləği uyğun deyil.');
 const state=p.reservation_released_at?'awaiting_stock':'queued';
 const fee=Math.floor((Number(p.cents)*p.fee_basis_points+5000)/10000);
 await c.query('update mirpanel_community.epoint_purchases set transaction=$2,paid_at=clock_timestamp(),state=$3,fee_cents=$4 where id=$1',[p.id,result.transaction,state,fee]);
 await c.query("update public.payment_orders set payment_confirmed=true,checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',(checkout_snapshot->'epointPayment')||$2::jsonb) where id=$1",[p.order_id,JSON.stringify({state,feeCents:fee,feeSource:p.fee_source,feeBasisPoints:p.fee_basis_points,paid:true})]);
 await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system','epoint','order.epoint_paid','order',$1,$2)",[p.order_id,{paymentId:p.id,method:p.method,transaction:result.transaction,cents:Number(p.cents),feeCents:fee,feeBasisPoints:p.fee_basis_points,feeSource:p.fee_source,state}]);
 return true;
}
export async function drainEpointPurchases(pool,config){
 if(!(await pool.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present)return;
 const ids=(await pool.query("select id from mirpanel_community.epoint_purchases where state='queued' or (paid_at is null and reservation_released_at is null and created_at<clock_timestamp()-interval '10 minutes') order by created_at limit 20")).rows;
 for(const {id} of ids){const c=await pool.connect();try{
  await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
  const p=(await c.query('select * from mirpanel_community.epoint_purchases where id=$1 for update',[id])).rows[0];
  const order=(await c.query('select * from public.payment_orders where id=$1 for update',[p.order_id])).rows[0];
  if(!p.paid_at&&!p.reservation_released_at){
   await c.query('select public.inventory_release($1,$2)',[order.reservation_id,order.id]);
   await c.query("update public.payment_reservations set status='expired',updated_at=clock_timestamp() where (id=$1 or cart_parent_reservation_id=$1) and status in ('reserved','reviewing')",[order.reservation_id]);
   await c.query('update mirpanel_community.epoint_purchases set reservation_released_at=clock_timestamp() where id=$1',[id]);
  }else if(p.paid_at&&p.state==='queued'){
   if(p.reservation_released_at||order.fulfillment_cancellation||['cancelled','rejected','expired'].includes(order.status)){
    await c.query("update mirpanel_community.epoint_purchases set state='awaiting_stock',last_error='Ödənilib — stok və təhvilin operator tərəfindən yoxlanması tələb olunur' where id=$1",[id]);
    await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment,state}','\"awaiting_stock\"') where id=$1",[order.id]);
   }else{
    await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment,state}','\"ready\"') where id=$1",[order.id]);
    order.checkout_snapshot.epointPayment.state='ready';
    const items=await readyStockOrderItems(c,order);
    await allocateReadyStock(c,()=>createPaymentSecurity(config),order.id,items,'epoint:auto');
    await c.query("update mirpanel_community.epoint_purchases set state='ready',last_error=null where id=$1",[id]);
   }
  }
  await c.query('commit');
 }catch(e){await c.query('rollback');await pool.query("update mirpanel_community.epoint_purchases set last_error='Təhvilin təhlükəsiz təkrar yoxlanması gözlənilir' where id=$1",[id]);}finally{c.release();}}
}
export function startEpointPurchaseWorker(getPool,config){
 let busy=false;const tick=async()=>{if(busy)return;busy=true;try{await drainEpointPurchases(await getPool(),config);}catch{}finally{busy=false;}};
 const timer=setInterval(()=>void tick(),10000);timer.unref();void tick();return()=>clearInterval(timer);
}
