import {reconcileEpoint} from './epoint-reconcile.mjs';
import {readEpointCheckout} from './epoint-checkout.mjs';

// Explicit authenticated return closes only the user's attempt. The provider
// transaction is neither reversed nor declared financially failed.
export async function abandonTopupAttempt(pool,user,id,options={}){
 await reconcileEpoint(pool,id,{...options,user,force:true}).catch(()=>{});
 const c=await pool.connect();
 try{
  await c.query('begin');
  await c.query('select pg_advisory_xact_lock(714025001)');
  const q=(await c.query("select * from mirpanel_community.epoint_checkout_requests where id=$1 and user_id=$2 and purpose='topup' for update",[id,user])).rows[0];
  if(!q)throw Object.assign(Error('Ödəniş tapılmadı.'),{status:404});
  const present=(await c.query("select to_regclass('mirpanel_community.epoint_wallet_intents') present")).rows[0].present;
  const winner=present?(await c.query(`select i.id from mirpanel_community.epoint_wallet_intents i join mirpanel_community.epoint_checkout_requests r on r.id=i.id
   where r.user_id=$1 and coalesce(r.attempt_family,r.id)=$2 and i.credited_at is not null`,[user,q.attempt_family||id])).rows[0]:null;
  if(!winner&&!q.excess_paid_at){
   const closed=q.state==='declined'&&!q.candidate_transaction||['failed','error','returned'].includes(q.result_status);
   await c.query(`update mirpanel_community.epoint_checkout_requests set abandoned_at=coalesce(abandoned_at,clock_timestamp()),
    abandon_reason=coalesce(abandon_reason,$2),attempt_family=coalesce(attempt_family,id),next_check_at=clock_timestamp(),
    check_failures=0,status_checks=0 where id=$1 and abandoned_at is null`,[id,closed?'provider_terminal':'provider_unresolved']);
  }
  await c.query('commit');
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
 const status=await readEpointCheckout(pool,user,id);
 return {...status,canSwitch:status.status!=='success',providerLinkRevoked:false};
}
