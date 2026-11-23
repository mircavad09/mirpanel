import {createHash} from 'node:crypto';
import {registerEpointWalletIntent} from './epoint-result.mjs';
import {parseTopupCents,topupAmountText} from './community/public/topup-amount.js';
import {epointWallets} from './epoint-api.mjs';
import {inspectWalletOpening} from './epoint-opening.mjs';

const origin='https://mirpanel.com';
const endpoint='https://epoint.az/api/1/request';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=(status,message)=>Object.assign(Error(message),{status});
const pendingMessage='Ödəniş başlatma nəticəsi hələ məlum deyil. Yenidən ödəniş yaratmadan vəziyyəti yoxlayın.';
const tables=new WeakMap();
export function ensureEpointCheckout(pool){
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
     alter table mirpanel_community.epoint_checkout_requests add column if not exists method text not null default 'card'
      check(method in ('card','apple-pay','google-pay','m10','birbank'));
     alter table mirpanel_community.epoint_checkout_requests add column if not exists wallet_id text;
     alter table mirpanel_community.epoint_checkout_requests add column if not exists candidate_transaction text;
     alter table mirpanel_community.epoint_checkout_requests add column if not exists provider_trace text;
     alter table mirpanel_community.epoint_checkout_requests add column if not exists provider_issue text;
     alter table mirpanel_community.epoint_checkout_requests add column if not exists result_status text not null default 'new';
     alter table mirpanel_community.epoint_checkout_requests add column if not exists result_code text;
     alter table mirpanel_community.epoint_checkout_requests add column if not exists next_check_at timestamptz not null default clock_timestamp();
     alter table mirpanel_community.epoint_checkout_requests add column if not exists check_failures integer not null default 0;
     create index if not exists epoint_checkout_pending_check_idx on mirpanel_community.epoint_checkout_requests(next_check_at)
      where method<>'card' and state='ready' and candidate_transaction is not null and result_status not in ('success','failed','error','returned');
     alter table mirpanel_community.epoint_checkout_requests drop constraint if exists epoint_checkout_requests_method_check;
     alter table mirpanel_community.epoint_checkout_requests add constraint epoint_checkout_requests_method_check check(method in ('card','apple-pay','google-pay','m10','birbank'));
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
// These attestations are set only after Epoint confirms the merchant settings.
export function epointMethods(env){
 const keys=!!env.EPOINT_PUBLIC_KEY?.trim()&&!!env.EPOINT_PRIVATE_KEY?.trim();
 const widget=keys&&env.EPOINT_TOKEN_WIDGET_ENABLED==='true';
 return {card:epointCheckoutEnabled(env),
  'apple-pay':widget&&env.EPOINT_APPLE_PAY_ENABLED==='true'&&env.EPOINT_APPLE_DOMAIN_VERIFIED==='true',
  'google-pay':widget&&env.EPOINT_GOOGLE_PAY_ENABLED==='true',
  m10:keys&&env.EPOINT_M10_ENABLED==='true',birbank:keys&&env.EPOINT_BIRBANK_ENABLED==='true'};
}
function redirectUrl(value,env){
 if(typeof value!=='string'||value.length>2048)throw fail(503,pendingMessage);
 let url;
 try{url=new URL(value);}catch{throw fail(503,pendingMessage);}
 const additional=new Set(String(env.EPOINT_REDIRECT_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
 if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname==='epoint.az'||url.hostname.endsWith('.epoint.az')||additional.has(url.hostname)))throw fail(503,pendingMessage);
 return url.href;
}
function publicResult(row){
 const key=['apple-pay','google-pay'].includes(row.method)?'widget':'redirect';
 return {state:row.state,...(row.state==='ready'?{[key]:row.redirect_url}:{})};
}

// send is injected only by isolated tests. Production always uses the fixed HTTPS endpoint.
export async function startEpointCheckout(pool,user,body,{env=process.env,send=fetch}={}){
 const method=body?.method??'card';
 if(!['card','apple-pay','google-pay','m10','birbank'].includes(method))throw fail(400,'Ödəniş üsulu düzgün deyil.');
 if(!epointMethods(env)[method])throw fail(503,'Bu Epoint ödəniş üsulu aktiv deyil.');
 const widget=['apple-pay','google-pay'].includes(method),wallet=['m10','birbank'].includes(method);
 if(!user)throw fail(401,'Hesabınıza daxil olun.');
 if(!body||typeof body.requestId!=='string'||!uuid.test(body.requestId))throw fail(400,'Ödəniş identifikatoru düzgün deyil.');
 const id=body.requestId,cents=parseTopupCents(body.amount);
 const release=(await pool.query('select exists(select 1 from mirpanel_community.wallet_release where id and enabled) and exists(select 1 from mirpanel_community.shop_release where id and enabled) allowed')).rows[0];
 if(!release?.allowed)throw fail(503,'Balans xidməti aktiv deyil.');
 await ensureEpointCheckout(pool);
 let walletId=null;
 if(wallet){walletId=(await epointWallets({env,send}))[method];if(!walletId||!/^\d+$/.test(walletId)||!Number.isSafeInteger(Number(walletId))||Number(walletId)<=0)throw fail(503,'Bu cüzdan Epoint hesabında əlçatan deyil.');}
 const inserted=await pool.query('insert into mirpanel_community.epoint_checkout_requests(id,user_id,cents,method,wallet_id) values($1,$2,$3,$4,$5) on conflict(id) do nothing returning id',[id,user,cents,method,walletId]);
 if(!inserted.rowCount){
  const old=(await pool.query('select user_id,cents,state,method,redirect_url from mirpanel_community.epoint_checkout_requests where id=$1',[id])).rows[0];
  if(old?.user_id!==user||old.cents!==cents||old.method!==method)throw fail(409,'Ödəniş sorğusu uyğun deyil.');
  if(old.state==='ready'){
   const result=await readEpointCheckout(pool,user,id);
   if(result.status==='success')return {state:'credited'};
   if(result.status==='failed')return {state:'declined'};
  }
  return publicResult(old);
 }
 const orderId='mp_ep_'+id;
 const payload={public_key:env.EPOINT_PUBLIC_KEY.trim(),amount:widget||wallet?cents/100:topupAmountText(cents),order_id:orderId,description:'MirPanel balans artırma'};
 if(!widget)Object.assign(payload,{currency:'AZN',language:'az',success_redirect_url:origin+'/odenis/epoint/ugurlu?ref='+id,error_redirect_url:origin+'/odenis/epoint/ugursuz?ref='+id});
 if(wallet){payload.wallet_id=Number(walletId);delete payload.success_redirect_url;delete payload.error_redirect_url;}
 const data=Buffer.from(JSON.stringify(payload)).toString('base64'),key=env.EPOINT_PRIVATE_KEY.trim();
 const signature=createHash('sha1').update(key).update(data).update(key).digest('base64');
 let answer;
 try{
  const r=await send(widget?'https://epoint.az/api/1/token/widget':wallet?'https://epoint.az/api/1/wallet/payment':endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data,signature}),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Provider transport');
  answer=await r.json();
 }catch{throw fail(503,pendingMessage);}
 // Only a definite rejection without a provider transaction permits a new attempt.
 if((answer?.status==='error'||answer?.status==='failed')&&!answer.transaction){
  await pool.query("update mirpanel_community.epoint_checkout_requests set state='declined' where id=$1",[id]);
  return {state:'declined'};
 }
 if(wallet){
  const opening=inspectWalletOpening(answer);
  // Persist safe diagnostics even for null/invalid links. Never resend this UUID.
  await pool.query('update mirpanel_community.epoint_checkout_requests set candidate_transaction=$2,provider_trace=$3,provider_issue=$4 where id=$1',[id,opening.transaction,opening.trace,opening.issue]);
  if(!opening.ready)throw fail(503,opening.issue==='missing_redirect_url'?'Epoint ödəniş keçidini qaytarmadı. Təkrar ödəniş yaratmadan dəstəyə müraciət edin.':pendingMessage);
 }else if(answer?.status!=='success'||(!widget&&typeof answer.transaction!=='string'))throw fail(503,pendingMessage);
 // The documented widget response may contain only a URL. Its signed callback binds the transaction.
 const redirect=redirectUrl(widget?answer.widget_url:answer.redirect_url,env);
 if(widget){
  const parsed=new URL(redirect);
  if(parsed.hostname!=='epoint.az'&&!parsed.hostname.endsWith('.epoint.az'))throw fail(503,pendingMessage);
 }
 if(!widget||answer.transaction!=null)await registerEpointWalletIntent(pool,{orderId,userId:user,cents,transaction:answer.transaction});
 await pool.query("update mirpanel_community.epoint_checkout_requests set state='ready',redirect_url=$2,candidate_transaction=$3 where id=$1",[id,redirect,typeof answer.transaction==='string'?answer.transaction:null]);
 return publicResult({state:'ready',method,redirect_url:redirect});
}

export async function readEpointCheckout(pool,user,id){
 if(!user)throw fail(401,'Hesabınıza daxil olun.');
 if(typeof id!=='string'||!uuid.test(id))throw fail(400,'Ödəniş identifikatoru düzgün deyil.');
 const present=(await pool.query("select to_regclass('mirpanel_community.epoint_checkout_requests') requests,to_regclass('mirpanel_community.epoint_wallet_intents') intents")).rows[0];
 if(!present.requests)throw fail(404,'Ödəniş tapılmadı.');
 const row=(await pool.query("select state,cents,to_jsonb(r)->>'result_status' as result_status,to_jsonb(r)->>'result_code' as result_code,to_jsonb(r)->>'method' as method from mirpanel_community.epoint_checkout_requests r where id=$1 and user_id=$2",[id,user])).rows[0];
 if(!row)throw fail(404,'Ödəniş tapılmadı.');
 if(row.state==='declined')return {status:'failed'};
 const providerStatus=row.method&&row.method!=='card'?{providerStatus:row.result_status||'new',...(['failed','error'].includes(row.result_status)&&['180','canceled','cancelled'].includes(row.result_code)?{cancelled:true}:{})}:{};
 if(!present.intents)return {status:['failed','error','returned'].includes(row.result_status)?'failed':'pending',...providerStatus};
 const intent=(await pool.query('select status,credited_at,cents from mirpanel_community.epoint_wallet_intents where id=$1 and user_id=$2',[id,user])).rows[0];
 if(intent?.status==='success'&&intent.credited_at&&Number(intent.cents)===row.cents){
  const credit=(await pool.query("select after_cents,cents from mirpanel_community.wallet_ledger where user_id=$1 and request_id=$2 and kind='topup_credit'",[user,id])).rows[0];
  if(!credit||Number(credit.cents)!==Number(row.cents))throw fail(503,'Balans mədaxili hələ təsdiqlənmədi. Vəziyyəti yenidən yoxlayın.');
  return {status:'success',cents:row.cents,balanceCents:Number(credit.after_cents)};
 }
 return {status:['failed','error','returned'].includes(row.result_status||intent?.status)?'failed':'pending',...providerStatus};
}
