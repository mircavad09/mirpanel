import {ensureEpointCheckout} from './epoint-checkout.mjs';
import {reconcileEpoint} from './epoint-reconcile.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
// Abandon the checkout UI, never invent a bank decline. Epoint reverse also
// reverses money and has no documented unpaid-only precondition: do not call it.
export async function abandonPurchaseAttempt(pool,user,id,options={}){
 await ensureEpointCheckout(pool);
 const owned=(await pool.query('select p.* from mirpanel_community.epoint_purchases p where p.id=$1 and p.user_id=$2',[id,user])).rows[0];
 if(!owned)throw fail(404,'Sifariş ödənişi tapılmadı.');
 await reconcileEpoint(pool,id,{...options,user,force:true}).catch(()=>{});
 const c=await pool.connect();try{
  await c.query('begin');
  if(!(await c.query("select pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired",['product-payment:'+user])).rows[0].acquired)throw fail(409,'Ödəniş hələ hazırlanır. Bir az sonra yenidən yoxlayın.');
  await c.query('select pg_advisory_xact_lock(714025001)');
  const p=(await c.query('select * from mirpanel_community.epoint_purchases where id=$1 for update',[id])).rows[0];
  const o=(await c.query('select * from public.payment_orders where id=$1 for update',[p.order_id])).rows[0];
  if(p.paid_at||o.payment_confirmed){await c.query('commit');return {id,status:'success',closed:false};}
  let q=(await c.query('select * from mirpanel_community.epoint_checkout_requests where id=$1 for update',[id])).rows[0];
  // No request row means startEpointCheckout never claimed/sent the API request.
  // A claimed `creating` row is NOT such evidence: its transport may be unknown.
  if(!q){q=(await c.query("insert into mirpanel_community.epoint_checkout_requests(id,user_id,cents,method,purpose,state) values($1,$2,$3,$4,'purchase','declined') returning *",[id,user,p.cents,p.method])).rows[0];}
  // Upgrade pre-existing retry chains too; a terminal ancestor may still receive
  // a delayed verified success. Never split that ancestor into another purchase.
  const family=(await c.query(`with recursive ancestors as(
   select id,previous_attempt,attempt_family,created_at from mirpanel_community.epoint_checkout_requests where id=$1 and user_id=$2
   union select q.id,q.previous_attempt,q.attempt_family,q.created_at from mirpanel_community.epoint_checkout_requests q join ancestors a on q.id=a.previous_attempt where q.user_id=$2)
   select coalesce(attempt_family,id) family from ancestors order by created_at,id limit 1`,[id,user])).rows[0].family;
  await c.query(`with recursive members as(select id from mirpanel_community.epoint_checkout_requests where id=$1 and user_id=$2 union select q.id from mirpanel_community.epoint_checkout_requests q join members m on q.previous_attempt=m.id where q.user_id=$2)
   update mirpanel_community.epoint_checkout_requests set attempt_family=$1 where id in(select id from members)`,[family,user]);
  // An unpaid UI attempt must not keep the only stock unit reserved and
  // indirectly block the replacement. Late verified success uses the existing
  // awaiting-stock recovery; releasing stock does not declare a bank failure.
  if(!p.reservation_released_at){
   await c.query('select public.inventory_release($1,$2)',[o.reservation_id,o.id]);
   await c.query("update public.payment_reservations set status='expired',updated_at=clock_timestamp() where (id=$1 or cart_parent_reservation_id=$1) and status in('reserved','reviewing')",[o.reservation_id]);
   await c.query('update mirpanel_community.epoint_purchases set reservation_released_at=clock_timestamp() where id=$1',[id]);
  }
  const closed=q.state==='declined'&&!q.candidate_transaction||['failed','error','returned'].includes(q.result_status);
  const reason=closed?(q.state==='declined'&&!q.candidate_transaction?'not_issued':'provider_terminal'):'provider_unresolved';
  if(!q.abandoned_at){
   await c.query('update mirpanel_community.epoint_checkout_requests set abandoned_at=clock_timestamp(),abandon_reason=$2,attempt_family=coalesce(attempt_family,id),next_check_at=clock_timestamp(),check_failures=0,status_checks=0 where id=$1',[id,reason]);
   await c.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',coalesce(checkout_snapshot->'epointPayment','{}')||jsonb_build_object('attemptAbandoned',true,'attemptClosed',$2::boolean,'abandonReason',$3::text)) where id=$1",[p.order_id,closed,reason]);
   await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('customer',$1,'payment.attempt_abandoned','order',$2,$3)",[user,p.order_id,{paymentId:id,reason,financialStatus:q.result_status,providerLinkRevoked:false}]);
  }
  await c.query('commit');
  return {id,status:closed?'failed':'pending',closed,canSwitch:true,providerLinkRevoked:false};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
