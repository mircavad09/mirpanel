import {createHash} from 'node:crypto';
import {registerEpointWalletIntent} from './epoint-result.mjs';
import {parseTopupCents,topupAmountText} from './community/public/topup-amount.js';

const origin='https://mirpanel.com';
const endpoint='https://epoint.az/api/1/request';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=(status,message)=>Object.assign(Error(message),{status});
const pendingMessage='Ödəniş başlatma nəticəsi hələ məlum deyil. Yenidən ödəniş yaratmadan vəziyyəti yoxlayın.';
const tables=new WeakMap();
function ensure(pool){
 if(!tables.has(pool)){
  const task=(async()=>{
   const c=await pool.connect();
   try{
    await c.query('begin');
    await c.query("set local lock_timeout='5s'");
    await c.query('select pg_advisory_xact_lock(926111719)');
    await c.query(`create table if not exists mirpanel_community.epoint_checkout_requests (
     id uuid primary key,user_id text not null references mirpanel_community."user"(id),
     cents integer not null check(cents between 100 and 50000),redirect_url text,
     state text not null default 'creating' check(state in ('creating','ready','declined')),
     created_at timestamptz not null default clock_timestamp(),
     check((state='ready')=(redirect_url is not null)));
     alter table mirpanel_community.epoint_checkout_requests enable row level security;
     revoke all on mirpanel_community.epoint_checkout_requests from public,anon,authenticated;`);
    await c.query('commit');
   }catch(e){await c.query('rollback');throw e;}finally{c.release();}
  })();
  tables.set(pool,task);task.catch(()=>tables.delete(pool));
 }
 return tables.get(pool);
}
export function epointCheckoutEnabled(env){
 return env.EPOINT_CHECKOUT_ENABLED==='true'&&!!env.EPOINT_PUBLIC_KEY?.trim()&&!!env.EPOINT_PRIVATE_KEY?.trim();
}
function redirectUrl(value,env){
 if(typeof value!=='string'||value.length>2048)throw fail(503,pendingMessage);
 let url;
 try{url=new URL(value);}catch{throw fail(503,pendingMessage);}
 const additional=new Set(String(env.EPOINT_REDIRECT_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
 if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname==='epoint.az'||url.hostname.endsWith('.epoint.az')||additional.has(url.hostname)))throw fail(503,pendingMessage);
 return url.href;
}
function publicResult(row){return {state:row.state,...(row.state==='ready'?{redirect:row.redirect_url}:{})};}

// send is injected only by isolated tests. Production always uses the fixed HTTPS endpoint.
export async function startEpointCheckout(pool,user,body,{env=process.env,send=fetch}={}){
 if(!epointCheckoutEnabled(env))throw fail(503,'Epoint ilə balans artırma aktiv deyil.');
 if(!user)throw fail(401,'Hesabınıza daxil olun.');
 if(!body||typeof body.requestId!=='string'||!uuid.test(body.requestId))throw fail(400,'Ödəniş identifikatoru düzgün deyil.');
 const id=body.requestId,cents=parseTopupCents(body.amount);
 const release=(await pool.query('select exists(select 1 from mirpanel_community.wallet_release where id and enabled) and exists(select 1 from mirpanel_community.shop_release where id and enabled) allowed')).rows[0];
 if(!release?.allowed)throw fail(503,'Balans xidməti aktiv deyil.');
 await ensure(pool);
 const inserted=await pool.query('insert into mirpanel_community.epoint_checkout_requests(id,user_id,cents) values($1,$2,$3) on conflict(id) do nothing returning id',[id,user,cents]);
 if(!inserted.rowCount){
  const old=(await pool.query('select user_id,cents,state,redirect_url from mirpanel_community.epoint_checkout_requests where id=$1',[id])).rows[0];
  if(old?.user_id!==user||old.cents!==cents)throw fail(409,'Ödəniş sorğusu uyğun deyil.');
  if(old.state==='ready'){
   const result=await readEpointCheckout(pool,user,id);
   if(result.status==='success')return {state:'credited'};
   if(result.status==='failed')return {state:'declined'};
  }
  return publicResult(old);
 }
 const orderId='mp_ep_'+id;
 const payload={public_key:env.EPOINT_PUBLIC_KEY.trim(),amount:topupAmountText(cents),currency:'AZN',language:'az',order_id:orderId,description:'MirPanel balans artırma',
  success_redirect_url:origin+'/odenis/epoint/ugurlu?ref='+id,error_redirect_url:origin+'/odenis/epoint/ugursuz?ref='+id};
 const data=Buffer.from(JSON.stringify(payload)).toString('base64'),key=env.EPOINT_PRIVATE_KEY.trim();
 const signature=createHash('sha1').update(key).update(data).update(key).digest('base64');
 let answer;
 try{
  const r=await send(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data,signature}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Provider transport');
  answer=await r.json();
 }catch{throw fail(503,pendingMessage);}
 // Only a definite rejection without a provider transaction permits a new attempt.
 if((answer?.status==='error'||answer?.status==='failed')&&!answer.transaction){
  await pool.query("update mirpanel_community.epoint_checkout_requests set state='declined' where id=$1",[id]);
  return {state:'declined'};
 }
 if(answer?.status!=='success'||typeof answer.transaction!=='string')throw fail(503,pendingMessage);
 const redirect=redirectUrl(answer.redirect_url,env);
 await registerEpointWalletIntent(pool,{orderId,userId:user,cents,transaction:answer.transaction});
 await pool.query("update mirpanel_community.epoint_checkout_requests set state='ready',redirect_url=$2 where id=$1",[id,redirect]);
 return {state:'ready',redirect};
}

export async function readEpointCheckout(pool,user,id){
 if(!user)throw fail(401,'Hesabınıza daxil olun.');
 if(typeof id!=='string'||!uuid.test(id))throw fail(400,'Ödəniş identifikatoru düzgün deyil.');
 const present=(await pool.query("select to_regclass('mirpanel_community.epoint_checkout_requests') requests,to_regclass('mirpanel_community.epoint_wallet_intents') intents")).rows[0];
 if(!present.requests)throw fail(404,'Ödəniş tapılmadı.');
 const row=(await pool.query('select state,cents from mirpanel_community.epoint_checkout_requests where id=$1 and user_id=$2',[id,user])).rows[0];
 if(!row)throw fail(404,'Ödəniş tapılmadı.');
 if(row.state==='declined')return {status:'failed'};
 if(!present.intents)return {status:'pending'};
 const intent=(await pool.query('select status,credited_at,cents from mirpanel_community.epoint_wallet_intents where id=$1 and user_id=$2',[id,user])).rows[0];
 if(intent?.status==='success'&&intent.credited_at&&Number(intent.cents)===row.cents)return {status:'success',cents:row.cents};
 return {status:['failed','error','returned'].includes(intent?.status)?'failed':'pending'};
}
