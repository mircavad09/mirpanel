import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {postLedger} from './shop.mjs';

const fail=(status,message)=>Object.assign(Error(message),{status});
const reference=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const prefix='mp_ep_';
const orderIdPattern=/^mp_ep_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const statuses=new Set(['new','success','failed','error','server_error','returned']);
const installed=new WeakMap();
function ensure(pool){
 if(!installed.has(pool)){
  const pending=(async()=>{
   const c=await pool.connect();
   try{
    await c.query('begin');
    await c.query("set local lock_timeout='5s'");
    await c.query('select pg_advisory_xact_lock(926111718)');
    if(!(await c.query("select to_regclass('mirpanel_community.epoint_wallet_intents') present")).rows[0].present)
     await c.query(await readFile(new URL('./community/epoint-result.sql',import.meta.url),'utf8'));
    await c.query('commit');
   }catch(e){await c.query('rollback');throw e;}finally{c.release();}
  })();
  installed.set(pool,pending);pending.catch(()=>installed.delete(pool));
 }
 return installed.get(pool);
}
function decode64(s){
 if(typeof s!=='string'||!s||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw fail(400,'Bildiriş formatı düzgün deyil.');
 const b=Buffer.from(s,'base64');
 if(b.toString('base64')!==s)throw fail(400,'Bildiriş formatı düzgün deyil.');
 return b;
}
function parseCents(amount){
 const s=String(amount??'');
 if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))throw fail(400,'Məbləğ düzgün deyil.');
 const [whole,frac='']=s.split('.');
 const cents=Number(whole)*100+Number(frac.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<=0)throw fail(400,'Məbləğ düzgün deyil.');
 return cents;
}
export function verifyEpointResult(raw,contentType,privateKey){
 if(typeof privateKey!=='string'||!privateKey.trim())throw fail(503,'Epoint sazlanmayıb.');
 let data,signature;
 const mime=String(contentType||'').split(';')[0].trim().toLowerCase();
 if(mime==='application/x-www-form-urlencoded'){
  const form=new URLSearchParams(raw.toString('utf8'));
  if(form.getAll('data').length!==1||form.getAll('signature').length!==1)throw fail(400,'Bildiriş formatı düzgün deyil.');
  data=form.get('data');signature=form.get('signature');
 }else if(mime==='application/json'){
  try{({data,signature}=JSON.parse(raw.toString('utf8')));}catch{throw fail(400,'Bildiriş formatı düzgün deyil.');}
 }else throw fail(415,'Bildiriş formatı dəstəklənmir.');
 if(typeof data!=='string'||data.length>32768||typeof signature!=='string'||signature.length!==28)throw fail(400,'Bildiriş formatı düzgün deyil.');
 const received=decode64(signature),expected=createHash('sha1').update(privateKey).update(data).update(privateKey).digest();
 if(received.length!==expected.length||!timingSafeEqual(received,expected))throw fail(401,'Bildiriş imzası etibarsızdır.');
 let value;
 const decoded=decode64(data);
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));}catch{throw fail(400,'Bildiriş formatı düzgün deyil.');}
 if(!value||!reference(value.order_id)||!statuses.has(value.status))throw fail(400,'Bildiriş məlumatı düzgün deyil.');
 if(!orderIdPattern.test(value.order_id))throw fail(404,'Ödəniş qeydi tapılmadı.');
 if(value.operation_code!=null&&String(value.operation_code)!=='100')throw fail(422,'Bu əməliyyat dəstəklənmir.');
 if(value.currency!=null&&value.currency!=='AZN')throw fail(409,'Ödəniş valyutası uyğun deyil.');
 if(value.status==='success'&&(!reference(value.transaction)||String(value.operation_code??'100')!=='100'))throw fail(400,'Əməliyyat identifikatoru düzgün deyil.');
 return {id:value.order_id.slice(prefix.length),status:value.status,transaction:reference(value.transaction)?value.transaction:null,cents:value.amount!=null?parseCents(value.amount):null,...(value.operation_code!=null?{operationCode:String(value.operation_code)}:{})};
}

// Server-only handoff from a future payment-creation flow. The provider ID must
// come from its trusted API response; never accept an intent from a callback.
export function newEpointOrderId(){return prefix+randomUUID();}
export async function registerEpointWalletIntent(pool,{orderId,userId,cents,transaction}){
 if(!orderIdPattern.test(orderId)||!reference(transaction)||!Number.isSafeInteger(cents)||cents<100||cents>50000)throw fail(400,'Ödəniş qeydi düzgün deyil.');
 await ensure(pool);
 const inserted=await pool.query('insert into mirpanel_community.epoint_wallet_intents(id,user_id,cents,provider_transaction) values($1,$2,$3,$4) on conflict(id) do nothing returning id',[orderId.slice(prefix.length),userId,cents,transaction]);
 if(inserted.rowCount===0){
  const old=(await pool.query('select user_id,cents,provider_transaction from mirpanel_community.epoint_wallet_intents where id=$1',[orderId.slice(prefix.length)])).rows[0];
  if(old?.user_id!==userId||Number(old.cents)!==cents||old.provider_transaction!==transaction)throw fail(409,'Ödəniş qeydi uyğun deyil.');
 }
}
export async function settleEpointResult(pool,result){
 await ensure(pool);
 const c=await pool.connect();
 try{
  await c.query('begin');
  const readIntent=async()=>(await c.query('select * from mirpanel_community.epoint_wallet_intents where id=$1 for update',[result.id])).rows[0];
  let intent=await readIntent();
  // Widget creation does not guarantee a transaction ID. Only an already
  // issued, owner-bound widget and a verified callback may establish the link.
  if(!intent&&(await c.query("select exists(select 1 from information_schema.columns where table_schema='mirpanel_community' and table_name='epoint_checkout_requests' and column_name='method') present")).rows[0].present){
   const request=(await c.query("select user_id,cents from mirpanel_community.epoint_checkout_requests where id=$1 and state='ready' and method in ('apple-pay','google-pay') for update",[result.id])).rows[0];
   if(request){
    intent=await readIntent();
    if(!intent&&result.status==='success'){
     if(Number(request.cents)!==result.cents||!reference(result.transaction))throw fail(409,'Ödəniş məlumatı uyğun deyil.');
     try{
      await c.query('insert into mirpanel_community.epoint_wallet_intents(id,user_id,cents,provider_transaction) values($1,$2,$3,$4)',[result.id,request.user_id,request.cents,result.transaction]);
     }catch(e){if(e.code==='23505')throw fail(409,'Əməliyyat başqa ödənişə bağlıdır.');throw e;}
     intent=await readIntent();
    }else if(!intent){
     // The widget may allow another attempt on the same order. Keep the
     // reference pending until there is a successful, matchable transaction.
     await c.query('commit');return;
    }
   }
  }
  if(!intent)throw fail(404,'Ödəniş qeydi tapılmadı.');
  if(result.transaction&&intent.provider_transaction!==result.transaction)throw fail(409,'Əməliyyat identifikatoru uyğun deyil.');
  if(result.status==='success'&&(intent.provider_transaction!==result.transaction||Number(intent.cents)!==result.cents))throw fail(409,'Ödəniş məlumatı uyğun deyil.');
  if(!intent.credited_at&&result.status==='success'){
   await postLedger(c,{actor:intent.user_id,user:intent.user_id,key:intent.id,cents:result.cents,kind:'topup_credit',reason:'Epoint ödənişi ilə balans artırıldı'});
   await c.query("update mirpanel_community.epoint_wallet_intents set status='success',credited_at=clock_timestamp() where id=$1",[intent.id]);
  }else if(!intent.credited_at&&intent.status!==result.status){
   await c.query('update mirpanel_community.epoint_wallet_intents set status=$2 where id=$1',[intent.id,result.status]);
  }
  await c.query('commit');
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
