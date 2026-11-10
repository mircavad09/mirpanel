import {roomStates,roomStateLabels} from './netflix-room-state.mjs';
import {roomSalesInstalled} from './netflix-room-sale.mjs';
import crypto from 'node:crypto';
import {bakuDate} from '../payment-order-lifecycle.mjs';
const G='mirpanel_community.netflix_room_groups', U='mirpanel_community.netflix_room_units';
const fail=(status,message)=>Object.assign(Error(message),{status});
const digest=(secret,value)=>crypto.createHmac('sha256',secret).update(JSON.stringify(value)).digest('hex');
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value.slice(0,4)!=='0000'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const roomId=value=>typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
function parseRoom(room){
 const name=typeof room?.name==='string'?room.name.trim().normalize('NFC'):'',pin=room?.pin;
 if(!name||name.length>50||/[\x00-\x1f\x7f]/.test(name)||typeof pin!=='string'||!/^\d{4}$/.test(pin))throw fail(400,'Otaq adı və dörd rəqəmli PIN yazın.');
 return {name,key:name.toLowerCase(),pin};
}
export async function netflixRoomPassword(pool,security,id){
 if(!roomId(id))throw fail(400,'Otaq sorğusu düzgün deyil.');
 const {rows:[group]}=await pool.query(`select g.id,g.account_cipher from ${U} r join ${G} g on g.id=r.group_id where r.id=$1 and to_jsonb(r)->>'deleted_at' is null`,[id]);
 if(!group)throw fail(404,'Otaq tapılmadı.');
 const value=JSON.parse(security.decryptSecret(group.account_cipher));
 if(value.id!==group.id||typeof value.password!=='string')throw fail(409,'Netflix şifrəsi oxunmadı.');
 return {password:value.password};
}
export async function editNetflixRoom(pool,security,input,actor='admin'){
 const {id,action}=input;
 if(!roomId(id)||!['open','save','expiry'].includes(action))throw fail(400,'Otaq sorğusu düzgün deyil.');
 if(action==='expiry'){
  if(!isoDate(input.endsOn)||input.endsOn<=bakuDate())throw fail(400,'Hesabın gələcək bitmə tarixini seçin.');
  const c=await pool.connect();
  try{
   await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
   const result=await c.query(`update ${U} set stock_ends_on=$2 where group_id=(select group_id from ${U} where id=$1) returning group_id`,[id,input.endsOn]);
   if(!result.rowCount)throw fail(404,'Otaq tapılmadı.');
   await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
    values('admin',$1,'netflix.account_expiry_updated','netflix_account',$2,$3)`,[actor,result.rows[0].group_id,{endsOn:input.endsOn}]);
   await c.query('commit');return {endsOn:input.endsOn};
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
 }
 if(action==='open'){
  const {rows:[room]}=await pool.query(`select id,room_name,pin_cipher,delivery_id,to_jsonb(r)->>'legacy_assignment_id' legacy_assignment_id from ${U} r where id=$1 and to_jsonb(r)->>'deleted_at' is null`,[id]);
  if(!room)throw fail(404,'Otaq tapılmadı.');
  const value=JSON.parse(security.decryptSecret(room.pin_cipher));
  if(value.id!==room.id||typeof value.pin!=='string'||!/^\d{4}$/.test(value.pin))throw fail(409,'Otağın PIN-i oxunmadı.');
  return {id:room.id,name:room.room_name,pin:value.pin,editable:!room.delivery_id&&!room.legacy_assignment_id};
 }
 const room=parseRoom(input);
 try{
  const {rowCount}=await pool.query(`update ${U} r set room_name=$2,room_key=$3,pin_cipher=$4 where id=$1 and delivery_id is null and to_jsonb(r)->>'legacy_assignment_id' is null and to_jsonb(r)->>'deleted_at' is null`,
   [id,room.name,room.key,security.encryptSecret(JSON.stringify({id:id.toLowerCase(),pin:room.pin}))]);
  if(!rowCount)throw fail(409,'Otaq tapılmadı və ya artıq sifarişə ayrılıb.');
  return {id,name:room.name};
 }catch(e){if(e.code==='23505')throw fail(409,'Bu hesabda eyni adlı otaq artıq stokdadır.');throw e;}
}
export function parseRoomBatch(b,{undated=false}={}){
 const {requestId,email,password,startsOn,endsOn,rooms,saleMode}=b||{};
 if(saleMode!==undefined&&!['ready','bind'].includes(saleMode))throw fail(400,'Otağın satış vəziyyətini seçin.');
 if(typeof requestId!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId))throw fail(400,'Saxlama sorğusu düzgün deyil.');
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||!password.trim()||password.length>512||/[\r\n\0]/.test(password))throw fail(400,'Etibarlı hesab e-poçtu və şifrəsi yazın.');
 if(!undated&&(!isoDate(endsOn)||startsOn!==undefined&&(!isoDate(startsOn)||startsOn>=endsOn)))throw fail(400,'Bitmə tarixi düzgün deyil.');
 if(!Array.isArray(rooms)||rooms.length<1||rooms.length>20)throw fail(400,'1–20 otaq əlavə edin.');
 const seen=new Set();
 return {requestId,email:email.trim(),password,startsOn,endsOn:undated?'infinity':endsOn,...(saleMode?{saleMode}:{}),rooms:rooms.map(room=>{
  const {name,key,pin}=parseRoom(room);
  if(seen.has(key))throw fail(400,'Eyni otaq adı təkrarlana bilməz.');
  seen.add(key);return {name,key,pin};
 })};
}
export async function netflixRooms(pool,security){
 if((await pool.query("select to_regclass('mirpanel_community.netflix_room_password_events') installed")).rows[0].installed){
  const rows=await roomStates(pool);
  return {rooms:rows.map(r=>({id:r.id,groupId:r.group_id,...(security?{accountEmail:JSON.parse(security.decryptSecret(r.account_cipher)).email}:{}),name:r.room_name,endsOn:isoDate(r.stock_end??r.group_end)?r.stock_end??r.group_end:null,
   startsOn:r.period?.startsOn??null,deliveryId:r.delivery_id,legacyAssignmentId:r.legacy_assignment_id,status:r.state,statusLabel:roomStateLabels[r.state],
   paidUntil:r.legacy_paid_until??r.period?.endsBefore??null,active:r.active,canDelete:!r.delivery_id&&!r.legacy_assignment_id&&!r.held,sellable:r.sellable===true,
   canMarkReady:r.state==='review'&&r.unexpired===true&&!r.held&&!r.synthetic&&!r.assigned}))};
 }
 const {rows}=await pool.query(`select r.id,r.group_id as "groupId",r.room_name as name,g.starts_on::text as "startsOn",r.delivery_id as "deliveryId",to_jsonb(r)->>'legacy_assignment_id' as "legacyAssignmentId",
  coalesce(to_jsonb(r)->>'stock_ends_on',g.ends_on::text) as "endsOn",
  case when coalesce((to_jsonb(r)->>'stock_ends_on')::date,g.ends_on)<=public.payment_baku_date() then 'expired'
   when r.delivery_id is not null or to_jsonb(r)->>'legacy_assignment_id' is not null then 'sold' else 'free' end status
  from ${U} r join ${G} g on g.id=r.group_id order by g.created_at desc,r.room_name,r.id limit 2000`);
 return {rooms:rows};
}
export async function restockNetflixRoom(pool,input){
 const {id,deliveryId=null,endsOn,actor='admin',confirmedEmpty}=input||{};
 if(!roomId(id)||deliveryId!==null&&!roomId(deliveryId)||!isoDate(endsOn)||endsOn<=bakuDate())throw fail(400,'Otağı və gələcək bitmə tarixini seçin.');
 const c=await pool.connect();
 try{
  await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
  const installed=(await c.query("select to_regclass('mirpanel_community.netflix_room_password_events') installed")).rows[0].installed;
  if(!installed)throw fail(503,'Otaq təhlükəsizliyi üçün baza yeniləməsi lazımdır.');
  const [room]=await roomStates(c,{roomId:id,lock:true});
  if(!room)throw fail(404,'Otaq tapılmadı.');
  if(room.legacy_assignment_id)throw fail(409,'Əvvəlki satışa bağlanmış otaq bu əməliyyatla satışa qaytarıla bilməz.');
  if(await roomSalesInstalled(c)&&(!room.delivery_id||room.state!=='expired'||room.held))
   throw fail(409,'Yalnız əvvəl ayrılmış və müddəti bitmiş otağı boşaldıb satışa qaytarmaq olar.');
  if(room.active)throw fail(409,'Ödənilmiş müddəti davam edən otağı satışa qaytarmaq olmaz.');
  if(room.delivery_id&&room.state==='review')throw fail(409,'Otağın sifariş əlaqəsi yoxlanmalıdır. Satışa qaytarılmadı.');
  if(room.delivery_id!==deliveryId)throw fail(409,'Otağın vəziyyəti dəyişib. Siyahını yeniləyin.');
  if(confirmedEmpty!==true)throw fail(400,'Otağı Netflix-də boşaltdığınızı təsdiqləyin.');
  if(!room.delivery_id&&room.availability==='available'){await c.query('commit');return {restocked:true,replayed:true};}
  await c.query(`insert into mirpanel_community.netflix_room_assignment_history(id,room_id,delivery_id,actor,ends_on) values($1,$2,$3,$4,$5)`,
   [crypto.randomUUID(),id,room.delivery_id,actor,room.period?.expiresOn??null]);
  await c.query(`update ${U} set delivery_id=null,stock_ends_on=$2,availability='available' where id=$1`,[id,endsOn]);
  await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
   values('admin',$1,'netflix.room_restocked','netflix_room',$2,$3)`,[actor,id,{previousDeliveryId:room.delivery_id,accountId:room.group_id}]);
  await c.query('commit');return {restocked:true};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

async function insertRoomBatch(c,security,secret,actor,b){
 const accountKey=digest(secret,['netflix-room-account',b.email.toLowerCase()]);
 const fingerprint=digest(secret,['netflix-room-batch',b]);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['netflix-room:'+accountKey]);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['netflix-room-request:'+b.requestId.toLowerCase()]);
 const {rows:[existing]}=await c.query(`select fingerprint from ${G} where id=$1`,[b.requestId]);
 if(existing){
  if(existing.fingerprint!==fingerprint)throw fail(409,'Bu sorğu fərqli məlumatla artıq istifadə olunub.');
  return {added:b.rooms.length,replayed:true};
 }
 const startsOn=b.startsOn??bakuDate();
 if(b.endsOn!=='infinity'&&startsOn>=b.endsOn)throw fail(400,'Bitmə tarixi Bakı vaxtı ilə bu gündən sonra olmalıdır.');
 const inserted=await c.query(`insert into ${G}(id,fingerprint,account_key,account_cipher,starts_on,ends_on,created_by)
  values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing returning id`,[b.requestId,fingerprint,accountKey,
  security.encryptSecret(JSON.stringify({id:b.requestId,email:b.email,password:b.password})),startsOn,b.endsOn,actor]);
 if(!inserted.rowCount){
  const {rows:[old]}=await c.query(`select fingerprint from ${G} where id=$1`,[b.requestId]);
  if(old?.fingerprint!==fingerprint)throw fail(409,'Bu sorğu fərqli məlumatla artıq istifadə olunub.');
 }else for(const room of b.rooms){
  const id=crypto.randomUUID();
  await c.query(`insert into ${U}(id,group_id,account_key,room_name,room_key,pin_cipher) values($1,$2,$3,$4,$5,$6)`,
   [id,b.requestId,accountKey,room.name,room.key,security.encryptSecret(JSON.stringify({id,pin:room.pin}))]);
  if(b.saleMode)await c.query(`update ${U} set availability=$2 where id=$1`,[id,b.saleMode==='ready'&&!actor.startsWith('synthetic:')?'available':'review']);
 }
 return {added:b.rooms.length,replayed:!inserted.rowCount};
}

async function saveRoomBatches(pool,security,secret,actor,batches){
 const c=await pool.connect();
 try{
  await c.query('begin');
  await c.query('select pg_advisory_xact_lock(714025001)');
  let added=0,replayed=true;
  for(const batch of batches){
   const result=await insertRoomBatch(c,security,secret,actor,batch);
   added+=result.added;replayed&&=result.replayed;
  }
  await c.query('commit');return {added,replayed};
 }catch(e){
  await c.query('rollback');
  if(e.code==='23505')throw fail(409,'Bu hesabda eyni adlı otaq artıq stokdadır.');
  throw e;
 }finally{c.release();}
}
export async function saveNetflixRooms(pool,security,secret,actor,input){
 return saveRoomBatches(pool,security,secret,actor,[parseRoomBatch(input)]);
}
export async function saveNetflixRoomCards(pool,security,secret,actor,cards){
 if(!Array.isArray(cards)||!cards.length||cards.length>20)throw fail(400,'1–20 otaq əlavə edin.');
 const requestIds=new Set();
 const batches=cards.map(card=>{
  // The stock card has no account expiration input. Existing dated accounts
  // keep their dates, and the account date can still be managed separately.
  const batch=parseRoomBatch({requestId:card?.requestId,email:card?.email,password:card?.password,
   saleMode:'ready',rooms:[{name:card?.name,pin:card?.pin}]},{undated:true});
  if(requestIds.has(batch.requestId.toLowerCase()))throw fail(400,'Təkrar hesab kartı göndərilib.');
  requestIds.add(batch.requestId.toLowerCase());
  return batch;
 });
 return saveRoomBatches(pool,security,secret,actor,batches);
}
export async function deleteNetflixRoom(pool,actor,id){
 if(!roomId(id))throw fail(400,'Otaq sorğusu düzgün deyil.');
 const c=await pool.connect();
 try{
  await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
  const {rows:[room]}=await c.query(`select r.id,r.group_id,r.delivery_id,r.legacy_assignment_id,r.deleted_at,s.held
   from ${U} r left join mirpanel_community.netflix_room_sale_state s on s.id=r.id
   where r.id=$1 for update of r`,[id]);
  if(!room)throw fail(404,'Otaq tapılmadı.');
  if(room.deleted_at){await c.query('commit');return {deleted:true};}
  if(room.delivery_id||room.legacy_assignment_id)throw fail(409,'Müştəriyə təhvil verilmiş otağı silmək olmaz.');
  if(room.held!==false)throw fail(409,'Aktiv rezervdə olan otağı silmək olmaz.');
  await c.query(`update ${U} set deleted_at=clock_timestamp(),sale_reservation_id=null where id=$1`,[id]);
  await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
   values('admin',$1,'netflix.room_deleted','netflix_room',$2,$3)`,[actor,id,{accountId:room.group_id}]);
  await c.query('commit');return {deleted:true};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

// Only the exact account, room and PIN from an ordinary delivery can claim stock.
export async function bindNetflixRoom(c,security,secret,deliveryId,{email,password,roomName,roomCode}){
 if(!secret||!email||!roomName||!roomCode)return;
 const installed=await c.query("select to_regclass('mirpanel_community.netflix_room_units') as present");
 if(!installed.rows[0].present)return;
 const accountKey=digest(secret,['netflix-room-account',email.trim().toLowerCase()]);
 const {rows:[room]}=await c.query(`select r.id,r.pin_cipher,r.delivery_id,to_jsonb(r)->>'legacy_assignment_id' legacy_assignment_id,coalesce(to_jsonb(r)->>'availability','available') availability,g.id group_id,g.account_cipher,
   coalesce((to_jsonb(r)->>'stock_ends_on')::date,g.ends_on)<=public.payment_baku_date() as expired
   from ${U} r join ${G} g on g.id=r.group_id
   where r.account_key=$1 and r.room_key=$2 and to_jsonb(r)->>'deleted_at' is null for update of r`,
  [accountKey,roomName.trim().normalize('NFC').toLowerCase()]);
 if(!room)return;
 const pin=JSON.parse(security.decryptSecret(room.pin_cipher));
 const account=JSON.parse(security.decryptSecret(room.account_cipher));
 if(pin.id!==room.id||account.id!==room.group_id||pin.pin!==roomCode||(password&&password!==account.password))
  throw fail(409,'Təhvil məlumatları stokdakı otağa uyğun gəlmir.');
 if(room.availability==='review')throw fail(409,'Otağın stok vəziyyəti yoxlanmalıdır.');
 if(await roomSalesInstalled(c)&&(await c.query('select held from mirpanel_community.netflix_room_sale_state where id=$1',[room.id])).rows[0]?.held)
  throw fail(409,'Otaq aktiv sifariş üçün rezerv edilib.');
 if(room.delivery_id||room.legacy_assignment_id)throw fail(409,'Bu stok otağı artıq təhvil verilib.');
 if(room.expired)throw fail(409,'Bu stok otağının müddəti bitib.');
 await c.query(`update ${U} set delivery_id=$2 where id=$1`,[room.id,deliveryId]);
}
