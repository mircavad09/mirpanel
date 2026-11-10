import crypto from 'node:crypto';
import webpush from 'web-push';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const denied=message=>Object.assign(Error(message),{status:400});
const base64=/^[A-Za-z0-9_-]+$/;
export function validatePushSubscription(value){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>2048)throw denied('Bildiriş abunəliyi düzgün deyil.');
 let url;
 try{url=new URL(value.endpoint);}catch{throw denied('Bildiriş ünvanı düzgün deyil.');}
 // Only browser vendors' push gateways can be contacted, never arbitrary URLs.
 const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','updates-autopush.stage.mozaws.net','web.push.apple.com'];
 if(url.protocol!=='https:'||url.port||url.username||url.password||
  !allowed.includes(url.hostname)&&!url.hostname.endsWith('.notify.windows.com'))throw denied('Bildiriş xidməti dəstəklənmir.');
 const {p256dh,auth}=value.keys||{};
 if(typeof p256dh!=='string'||typeof auth!=='string'||!base64.test(p256dh)||!base64.test(auth)||
  Buffer.from(p256dh,'base64url').length!==65||Buffer.from(auth,'base64url').length!==16)throw denied('Bildiriş açarları düzgün deyil.');
 try{crypto.ECDH.convertKey(Buffer.from(p256dh,'base64url'),'prime256v1');}
 catch{throw denied('Bildiriş açarı düzgün deyil.');}
 return {endpoint:url.href,keys:{p256dh,auth}};
}
export function createAdminPush({pool:loadPool,security,binding,send=webpush.sendNotification}){
 let keysPromise,running,timer;
 async function keys(pool){
  if(keysPromise)return keysPromise;
  keysPromise=(async()=>{
   const fresh=webpush.generateVAPIDKeys();
   await pool.query('insert into mirpanel_community.admin_push_keys(id,public_key,private_cipher) values(true,$1,$2) on conflict do nothing',
    [fresh.publicKey,security.encryptSecret(fresh.privateKey)]);
   const {rows:[row]}=await pool.query('select * from mirpanel_community.admin_push_keys where id');
   return {publicKey:row.public_key,privateKey:security.decryptSecret(row.private_cipher)};
  })();
  try{return await keysPromise;}catch(e){keysPromise=null;throw e;}
 }
 async function removeSession(id){
  const pool=await loadPool();
  const {rows:[row]}=await pool.query("select to_regclass('mirpanel_community.admin_push_devices') as available");
  if(row.available)await pool.query('delete from mirpanel_community.admin_push_devices where session_hash=$1',[hash(id)]);
 }
 async function handle({request,response,scope,owner,json,body}){
  const pool=await loadPool(),url=new URL(request.url,'https://admin.invalid');
  if(request.method==='GET'){
   const pair=await keys(pool);
   return json(response,200,{publicKey:pair.publicKey,sessionRequired:true});
  }
  const input=await body(request,5000);
  if(input.action==='disable'){
   if(typeof input.endpoint!=='string')throw denied('Abunəlik tapılmadı.');
   await pool.query('delete from mirpanel_community.admin_push_devices where endpoint_hash=$1 and session_hash=$2',[hash(input.endpoint),scope.hash]);
   return json(response,200,{ok:true});
  }
  const subscription=validatePushSubscription(input.subscription);
  await keys(pool);
  await pool.query(`insert into mirpanel_community.admin_push_devices(endpoint_hash,subscription_cipher,owner_id,session_hash,auth_binding)
   values($1,$2,$3,$4,$5) on conflict(endpoint_hash) do update set subscription_cipher=excluded.subscription_cipher,
   created_at=case when admin_push_devices.session_hash<>excluded.session_hash then now() else admin_push_devices.created_at end,
   owner_id=excluded.owner_id,session_hash=excluded.session_hash,auth_binding=excluded.auth_binding`,
   [hash(subscription.endpoint),security.encryptSecret(JSON.stringify(subscription)),owner,scope.hash,scope.binding]);
  return json(response,200,{ok:true});
 }
 async function drain(){
  const pool=await loadPool();
  const exists=(await pool.query("select to_regclass('mirpanel_community.admin_topup_push') as available")).rows[0]?.available;
  if(!exists)return;
  await pool.query("update mirpanel_community.admin_topup_push set state='uncertain',updated_at=now() where state='sending' and updated_at<now()-interval '2 minutes'");
  for(let i=0;i<20;i++){
   const {rows:[job]}=await pool.query(`with next as(
    select topup_id,endpoint_hash from mirpanel_community.admin_topup_push where state='queued' and next_at<=now()
    order by next_at for update skip locked limit 1)
    update mirpanel_community.admin_topup_push q set state='sending',attempts=attempts+1,updated_at=now()
    from next where q.topup_id=next.topup_id and q.endpoint_hash=next.endpoint_hash returning q.*`);
   if(!job)return;
   const {rows:[data]}=await pool.query(`select d.subscription_cipher,t.requested_cents::text,t.submitted_at,u.name,n.member_number::text
    from mirpanel_community.admin_push_devices d join public.admin_sessions s on s.token_hash=d.session_hash and s.auth_binding=d.auth_binding
    join mirpanel_community.owner_identity o on o.id=true and o.user_id=d.owner_id
    join mirpanel_community."user" owner on owner.id=o.user_id and owner."emailVerified"=true
    join mirpanel_community.wallet_topups t on t.id=$2
    join mirpanel_community."user" u on u.id=t.user_id
    left join mirpanel_community.community_member_numbers n on n.user_id=t.user_id
    where d.endpoint_hash=$1 and d.auth_binding=$3 and s.expires_at>now()
    and t.status='reviewing' and t.submitted_at>=d.created_at and t.submitted_at>now()-interval '5 minutes'`,[job.endpoint_hash,job.topup_id,binding]);
   let state='failed';
   if(data){
    try{
     const pair=await keys(pool),subscription=JSON.parse(security.decryptSecret(data.subscription_cipher));
     validatePushSubscription(subscription);
     const amount=(Number(data.requested_cents)/100).toFixed(2).replace('.',',');
     await send(subscription,JSON.stringify({id:job.topup_id,title:'Yeni balans müraciəti · '+amount+' ₼',
      body:data.name+' · #'+(data.member_number||'—'),createdAt:new Date(data.submitted_at).getTime()}),
      {TTL:120,urgency:'high',timeout:10000,vapidDetails:{subject:'mailto:mircavad09@gmail.com',...pair}});
     state='sent';
    }catch(e){
     if([404,410].includes(e.statusCode))await pool.query('delete from mirpanel_community.admin_push_devices where endpoint_hash=$1',[job.endpoint_hash]);
     // A completed 429 response is safe to retry. Unknown acceptance is retained.
     state=e.statusCode===429&&job.attempts<3?'queued':e.statusCode?'failed':'uncertain';
    }
   }
   await pool.query(`update mirpanel_community.admin_topup_push set state=$3,next_at=now()+interval '30 seconds',updated_at=now()
    where topup_id=$1 and endpoint_hash=$2`,[job.topup_id,job.endpoint_hash,state]);
  }
 }
 const wake=()=>running??=(drain().catch(()=>console.warn('ADMIN_PUSH_WORKER_FAILED')).finally(()=>{running=null;}));
 return {handle,removeSession,wake,start(){timer??=setInterval(wake,5000);timer.unref?.();void wake();},stop(){clearInterval(timer);return running;}};
}
