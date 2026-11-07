const prefix='mirpanel-welcome:', queue='mirpanel-welcome/';
const known=new Set(['TOKEN_TEMPORARY','TOKEN_REJECTED','AUTH_CONFIGURATION','SEND_RATE_LIMITED','SEND_REJECTED','SEND_RESULT_UNKNOWN']);

// One durable record per account. A stale sending record is never requeued:
// the provider may have accepted the request before the process stopped.
export function createWelcomeDelivery(pool,send,{backoff=[5000,30000],pollMs=5000}={}){
 let running,timer;
 const log=(state,reason)=>console.warn('COMMUNITY_WELCOME_DELIVERY',state,reason);
 const save=(id,from,state,details)=>pool.query('update verification set identifier=$3,value=$4,"updatedAt"=now() where id=$1 and identifier=$2',[id,queue+from,queue+state,JSON.stringify(details)]);
 async function drain(){
  const stale=await pool.query(`update verification set identifier=$1,value=jsonb_set(value::jsonb,'{reason}','"SEND_RESULT_UNKNOWN"')::text,"updatedAt"=now()
   where identifier=$2 and "updatedAt"<now()-interval '2 minutes'`,[queue+'uncertain',queue+'sending']);
  if(stale.rowCount)log('uncertain','STALE_SENDING');
  for(let i=0;i<8;i++){
   const result=await pool.query(`with next as (
    select id,coalesce((value::jsonb->>'attempt')::int,0)+1 as attempt from verification
    where identifier in ($1,$2) and case when identifier in ($1,$2) then (value::jsonb->>'nextAt')::bigint <= (extract(epoch from now())*1000)::bigint else false end
    order by "updatedAt",id for update skip locked limit 1
   )
   update verification v set identifier=$3,value=jsonb_build_object('attempt',next.attempt)::text,"updatedAt"=now()
   from next where v.id=next.id returning v.id,next.attempt`,[queue+'queued',queue+'retry',queue+'sending']);
   const job=result.rows[0];if(!job)return;
   const user=(await pool.query('select id,email,"emailVerified" from "user" where id=$1',[job.id.slice(prefix.length)])).rows[0];
   if(!user?.emailVerified){await save(job.id,'sending','failed',{attempt:job.attempt,reason:'ACCOUNT_NOT_VERIFIED'});log('failed','ACCOUNT_NOT_VERIFIED');continue;}
   let receipt;
   try{receipt=await send('welcome',{user});if(typeof receipt?.id!=='string'||!receipt.id)throw Error('No provider receipt');}
   catch(e){
    const reason=known.has(e?.deliveryCode)?e.deliveryCode:'SEND_RESULT_UNKNOWN';
    const retry=e?.deliveryDisposition==='retry'&&job.attempt<=backoff.length;
    const state=retry?'retry':['retry','failed'].includes(e?.deliveryDisposition)?'failed':'uncertain';
    const delay=Number.isFinite(e?.retryAfterMs)?Math.max(0,e.retryAfterMs):0;
    await save(job.id,'sending',state,{attempt:job.attempt,reason,...(retry?{nextAt:Date.now()+Math.max(delay,backoff[job.attempt-1])}:{})});
    if(!retry)log(state,reason);continue;
   }
   // A provider success and an inbox delivery are separate observations.
   await save(job.id,'sending','accepted',{attempt:job.attempt,providerId:receipt.id});
  }
 }
 function wake(){if(!running)running=drain().catch(()=>log('worker-error','DATABASE_ERROR')).finally(()=>{running=null;});return running;}
 return {
  async enqueue(user){
   if(user?.emailVerified!==true)return;
   const id=prefix+user.id;
   try{await pool.query(`insert into verification(id,identifier,value,"expiresAt") values($1,$2,'{"nextAt":0}','9999-12-31') on conflict(id) do nothing`,[id,queue+'queued']);void wake();}
   catch{log('enqueue-error','DATABASE_ERROR');}
  },
  wake,
  start(){if(!timer){timer=setInterval(wake,pollMs);timer.unref?.();}void wake();},
  stop(){clearInterval(timer);timer=null;return running;}
 };
}
