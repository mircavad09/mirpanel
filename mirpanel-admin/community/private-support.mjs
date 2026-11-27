import {ensureSchema} from './schema-setup.mjs';
import {supportFile} from './support-media.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {isOwner} from './owner-auth.mjs';
const S='mirpanel_community.',fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const seq=x=>/^\d{1,18}$/.test(String(x||'0'))?String(x||'0'):'0';
export const SUPPORT_WELCOME='Salam! MirPanel dəstəyinə xoş gəlmisiniz 👋 Sizə hansı mövzuda kömək edək?';
const waiting='Mesajınız qəbul edildi, əməkdaş cavab verəcək. Şifrə, kartın tam məlumatı və təsdiq kodu göndərməyin.';
export const SUPPORT_TOPICS=[
 {id:'payment',label:'Ödəniş problemi',answer:'Elektron ödənişin vəziyyətinə “Ödənişlərim” bölməsində baxın. Balans yalnız server təsdiqindən sonra yenilənir. Məbləğ tutulubsa, ödənişi təkrar etməyin və əməkdaşa qoşulun. Kartdan karta balans artırmada mövcud çek yükləmə addımından istifadə edin.'},
 {id:'order',label:'Sifarişim və təhvil',answer:'“Sifarişlərim” bölməsində sifarişin vəziyyətini və təqdim olunmuş məlumatları yoxlayın. Hazırlanan sifarişin təhvilini həmin bölmədən izləyə bilərsiniz. Kömək üçün sifariş nömrəsini yaza bilərsiniz; şifrə və təhvil kodu göndərməyin.'},
 {id:'registration',label:'Qeydiyyat kodu gəlmir',answer:'Daxil etdiyiniz e-poçt ünvanını yoxlayın. Təkrar göndəriş üçün ekrandakı gözləmə müddətinin bitməsini gözləyin. “Qəbul edildi” yazısı məktubun Gələnlərə çatdığını sübut etmir. Problem davam edirsə, əməkdaşa qoşulun; təsdiq kodunu bizə göndərməyin.'},
 {id:'replacement',label:'Hesabda problem / əvəzləmə',answer:'Sifariş nömrəsini və qarşılaşdığınız problemi yazın. Əməkdaş sifarişə aid zəmanət və əvəzləmə qaydasını yoxlayacaq. Əvəzləmə və geri ödəniş bot tərəfindən edilmir. Hesab şifrəsini göndərməyin.'},
 {id:'other',label:'Digər sual',answer:'Sualınızı qısa yazın. Hazır cavab uyğun deyilsə “Canlı əməkdaşa qoşul” seçimini istifadə edin. WhatsApp dəstəyi də əvvəlki kimi işləyir.'}
];
export async function ensurePrivateSupport(pool){const source=await readFile(new URL('./private-support.sql',import.meta.url),'utf8');return ensureSchema(pool,'private-support',source,{seed:c=>c.query(`insert into ${S}support_bot_config(id,topics) values(true,$1) on conflict do nothing`,[JSON.stringify(SUPPORT_TOPICS)])});}
export function supportIdentity(user,cookie){if(user)return {userId:user,guestHash:null};const token=String(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-mirpanel_support='))?.slice('__Host-mirpanel_support='.length);return {userId:null,guestHash:/^[a-f0-9]{64}$/.test(token||'')?createHash('sha256').update(token).digest('hex'):null};}
export function newSupportGuest(){const token=randomBytes(32).toString('hex');return {cookie:'__Host-mirpanel_support='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000',identity:supportIdentity(null,'__Host-mirpanel_support='+token)};}
export async function adoptSupportGuest(pool,userId,guestHash){if(!userId||!guestHash)return;await ensurePrivateSupport(pool);const c=await pool.connect();try{await c.query('begin');await c.query('select pg_advisory_xact_lock(hashtextextended($1,927001))',[guestHash]);await c.query(`insert into ${S}support_guest_usage(guest_hash) values($1) on conflict do nothing`,[guestHash]);const g=(await c.query(`select user_id from ${S}support_guest_usage where guest_hash=$1 for update`,[guestHash])).rows[0];if(g.user_id&&g.user_id!==userId)throw fail(403,'Qonaq yazışması başqa hesaba bağlanıb.');await c.query(`update ${S}support_threads set user_id=$1,guest_hash=null where guest_hash=$2 and user_id is null`,[userId,guestHash]);await c.query(`update ${S}support_guest_usage set user_id=$1 where guest_hash=$2`,[userId,guestHash]);await c.query('commit');}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
async function config(c){const r=(await c.query(`select version,topics from ${S}support_bot_config where id`)).rows[0];return {...r,welcome:SUPPORT_WELCOME,botName:'MirPanel köməkçisi'};}
async function owned(c,identity,id,lock=false){if(!uuid(id))throw fail(400,'Yazışma seçin.');const row=(await c.query(`select * from ${S}support_threads where id=$1 and (user_id=$2 or (user_id is null and guest_hash=$3))${lock?' for update':''}`,[id,identity.userId,identity.guestHash])).rows[0];if(!row)throw fail(404,'Yazışma tapılmadı.');return row;}
async function message(c,t,sender,body,clientId=randomUUID(),actor=null,hash=null,reply=null,attachment=null){const saved=(await c.query(`insert into ${S}support_messages(id,thread_id,client_id,sender,body,actor_id,request_hash) values($1,$2,$3,$4,$5,$6,$7) returning id,seq::text,client_id,sender,body,created_at`,[randomUUID(),t.id,clientId,sender,body,actor,hash])).rows[0];if(reply||attachment)await c.query(`update ${S}support_messages set reply_to=$2,attachment_id=$3 where id=$1`,[saved.id,reply,attachment]);return saved;}
async function transcript(c,t,q={}){
 const before=seq(q.before),after=seq(q.after),forward=after!=='0';const rows=(await c.query(`select m.id,m.seq::text,m.client_id,m.sender,m.body,m.created_at,m.reply_to,case when reply.id is not null then jsonb_build_object('id',reply.id,'body',left(reply.body,160),'sender',reply.sender) end reply,case when f.id is not null then jsonb_build_object('id',f.id,'name',f.name,'mime',f.mime,'size',octet_length(f.bytes)) end attachment,case when m.sender='customer' then exists(select 1 from ${S}support_staff_reads read where read.thread_id=m.thread_id and read.last_seq>=m.seq) when m.sender='staff' then m.seq<=$4::bigint else false end read,case when m.sender='staff' then coalesce(u.name,'Əməkdaş') else null end name from ${S}support_messages m left join ${S}"user" u on u.id=m.actor_id left join ${S}support_messages reply on reply.id=m.reply_to and reply.thread_id=m.thread_id left join ${S}support_files f on f.id=m.attachment_id and f.thread_id=m.thread_id where m.thread_id=$1 and ($2::bigint=0 or m.seq<$2) and m.seq>$3::bigint order by m.seq ${forward?'asc':'desc'} limit 101`,[t.id,before,after,t.customer_read_seq])).rows;
 const agent=t.assigned_to?(await c.query(`select name from ${S}"user" where id=$1`,[t.assigned_to])).rows[0]?.name:null;
 return {thread:{operatorName:agent||null,id:t.id,status:t.status,mode:t.mode,assigned:!!t.assigned_to,userId:t.user_id||null},messages:forward?rows.slice(0,100):rows.slice(0,100).reverse(),more:rows.length>100};
}
function bodyText(value){if(typeof value!=='string'||!value.trim()||value.trim().length>2000)throw fail(400,'1–2000 simvolluq mesaj yazın.');return value.trim();}
async function readAck(c,t,value,actor=null){const n=seq(value);if(actor)await c.query(`insert into ${S}support_staff_reads(thread_id,actor_id,last_seq) values($1,$2,least($3::bigint,coalesce((select max(seq) from ${S}support_messages where thread_id=$1),0))) on conflict(thread_id,actor_id) do update set last_seq=greatest(${S}support_staff_reads.last_seq,excluded.last_seq)`,[t.id,actor,n]);else await c.query(`update ${S}support_threads set customer_read_seq=greatest(customer_read_seq,least($2::bigint,coalesce((select max(seq) from ${S}support_messages where thread_id=$1),0))) where id=$1`,[t.id,n]);}
async function extras(c,t,b,uploader){
 if(b.replyTo&&!uuid(b.replyTo)||b.attachmentId&&!uuid(b.attachmentId))throw fail(400,'Mesaj istinadı düzgün deyil.');
 if(b.replyTo&&!(await c.query(`select 1 from ${S}support_messages where id=$1 and thread_id=$2`,[b.replyTo,t.id])).rowCount)throw fail(404,'Bu yazışmada cavablandırılan mesaj tapılmadı.');
 if(b.attachmentId&&!(await c.query(`select 1 from ${S}support_files where id=$1 and thread_id=$2 and uploader=$3`,[b.attachmentId,t.id,uploader])).rowCount)throw fail(404,'İcazəli fayl tapılmadı.');
 return {reply:b.replyTo||null,attachment:b.attachmentId||null};
}
async function media(c,t,action,b,q,uploader){
 if(action==='file'){if(!uuid(q.fileId))throw fail(400,'Fayl seçin.');const f=(await c.query(`select * from ${S}support_files where id=$1 and thread_id=$2`,[q.fileId,t.id])).rows[0];if(!f)throw fail(404,'Fayl tapılmadı.');return {name:f.name,mime:f.mime,base64:f.bytes.toString('base64')};}
 if(!uuid(b.clientId)||t.status==='closed')throw fail(400,'Açıq yazışma və fayl açarı tələb olunur.');const f=supportFile(b);
 const old=(await c.query(`select id,sha from ${S}support_files where thread_id=$1 and uploader=$2 and client_id=$3`,[t.id,uploader,b.clientId])).rows[0];
 if(old){if(old.sha!==f.sha)throw fail(409,'Fayl açarı artıq istifadə olunub.');return {id:old.id};}
 if(Number((await c.query(`select count(*) n from ${S}support_files where thread_id=$1 and created_at>now()-interval '1 hour'`,[t.id])).rows[0].n)>=20)throw fail(429,'Fayl limiti dolub. Bir qədər gözləyin.');
 const id=randomUUID();await c.query(`insert into ${S}support_files(id,thread_id,uploader,client_id,mime,name,sha,bytes) values($1,$2,$3,$4,$5,$6,$7,$8)`,[id,t.id,uploader,b.clientId,f.mime,f.name,f.sha,f.bytes]);return {id};
}
export async function supportCustomer(pool,identity,action,b={},q={}){
 await ensurePrivateSupport(pool);const c=await pool.connect();try{await c.query('begin');await c.query("set local statement_timeout='8s'");
 const cfg=await config(c);let result;if(identity.guestHash&&!identity.userId)await c.query('select pg_advisory_xact_lock(hashtextextended($1,927001))',[identity.guestHash]);
 if(action==='session'){
  const threads=(await c.query(`select * from ${S}support_threads where (user_id=$1 or (user_id is null and guest_hash=$2)) order by (status<>'closed') desc,updated_at desc limit 30`,[identity.userId,identity.guestHash])).rows;
  const t=q.id?await owned(c,identity,q.id):threads[0];
  const unread=Number((await c.query(`select count(*) n from ${S}support_messages m join ${S}support_threads t on t.id=m.thread_id where (t.user_id=$1 or (t.user_id is null and t.guest_hash=$2)) and m.sender='staff' and m.seq>t.customer_read_seq`,[identity.userId,identity.guestHash])).rows[0].n);
  const guestUsed=!identity.userId&&identity.guestHash?!!(await c.query(`select 1 from ${S}support_guest_usage where guest_hash=$1 and first_message is not null`,[identity.guestHash])).rowCount:false;
  result={config:cfg,...(t?await transcript(c,t,q):{thread:null,messages:[]}),threads:threads.map(t=>({id:t.id,status:t.status,createdAt:t.created_at})),unread,authenticated:!!identity.userId,guestLimitReached:guestUsed};
 }else if(action==='start'){
  if(!identity.userId&&!identity.guestHash)throw fail(401,'Dəstək sessiyası alınmadı.');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,927001))',[identity.userId||identity.guestHash]);
  let t=(await c.query(`select * from ${S}support_threads where status<>'closed' and (user_id=$1 or (user_id is null and guest_hash=$2)) order by updated_at desc limit 1`,[identity.userId,identity.guestHash])).rows[0];
  if(!t){t=(await c.query(`insert into ${S}support_threads(id,user_id,guest_hash) values($1,$2,$3) returning *`,[randomUUID(),identity.userId,identity.guestHash])).rows[0];await message(c,t,'bot',SUPPORT_WELCOME);}
  result={config:cfg,...await transcript(c,t)};
 }else{
  const t=await owned(c,identity,b.threadId||q.id,true);
  if(['upload','file'].includes(action))result=await media(c,t,action,b,q,'customer');
  else if(action==='thread')result=await transcript(c,t,q);
  else if(action==='read'){await readAck(c,t,b.seq);result={ok:true,unread:Number((await c.query(`select count(*) n from ${S}support_messages m join ${S}support_threads t on t.id=m.thread_id where (t.user_id=$1 or (t.user_id is null and t.guest_hash=$2)) and m.sender='staff' and m.seq>t.customer_read_seq`,[identity.userId,identity.guestHash])).rows[0].n)};}
  else if(action==='send'){
   if(!uuid(b.clientId))throw fail(400,'Mesaj açarı düzgün deyil.');
   const topic=b.topic?cfg.topics.find(x=>x.id===b.topic):null;if(b.topic&&!topic)throw fail(400,'Mövzu seçimi düzgün deyil.');
   const extra=await extras(c,t,b,'customer');
   const text=b.handoff===true?'Canlı əməkdaşa qoşulmaq istəyirəm.':topic?topic.label:bodyText(b.body|| (extra.attachment?'Fayl':'')),hash=createHash('sha256').update(JSON.stringify([text,b.topic||'',b.handoff===true,...(extra.reply||extra.attachment?[extra.reply,extra.attachment]:[])])).digest('hex');
   const old=(await c.query(`select request_hash from ${S}support_messages where thread_id=$1 and client_id=$2 and sender='customer'`,[t.id,b.clientId])).rows[0];
   if(old){if(old.request_hash!==hash)throw fail(409,'Bu mesaj açarı artıq istifadə olunub.');result={...await transcript(c,t),replayed:true};}
   else{
    if(t.status==='closed')throw fail(409,'Yazışma bağlanıb. Yeni müraciət açın.');
    if(!identity.userId&&!b.topic&&b.handoff!==true){await c.query('select pg_advisory_xact_lock(hashtextextended($1,927001))',[identity.guestHash]);await c.query(`insert into ${S}support_guest_usage(guest_hash) values($1) on conflict do nothing`,[identity.guestHash]);const g=(await c.query(`select first_message,user_id from ${S}support_guest_usage where guest_hash=$1 for update`,[identity.guestHash])).rows[0];if(g.first_message||g.user_id)throw fail(403,'Yazışmaya davam etmək üçün daxil olun və ya qeydiyyatdan keçin');await c.query(`update ${S}support_guest_usage set first_message=$2 where guest_hash=$1`,[identity.guestHash,b.clientId]);}
    // Sequence cursors must not pass a lower customer seq that is still
    // uncommitted in another thread. Serialize customer event creation until
    // commit; staff/bot messages are not notification events.
    await c.query('select pg_advisory_xact_lock(92700112)');
    if(Number((await c.query(`select count(*) n from ${S}support_messages where thread_id=$1 and sender='customer' and created_at>clock_timestamp()-interval '1 minute'`,[t.id])).rows[0].n)>=20)throw fail(429,'Çox sürətli yazırsınız. Bir qədər gözləyin.');
    await message(c,t,'customer',text,b.clientId,null,hash,extra.reply,extra.attachment);
    let handoff=b.handoff===true;
    if(t.mode==='bot'&&!handoff){
     const normalized=text.toLocaleLowerCase('az');const detected=topic||cfg.topics.find(x=>({payment:/ödəniş|balans|pul tutul/,order:/sifariş|təhvil/,registration:/qeydiyyat|kod gəl|kod çat/,replacement:/əvəz|hesab.*problem/}[x.id]||/$^/).test(normalized));
     if(detected&&!t.used_topics.includes(detected.id)){await message(c,t,'bot',detected.answer);t.used_topics.push(detected.id);}else handoff=true;
    }
    if(handoff&&t.mode==='bot'){t.mode='waiting';t.status='waiting';await message(c,t,'system',waiting);}
    else if(t.mode==='waiting')t.status='waiting';
    // Once assigned, neither topic clicks nor free text invoke the bot.
    await c.query(`update ${S}support_threads set mode=$2,status=$3,used_topics=$4,updated_at=clock_timestamp() where id=$1`,[t.id,t.mode,t.status,t.used_topics]);result=await transcript(c,t);
   }
   result.acceptedClientId=b.clientId;
  }else throw fail(404,'Əməliyyat tapılmadı.');
 }
 await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
async function permission(c,actor){if(!actor)throw fail(401,'Əməkdaş hesabı ilə daxil olun.');const user=(await c.query(`select id,email,"emailVerified" from ${S}"user" where id=$1`,[actor])).rows[0];if(await isOwner(c,user))return {owner:true};const r=(await c.query(`select active,support from ${S}customer_read_staff where user_id=$1 for share`,[actor])).rows[0];if(!r?.active||!r.support)throw fail(403,'Canlı dəstək icazəniz yoxdur və ya ləğv edilib.');return {owner:false};}
export async function supportStaff(pool,actor,action,b={},q={}){
 await ensurePrivateSupport(pool);const c=await pool.connect();try{await c.query('begin');await c.query("set local statement_timeout='8s'");const role=await permission(c,actor);let result;
 if(action==='summary'||action==='list'){
  const status=q.status||'all',page=Number(q.page||1);if(!['all','new','waiting','in_progress','closed'].includes(status)||!Number.isSafeInteger(page)||page<1||page>10000)throw fail(400,'Filtr düzgün deyil.');
  const visibility='($1::boolean or t.assigned_to is null or t.assigned_to=$2)';
  const unread=`(select count(*) from ${S}support_messages m where m.thread_id=t.id and m.sender='customer' and m.seq>coalesce(r.last_seq,0))`;
  const summary=(await c.query(`select coalesce(sum(${unread}),0)::text unread,coalesce(max((select max(seq) from ${S}support_messages m where m.thread_id=t.id and m.sender='customer')),0)::text event_seq from ${S}support_threads t left join ${S}support_staff_reads r on r.thread_id=t.id and r.actor_id=$2 where ${visibility}`,[role.owner,actor])).rows[0];
  result={...summary,actor,owner:role.owner};
  if(action==='summary'&&q.after!==undefined){
   const events=(await c.query(`select m.id,m.seq::text,m.thread_id,left(m.body,160) body,m.created_at,coalesce(u.name,'Qonaq · '||left(t.id::text,8)) customer from ${S}support_messages m join ${S}support_threads t on t.id=m.thread_id left join ${S}"user" u on u.id=t.user_id where m.sender='customer' and m.seq>$3::bigint and ${visibility} order by m.seq asc limit 101`,[role.owner,actor,seq(q.after)])).rows;
   result.events=events.slice(0,100);result.moreEvents=events.length>100;
  }
  if(action==='list'){
   const threads=(await c.query(`select t.id,t.status,t.mode,t.user_id,t.assigned_to,t.updated_at,coalesce(u.name,'Qonaq') customer,coalesce(a.name,'—') assignee,${unread}::int unread,(select left(body,240) from ${S}support_messages where thread_id=t.id and sender='customer' order by seq desc limit 1) last_message from ${S}support_threads t left join ${S}"user" u on u.id=t.user_id left join ${S}"user" a on a.id=t.assigned_to left join ${S}support_staff_reads r on r.thread_id=t.id and r.actor_id=$2 where ${visibility} and ($3='all' or t.status=$3) and exists(select 1 from ${S}support_messages m where m.thread_id=t.id and m.sender='customer') order by (${unread}>0) desc,t.updated_at desc,t.id limit 21 offset $4`,[role.owner,actor,status,(page-1)*20])).rows;
   const agents=(await c.query(`select u.id,u.name from ${S}"user" u where u.id in(select user_id from ${S}owner_identity where id union select user_id from ${S}customer_read_staff where active and support) order by u.name,u.id`)).rows;
   result={...result,threads:threads.slice(0,20),more:threads.length>20,agents};
  }
 }else if(action==='config'){
  if(b.topics){if(!role.owner)throw fail(403,'Bot cavablarını yalnız sahib dəyişə bilər.');const cfg=await config(c);if(b.version!==cfg.version)throw fail(409,'Cavablar dəyişib. Son versiyanı yükləyin.');if(!Array.isArray(b.topics)||b.topics.length!==SUPPORT_TOPICS.length||new Set(b.topics.map(x=>x.id)).size!==SUPPORT_TOPICS.length)throw fail(400,'Bütün mövzuları saxlayın.');const topics=SUPPORT_TOPICS.map(base=>{const x=b.topics.find(x=>x.id===base.id);return {...base,answer:bodyText(x?.answer)};});await c.query(`update ${S}support_bot_config set topics=$1,version=version+1,updated_by=$2,updated_at=clock_timestamp() where id`,[JSON.stringify(topics),actor]);}
  result=await config(c);
 }else{
  if(!uuid(b.threadId||q.id))throw fail(400,'Yazışma seçin.');const t=(await c.query(`select * from ${S}support_threads where id=$1 for update`,[b.threadId||q.id])).rows[0];if(!t||!role.owner&&t.assigned_to&&t.assigned_to!==actor)throw fail(404,'İcazəli yazışma tapılmadı.');
  if(['upload','file'].includes(action)){if(action==='upload'&&(t.status==='closed'||t.assigned_to!==actor))throw fail(409,'Əvvəl yazışmanı üzərinizə götürün.');result=await media(c,t,action,b,q,actor);}
  else if(action==='thread')result={...await transcript(c,t,q),customerId:t.user_id,canViewOrders:!!t.user_id,canReply:t.status!=='closed'&&(!t.assigned_to||t.assigned_to===actor),needsClaim:!t.assigned_to,customerName:t.user_id?(await c.query(`select name from ${S}"user" where id=$1`,[t.user_id])).rows[0]?.name:'Qonaq · '+t.id.slice(0,8)};
  else if(action==='orders'){if(!t.user_id)throw fail(403,'Qonaq müraciətində sifariş sahibi təsdiqlənməyib. Müştəri öz hesabına daxil olmalıdır.');result={readOnly:true,orders:(await c.query(`select o.order_code::text number,o.product_title product,o.plan_name package,o.amount::text,o.currency,o.status,o.created_at from public.payment_orders o join ${S}community_order_owners l on l.order_id=o.id where l.user_id=$1 order by o.created_at desc limit 20`,[t.user_id])).rows};}
  else if(action==='read'){await readAck(c,t,b.seq,actor);result={ok:true};}
  else if(action==='send'){
   if(!uuid(b.clientId))throw fail(400,'Mesaj açarı düzgün deyil.');const extra=await extras(c,t,b,actor),text=bodyText(b.body||(extra.attachment?'Fayl':''));const old=(await c.query(`select actor_id,body,reply_to,attachment_id from ${S}support_messages where thread_id=$1 and client_id=$2 and sender='staff'`,[t.id,b.clientId])).rows[0];
   if(old){if(old.actor_id!==actor||old.body!==text||old.reply_to!==extra.reply||old.attachment_id!==extra.attachment)throw fail(409,'Mesaj açarı artıq istifadə olunub.');}
   else{if(t.status==='closed'||t.assigned_to!==actor)throw fail(409,'Əvvəl yazışmanı üzərinizə götürün.');await message(c,t,'staff',text,b.clientId,actor,null,extra.reply,extra.attachment);await c.query(`update ${S}support_threads set updated_at=clock_timestamp() where id=$1`,[t.id]);}result=await transcript(c,t);result.acceptedClientId=b.clientId;
  }else if(['claim','transfer','close'].includes(action)){
   if(!uuid(b.requestId))throw fail(400,'Əməliyyat açarı tələb olunur.');const old=(await c.query(`select * from ${S}support_actions where id=$1`,[b.requestId])).rows[0];
   if(old){if(old.actor_id!==actor||old.thread_id!==t.id||old.kind!==action||(old.target_id||null)!==(b.targetId||null))throw fail(409,'Əməliyyat açarı artıq istifadə olunub.');}
   else{
    if(t.status==='closed')throw fail(409,'Yazışma artıq bağlanıb.');
    if(action==='claim'){if(t.assigned_to&&t.assigned_to!==actor)throw fail(409,'Yazışmanı başqa əməkdaş götürüb.');if(t.assigned_to!==actor)await message(c,t,'system','Əməkdaş yazışmaya qoşuldu.');t.assigned_to=actor;t.status='in_progress';t.mode='agent';}
    else{if(!role.owner&&t.assigned_to!==actor)throw fail(403,'Bu yazışmanın icraçısı deyilsiniz.');if(action==='close'){t.status='closed';t.mode='closed';await message(c,t,'system','Yazışma bağlandı. Yeni sualınız varsa yeni müraciət aça bilərsiniz.');}else{await permission(c,b.targetId);t.assigned_to=b.targetId;t.mode='agent';t.status='in_progress';await message(c,t,'system','Yazışma digər əməkdaşa ötürüldü.');}}
    await c.query(`update ${S}support_threads set assigned_to=$2,status=$3,mode=$4,updated_at=clock_timestamp() where id=$1`,[t.id,t.assigned_to,t.status,t.mode]);await c.query(`insert into ${S}support_actions(id,thread_id,actor_id,kind,target_id) values($1,$2,$3,$4,$5)`,[b.requestId,t.id,actor,action,b.targetId||null]);
   }result=await transcript(c,t);
  }else throw fail(404,'Əməliyyat tapılmadı.');
 }
 await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
