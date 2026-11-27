import {ensureSchema} from './schema-setup.mjs';
import fs from 'node:fs';import {createHash} from 'node:crypto';import webpush from 'web-push';
import {validatePushSubscription} from '../admin-push.mjs';
const S='mirpanel_community.',hash=v=>createHash('sha256').update(v).digest('hex'),denied=(n,m)=>Object.assign(Error(m),{status:n});
export function ensureSupportPush(pool){return ensureSchema(pool,'support-push',fs.readFileSync(new URL('./support-push.sql',import.meta.url),'utf8'));}
export function createSupportPush({pool,security,send=webpush.sendNotification}){
 let running,timer,pair;const rates=new Map(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const owner=i=>i.userId?'u:'+i.userId:i.guestHash?'g:'+i.guestHash:null;
 async function keys(){await ensureSupportPush(pool);if(!pair){const k=webpush.generateVAPIDKeys();await pool.query(`insert into ${S}support_push_keys(id,public_key,private_cipher) values(true,$1,$2) on conflict do nothing`,[k.publicKey,security.encryptSecret(k.privateKey)]);const r=(await pool.query(`select * from ${S}support_push_keys where id`)).rows[0];pair={publicKey:r.public_key,privateKey:security.decryptSecret(r.private_cipher)};}return pair;}
 async function owned(i,id){if(!uuid.test(id||''))throw denied(404,'Yazışma tapılmadı.');const t=(await pool.query(`select id from ${S}support_threads where id=$1 and (user_id=$2 or (user_id is null and guest_hash=$3))`,[id,i.userId,i.guestHash])).rows[0];if(!t)throw denied(404,'Yazışma tapılmadı.');return t;}
 async function handle(identity,action,b={},q={}){
  await ensureSupportPush(pool);const binding=owner(identity);if(action==='config')return {publicKey:(await keys()).publicKey};if(!binding)throw denied(401,'Dəstək sessiyası tələb olunur.');
  if(['subscribe','disable'].includes(action)){const now=Date.now();for(const [k,v]of rates)if(v.until<now)rates.delete(k);const r=rates.get(binding)||{n:0,until:now+60000};if(++r.n>30||rates.size>5000)throw denied(429,'Bir qədər gözləyib yenidən cəhd edin.');rates.set(binding,r);}
  if(action==='check'){await owned(identity,q.id);if(!uuid.test(q.event||''))return {allowed:false};const event=(await pool.query(`select 1 from ${S}support_messages where id=$1 and thread_id=$2 and sender='staff'`,[q.event,q.id])).rowCount;return {allowed:!!event};}
  if(action==='disable'){if(typeof b.endpoint!=='string')throw denied(400,'Abunəlik ünvanı tələb olunur.');await pool.query(`delete from ${S}support_push_devices where endpoint_hash=$1 and owner_key=$2`,[hash(b.endpoint),binding]);return {ok:true};}
  if(action!=='subscribe')throw denied(404,'Əməliyyat tapılmadı.');await owned(identity,b.threadId);const subscription=validatePushSubscription(b.subscription),id=hash(subscription.endpoint),cipher=security.encryptSecret(JSON.stringify(subscription));await keys();
  const r=await pool.query(`insert into ${S}support_push_devices(endpoint_hash,owner_key,thread_id,subscription_cipher) values($1,$2,$3,$4) on conflict(endpoint_hash) do update set created_at=case when support_push_devices.thread_id=excluded.thread_id then support_push_devices.created_at else now() end,thread_id=excluded.thread_id,subscription_cipher=excluded.subscription_cipher,updated_at=now() where support_push_devices.owner_key=excluded.owner_key returning endpoint_hash`,[id,binding,b.threadId,cipher]);if(!r.rowCount)throw denied(409,'Bu brauzerin əvvəlki bildiriş abunəliyini söndürüb yenidən qoşun.');return {ok:true};
 }
 async function drain(){await ensureSupportPush(pool);
  // Exactly one durable job per staff message and device, including after restart.
  await pool.query(`insert into ${S}support_push_jobs(message_id,endpoint_hash) select m.id,d.endpoint_hash from ${S}support_push_devices d join ${S}support_messages m on m.thread_id=d.thread_id and m.sender='staff' and m.created_at>=d.created_at join ${S}support_threads t on t.id=m.thread_id where m.created_at>now()-interval '1 day' and m.seq>t.customer_read_seq and d.owner_key=case when t.user_id is not null then 'u:'||t.user_id else 'g:'||t.guest_hash end on conflict do nothing`);
  await pool.query(`update ${S}support_push_jobs set state='uncertain' where state='sending' and updated_at<now()-interval '2 minutes'`);
  for(let n=0;n<20;n++){
   const j=(await pool.query(`with pick as(select message_id,endpoint_hash from ${S}support_push_jobs where state='queued' and next_at<=now() order by next_at for update skip locked limit 1) update ${S}support_push_jobs j set state='sending',attempts=attempts+1,updated_at=now() from pick p where j.message_id=p.message_id and j.endpoint_hash=p.endpoint_hash returning j.*`)).rows[0];if(!j)return;
   const d=(await pool.query(`select d.subscription_cipher,m.thread_id,m.seq,t.customer_read_seq from ${S}support_push_devices d join ${S}support_messages m on m.id=$1 join ${S}support_threads t on t.id=m.thread_id where d.endpoint_hash=$2 and d.thread_id=t.id and d.owner_key=case when t.user_id is not null then 'u:'||t.user_id else 'g:'||t.guest_hash end`,[j.message_id,j.endpoint_hash])).rows[0];let state='skipped';
   if(d&&BigInt(d.seq)>BigInt(d.customer_read_seq)){try{const k=await keys();await send(JSON.parse(security.decryptSecret(d.subscription_cipher)),JSON.stringify({id:j.message_id,thread:d.thread_id,title:'MirPanel canlı dəstək',body:'MirPanel dəstəyi sizə cavab verdi'}),{TTL:86400,timeout:10000,vapidDetails:{subject:'https://mirpanel.com/elaqe',publicKey:k.publicKey,privateKey:k.privateKey}});state='sent';}catch(e){if([404,410].includes(e.statusCode)){await pool.query(`delete from ${S}support_push_devices where endpoint_hash=$1`,[j.endpoint_hash]);state='expired';}else state=[429,503].includes(e.statusCode)&&j.attempts<4?'queued':'uncertain';}}
   await pool.query(`update ${S}support_push_jobs set state=$3,updated_at=now(),next_at=now()+interval '5 minutes' where message_id=$1 and endpoint_hash=$2`,[j.message_id,j.endpoint_hash,state]);
  }
 }
 const wake=()=>{if(!running)running=drain().catch(()=>console.warn('SUPPORT_PUSH_RETRY_PENDING')).finally(()=>running=null);return running;};
 return {handle,drain,wake,start(){if(!timer){timer=setInterval(wake,5000);timer.unref?.();void wake();}},stop(){clearInterval(timer);timer=null;}};
}
