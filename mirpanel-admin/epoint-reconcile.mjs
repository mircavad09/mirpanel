import {epointPost} from './epoint-api.mjs';
import {settleEpointResult} from './epoint-result.mjs';
import {ensureEpointCheckout} from './epoint-checkout.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function cents(value){
 const s=String(value??'');if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))throw fail(409,'Epoint məbləği uyğun deyil.');
 const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));
}
// A widget message is only a lookup hint. The authenticated server must obtain
// an exact owner-bound order match from Epoint before persisting/crediting it.
export async function recoverWidgetTransaction(pool,user,id,transaction,{env=process.env,send=fetch}={}){
 if(!user||!ref(transaction)||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id||''))throw fail(400,'Ödəniş nömrəsi düzgün deyil.');
 const row=(await pool.query("select method,cents,state,candidate_transaction,result_status from mirpanel_community.epoint_checkout_requests where id=$1 and user_id=$2",[id,user])).rows[0];
 if(!row||!['apple-pay','google-pay'].includes(row.method))throw fail(404,'Ödəniş tapılmadı.');
 if(row.state!=='ready')throw fail(409,'Ödəniş hələ hazır deyil.');
 if(row.candidate_transaction&&row.candidate_transaction!==transaction)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
 if(row.result_status==='success')return;
 // A database lease bounds repeated browser hints and parallel processes.
 const claim=await pool.query("update mirpanel_community.epoint_checkout_requests set next_check_at=clock_timestamp()+interval '30 seconds' where id=$1 and user_id=$2 and result_status<>'success' and next_check_at<=clock_timestamp() returning id",[id,user]);
 if(!claim.rowCount)return;
 const answer=await epointPost('get-status',{transaction},{env,send});
 if(answer.transaction!==transaction||answer.order_id!=='mp_ep_'+id||cents(answer.amount)!==Number(row.cents)||answer.currency!=null&&answer.currency!=='AZN'||answer.operation_code!=null&&String(answer.operation_code)!=='100')throw fail(409,'Epoint əməliyyatı bu ödənişə uyğun deyil.');
 if(!['new','success','failed','error','server_error','returned'].includes(answer.status))throw fail(503,'Ödənişin vəziyyəti təsdiqlənmədi.');
 if(answer.status==='success'&&String(answer.code??'').padStart(3,'0')!=='000')throw fail(409,'Epoint bank təsdiqi uyğun deyil.');
 const bound=await pool.query("update mirpanel_community.epoint_checkout_requests set candidate_transaction=$3 where id=$1 and user_id=$2 and (candidate_transaction is null or candidate_transaction=$3) returning id",[id,user,transaction]);
 if(!bound.rowCount)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
 if(answer.status==='success')await settleEpointResult(pool,{id,status:'success',transaction,cents:Number(row.cents)});
 await pool.query("update mirpanel_community.epoint_checkout_requests set result_status=$2,result_code=$3,check_failures=0 where id=$1 and result_status<>'success'",[id,answer.status,String(answer.code??'').slice(0,20)]);
}
export async function reconcileEpoint(pool,id,{env=process.env,send=fetch,user=null,force=false}={}){
 const exists=(await pool.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='candidate_transaction') present")).rows[0].present;
 if(!exists)return;
 await ensureEpointCheckout(pool);
 // Claim a bounded lease in the database. No external call is held inside a transaction.
 const row=(await pool.query(`update mirpanel_community.epoint_checkout_requests set next_check_at=clock_timestamp()+interval '30 seconds'
  where id=$1 and method<>'card' and state='ready' and candidate_transaction is not null
   and ($2::text is null or user_id=$2) and result_status<>'success' and ($3 or next_check_at<=clock_timestamp())
  returning user_id,cents,candidate_transaction,method`,[id,user,force])).rows[0];
 if(!row)return;
 try{
  const result=await epointPost('get-status',{transaction:row.candidate_transaction},{env,send});
  // Current get-status schema and actual responses omit operation_code. The
  // transaction was issued by wallet/payment or bound by a signed payment
  // callback. Never infer an ID, and reject an explicit non-payment code.
  if(result.transaction!==row.candidate_transaction||result.operation_code!=null&&String(result.operation_code)!=='100')throw fail(409,'Epoint əməliyyatı uyğun deyil.');
  if(result.order_id!=null&&result.order_id!=='mp_ep_'+id)throw fail(409,'Epoint sifariş nömrəsi uyğun deyil.');
  // get-status does not document a currency field. These intents are issued
  // only in AZN. Explicit currency values from either channel must match.
  if(result.currency!=null&&result.currency!=='AZN')throw fail(409,'Epoint valyutası uyğun deyil.');
  if(cents(result.amount)!==Number(row.cents))throw fail(409,'Epoint məbləği uyğun deyil.');
  if(!['new','success','failed','error','server_error','returned'].includes(result.status))throw fail(503,'Epoint yekun vəziyyəti təsdiqləmədi.');
  const rawCode=String(result.code??'');
  const code=/^\d{1,3}$/.test(rawCode)?rawCode.padStart(3,'0'):['canceled','cancelled'].includes(rawCode)?rawCode:null;
  if(result.status==='success'&&code!=='000')throw fail(409,'Epoint bank təsdiqi uyğun deyil.');
  if(result.status==='success')await settleEpointResult(pool,{id,status:'success',transaction:result.transaction,cents:Number(row.cents)});
  await pool.query("update mirpanel_community.epoint_checkout_requests set result_status=$2,result_code=$3,check_failures=0,next_check_at=clock_timestamp()+interval '30 seconds' where id=$1 and result_status<>'success'",[id,result.status,code]);
 }catch(error){
  await pool.query("update mirpanel_community.epoint_checkout_requests set check_failures=least(check_failures+1,10),next_check_at=clock_timestamp()+make_interval(secs=>least(900,30*(2^least(check_failures,5))::int)) where id=$1 and result_status<>'success'",[id]);
  throw error;
 }
}
export async function acceptEpointResult(pool,result,options={}){
 const exists=(await pool.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='candidate_transaction') present")).rows[0].present;
 const row=exists?(await pool.query('select method,cents,state,candidate_transaction,result_status from mirpanel_community.epoint_checkout_requests where id=$1',[result.id])).rows[0]:null;
 if(!row||row.method==='card')return settleEpointResult(pool,result); // Existing hosted card contract is unchanged.
 if(result.status==='success'&&result.operationCode!=='100')throw fail(422,'Ödəniş əməliyyatının növü təsdiqlənmədi.');
 if(row.state!=='ready')throw fail(409,'Ödəniş hələ hazır deyil.');
 if(result.cents!=null&&Number(row.cents)!==result.cents)throw fail(409,'Ödəniş məbləği uyğun deyil.');
 if(!ref(result.transaction))throw fail(400,'Epoint əməliyyat nömrəsi çatışmır.');
 if(row.candidate_transaction&&row.candidate_transaction!==result.transaction)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
 const bound=await pool.query("update mirpanel_community.epoint_checkout_requests set candidate_transaction=$2 where id=$1 and (candidate_transaction is null or candidate_transaction=$2) returning id",[result.id,result.transaction]);
 if(!bound.rowCount)throw fail(409,'Epoint əməliyyat nömrəsi uyğun deyil.');
 if(row.result_status==='success')return;
 await reconcileEpoint(pool,result.id,{...options,force:true});
}
export function startEpointReconciliation(getPool,{env=process.env}={}){
 let running=false;
 const tick=async()=>{
  if(running||!env.EPOINT_PRIVATE_KEY?.trim())return;running=true;
  try{
   const pool=await getPool();
   if(!(await pool.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='candidate_transaction') present")).rows[0].present)return;
   const rows=(await pool.query("select id from mirpanel_community.epoint_checkout_requests where method<>'card' and state='ready' and candidate_transaction is not null and result_status not in ('success','failed','error','returned') and next_check_at<=clock_timestamp() order by next_check_at limit 10")).rows;
   for(const {id} of rows)await reconcileEpoint(pool,id,{env}).catch(()=>{});
  }catch{}finally{running=false;}
 };
 const timer=setInterval(()=>void tick(),30000);timer.unref();void tick();
 return ()=>clearInterval(timer);
}
