import crypto from 'node:crypto';
import {roomStates} from './netflix-room-state.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=x=>typeof x==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);
const revision=(cipher,active)=>crypto.createHash('sha256').update(JSON.stringify([cipher,active.map(r=>[r.legacy_assignment_id??r.delivery_id,r.user_id,r.period.expiresOn])])).digest('hex');
async function audit(c,actor,action,id,metadata){
 await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
 values('admin',$1,$2,'netflix_account',$3,$4)`,[actor,action,id,metadata]);
}
export async function updateRoomPassword(pool,security,actor,input){
 const {groupId,action,password,expectedRevision}=input||{};
 if(!uuid(groupId)||!['preview','rotate'].includes(action))throw fail(400,'Netflix hesabını seçin.');
 if(action==='rotate'&&(typeof password!=='string'||!password.trim()||password.length>512||/[\r\n\0]/.test(password)))throw fail(400,'Yeni şifrəni yazın.');
 const c=await pool.connect();
 try{
  await c.query('begin');
  // All credential reads, assignments, renewals and release operations serialize
  // with the checkout lock before taking account / room locks.
  await c.query('select pg_advisory_xact_lock(714025001)');
  const group=(await c.query('select id,account_cipher from mirpanel_community.netflix_room_groups where id=$1 for update',[groupId])).rows[0];
  if(!group)throw fail(404,'Netflix hesabı tapılmadı.');
  const account=JSON.parse(security.decryptSecret(group.account_cipher));
  if(account.id!==group.id)throw Error('ROOM_ACCOUNT_REFERENCE_MISMATCH');
  const rooms=await roomStates(c,{groupId,lock:true}),active=rooms.filter(r=>r.active);
  if(action==='preview'){
   await c.query('commit');return {groupId,email:account.email,activeRooms:active.length,activeCustomers:new Set(active.map(r=>r.user_id)).size,revision:revision(group.account_cipher,active)};
  }
  if(password===account.password){await c.query('commit');return {changed:false,activeRooms:active.length};}
  if(expectedRevision!==revision(group.account_cipher,active))throw fail(409,'Hesab dəyişib. Təsirlənən otaqları yenidən yoxlayın.');
  const eventId=crypto.randomUUID();
  await c.query('update mirpanel_community.netflix_room_groups set account_cipher=$2 where id=$1',
   [groupId,security.encryptSecret(JSON.stringify({...account,password}))]);
  await c.query('insert into mirpanel_community.netflix_room_password_events(id,group_id,actor) values($1,$2,$3)',[eventId,groupId,actor]);
  const recipients=new Set();
  for(const room of active){
   // Legacy entitlements read the current group cipher directly and have no payment order.
   if(room.legacy_assignment_id)continue;
   const value=JSON.parse(security.decryptSecret(room.message_cipher));
   if(value.id!==room.delivery_id)throw Error('DELIVERY_REFERENCE_MISMATCH');
   const suppress=!!value.message&&(value.message.includes(account.password)||!!value.password&&value.message.includes(value.password));
   await c.query(`insert into mirpanel_community.netflix_room_delivery_credentials(delivery_id,suppress_message) values($1,$2)
    on conflict(delivery_id) do update set suppress_message=netflix_room_delivery_credentials.suppress_message or excluded.suppress_message`,[room.delivery_id,suppress]);
   if(!recipients.has(room.user_id)){
    recipients.add(room.user_id);
    await c.query(`insert into mirpanel_community.customer_order_mail(event_key,order_id) values($1,$2) on conflict do nothing`,
     ['netflix-password:'+eventId+':'+crypto.createHash('sha256').update(room.user_id).digest('hex'),value.order]);
   }
  }
  await audit(c,actor,'netflix.password_updated',groupId,{eventId,activeRooms:active.length,customers:recipients.size});
  await c.query('commit');return {changed:true,activeRooms:active.length,notifiedCustomers:recipients.size};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function roomCredentialData(pool,deliveryId,userId){
 if(!(await pool.query("select to_regclass('mirpanel_community.netflix_room_password_events') installed")).rows[0].installed)return {};
 const [room]=await roomStates(pool,{deliveryId});
 if(!room?.active||room.user_id!==userId){
  const released=(await pool.query('select 1 from mirpanel_community.netflix_room_assignment_history where delivery_id=$1 limit 1',[deliveryId])).rowCount>0;
  return room||released?{room_access_ended:true}:{};
 }
 const suppress=(await pool.query('select suppress_message from mirpanel_community.netflix_room_delivery_credentials where delivery_id=$1',[deliveryId])).rows[0]?.suppress_message;
 return {room_current_cipher:room.account_cipher,room_group_id:room.group_id,room_suppress_message:!!suppress};
}
// A labeled password in a saved message can outlive more than one allocation.
 // Preserve the saved message in history; only hide it when it conflicts.
function conflictingPassword(message,current){
 if(typeof message!=='string')return false;
 return message.split(/\r?\n/).some(line=>{
  const labeled=line.match(/^\s*[^\p{L}\p{N}]*?(?:(?:hesab(?:ın)?|netflix)\s+)?(?:şifrə(?:si)?|parol[ae]?|password)\s*[*_~`]*\s*[:：=–—-]\s*(.*)$/iu);
  if(!labeled)return false;
  const entry=labeled[1].trim();
  return entry!==current&&entry.replace(/^[*_~`]+|[*_~`]+$/g,'')!==current;
 });
}
export function projectRoomCredentials(security,row,value){
 if(row.room_access_ended){
  const {email,password,...historical}=value;
  return {...historical,message:'Bu otaq üzrə cari giriş məlumatı artıq əlçatan deyil.'};
 }
 if(!row.room_current_cipher)return value;
 const account=JSON.parse(security.decryptSecret(row.room_current_cipher));
 if(account.id!==row.room_group_id)throw Error('ROOM_ACCOUNT_REFERENCE_MISMATCH');
 return {...value,email:account.email,password:account.password,...(row.room_suppress_message||conflictingPassword(value.message,account.password)?{message:'Hazır mesajdakı köhnə giriş məlumatı gizlədildi. Cari e-poçt və şifrə yuxarıda göstərilir.'}:{})};
}
export function roomPasswordMail(job,o,origin){
 const url=origin+'/profil?tab=sifarislerim&order='+encodeURIComponent(o.order_code);
 const text='Hesabınızın şifrəsi yeniləndi. Yeni şifrəni MirPanel-də Sifarişlərim bölməsindən görə bilərsiniz.';
 return {user:{email:o.email},subject:'MirPanel — Hesabınızın şifrəsi yeniləndi',idempotencyKey:job.event_key,
  textBody:text+'\n\nSifarişlərimə bax: '+url,
  htmlBody:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>Hesabınızın şifrəsi yeniləndi</h2><p>'+text+'</p><a style="display:inline-block;padding:14px;background:#ffcc00;color:#0a0805;font-weight:bold" href="'+url+'">Sifarişlərimə bax</a></div>'};
}
