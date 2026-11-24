import {epointPost} from './epoint-api.mjs';
import {settleEpointResult} from './epoint-result.mjs';
import {ensureEpointCheckout} from './epoint-checkout.mjs';
import {recordPurchaseStatus} from './epoint-purchase.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function cents(value){
 const s=String(value??'');if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))throw fail(409,'Epoint məbləği uyğun deyil.');
 const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));
}
export async function reconcileEpoint(pool,id,{env=process.env,send=fetch,user=null,force=false}={}){
 const exists=(await pool.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='candidate_transaction') present")).rows[0].present;
 if(!exists)return;
 await ensureEpointCheckout(pool);
 // Claim a bounded lease in the database. No external call is held inside a transaction.
 const row=(await pool.query(`update mirpanel_community.epoint_checkout_requests set next_check_at=clock_timestamp()+interval '30 seconds'
  where id=$1 and (method<>'card' or purpose='purchase') and state='ready' and (candidate_transaction is not null or method in ('apple-pay','google-pay'))
   and ($2::text is null or user_id=$2) and result_status<>'success' and not recovery_hold and ($3 or next_check_at<=clock_timestamp())
  returning user_id,cents,candidate_transaction,method`,[id,user,force])).rows[0];
 if(!row)return;
 try{
  const result=await epointPost('get-status',row.candidate_transaction?{transaction:row.candidate_transaction}:{order_id:'mp_ep_'+id},{env,send});
  // Current get-status schema and actual responses omit operation_code.
  // An existing transaction is issued by wallet/payment or a signed callback.
  // Widget recovery uses our immutable merchant order ID, never a browser hint.
  // Its returned order ID must match exactly before binding the transaction.
  if(!ref(result.transaction)||row.candidate_transaction&&result.transaction!==row.candidate_transaction||result.operation_code!=null&&String(result.operation_code)!=='100')throw fail(409,'Epoint əməliyyatı uyğun deyil.');
  if((!row.candidate_transaction||result.order_id!=null)&&result.order_id!=='mp_ep_'+id)throw fail(409,'Epoint sifariş nömrəsi uyğun deyil.');
  // get-status does not document a currency field. These intents are issued
  // only in AZN. Explicit currency values from either channel must match.
  if(result.currency!=null&&result.currency!=='AZN')throw fail(409,'Epoint valyutası uyğun deyil.');
  if(cents(result.amount)!==Number(row.cents))throw fail(409,'Epoint məbləği uyğun deyil.');
  if(!['new','success','failed','error','server_error','returned'].includes(result.status))throw fail(503,'Epoint yekun vəziyyəti təsdiqləmədi.');
  const rawCode=String(result.code??'');
  const code=/^\d{1,3}$/.test(rawCode)?rawCode.padStart(3,'0'):['canceled','cancelled','succeeded'].includes(rawCode)?rawCode:null;
  if(result.status==='success'&&code!=='000'&&!(code==='succeeded'&&result.order_id==='mp_ep_'+id))throw fail(409,'Epoint bank təsdiqi uyğun deyil.');
  if(!row.candidate_transaction){
   const bound=await pool.query("update mirpanel_community.epoint_checkout_requests set candidate_transaction=$2 where id=$1 and (candidate_transaction is null or candidate_transaction=$2) returning id",[id,result.transaction]);
   if(!bound.rowCount)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
  }
  if(result.status==='success')await settleEpointResult(pool,{id,status:'success',transaction:result.transaction,cents:Number(row.cents)});
  await pool.query("update mirpanel_community.epoint_checkout_requests set result_status=$2,result_code=$3,result_checked_at=clock_timestamp(),check_failures=0,next_check_at=clock_timestamp()+interval '30 seconds',provider_issue=null where id=$1 and result_status<>'success'",[id,result.status,code]);
  await recordPurchaseStatus(pool,id,result.status,code);
  if(result.status==='new')await pool.query("update mirpanel_community.epoint_checkout_requests set next_check_at=now()+interval '2 minutes' where id=$1",[id]);
 }catch(error){
  await pool.query("update mirpanel_community.epoint_checkout_requests set check_failures=least(check_failures+1,10),provider_issue=$2,next_check_at=clock_timestamp()+make_interval(secs=>least(900,30*(2^least(check_failures,5))::int)) where id=$1 and result_status<>'success'",[id,error.status===409?'Provayder məlumatı uyğun deyil — operator yoxlaması tələb olunur':'Provayder nəticəsi alınmadı — server yenidən yoxlayacaq']);
  await pool.query("update public.payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{epointPayment}',coalesce(checkout_snapshot->'epointPayment','{}')||jsonb_build_object('recoveryIssue',$2::text)) where id=(select order_id from mirpanel_community.epoint_purchases where id=$1)",[id,'Provayder statusu təsdiqlənmədi — server təkrar yoxlayır; 10 uğursuz cəhddən sonra operator yoxlaması tələb olunur']).catch(()=>{});
  throw error;
 }
}
export async function acceptEpointResult(pool,result,options={}){
 const exists=(await pool.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='candidate_transaction') present")).rows[0].present;
 const row=exists?(await pool.query('select method,cents,state,candidate_transaction,result_status,purpose from mirpanel_community.epoint_checkout_requests where id=$1',[result.id])).rows[0]:null;
 if(!row||row.method==='card'&&row.purpose!=='purchase')return settleEpointResult(pool,result); // Existing hosted card contract is unchanged.
 if(result.status==='success'&&result.operationCode!=='100'&&!(row.method==='card'&&result.operationCode==null))throw fail(422,'Ödəniş əməliyyatının növü təsdiqlənmədi.');
 if(row.state!=='ready')throw fail(409,'Ödəniş hələ hazır deyil.');
 if(result.cents!=null&&Number(row.cents)!==result.cents)throw fail(409,'Ödəniş məbləği uyğun deyil.');
 if(!ref(result.transaction))throw fail(400,'Epoint əməliyyat nömrəsi çatışmır.');
 if(row.candidate_transaction&&row.candidate_transaction!==result.transaction)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
 const bound=await pool.query("update mirpanel_community.epoint_checkout_requests set candidate_transaction=$2 where id=$1 and (candidate_transaction is null or candidate_transaction=$2) returning id",[result.id,result.transaction]);
 if(!bound.rowCount)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
 if(row.result_status==='success')return;
 await reconcileEpoint(pool,result.id,{...options,force:true});
}
// Finish an interrupted projection without asking the provider again or creating
// a new financial operation. recordPurchaseStatus takes the fulfillment lock.
export async function repairEpointPurchaseStatuses(pool){
 if(!(await pool.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present)return;
 const rows=(await pool.query(`select q.id,q.result_status,q.result_code from mirpanel_community.epoint_checkout_requests q join mirpanel_community.epoint_purchases p on p.id=q.id join public.payment_orders o on o.id=p.order_id where p.paid_at is null and not o.payment_confirmed and q.result_status in ('failed','error','returned') and (o.checkout_snapshot->'epointPayment'->>'providerStatus' is distinct from q.result_status or p.reservation_released_at is null) order by q.created_at limit 20`)).rows;
 for(const r of rows)await recordPurchaseStatus(pool,r.id,r.result_status,r.result_code);
}
export function startEpointReconciliation(getPool,{env=process.env}={}){
 let running=false;
 const tick=async()=>{
  if(running||!env.EPOINT_PRIVATE_KEY?.trim())return;running=true;
  try{
   const pool=await getPool();
   if(!(await pool.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='candidate_transaction') present")).rows[0].present)return;
   await repairEpointPurchaseStatuses(pool);
   const rows=(await pool.query("select id from mirpanel_community.epoint_checkout_requests where (method<>'card' or purpose='purchase') and state='ready' and (candidate_transaction is not null or method in ('apple-pay','google-pay')) and result_status not in ('success','failed','error','returned') and not recovery_hold and check_failures<10 and next_check_at<=clock_timestamp() order by next_check_at limit 10")).rows;
   for(const {id} of rows)await reconcileEpoint(pool,id,{env}).catch(()=>{});
  }catch{}finally{running=false;}
 };
 const timer=setInterval(()=>void tick(),30000);timer.unref();void tick();
 return ()=>clearInterval(timer);
}
