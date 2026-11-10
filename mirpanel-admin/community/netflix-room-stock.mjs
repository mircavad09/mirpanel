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
 const {rows:[group]}=await pool.query(`select g.id,g.account_cipher from ${U} r join ${G} g on g.id=r.group_id where r.id=$1`,[id]);
 if(!group)throw fail(404,'Otaq tapılmadı.');
 const value=JSON.parse(security.decryptSecret(group.account_cipher));
 if(value.id!==group.id||typeof value.password!=='string')throw fail(409,'Netflix şifrəsi oxunmadı.');
 return {password:value.password};
}
export async function editNetflixRoom(pool,security,input){
 const {id,action}=input;
 if(!roomId(id)||!['open','save'].includes(action))throw fail(400,'Otaq sorğusu düzgün deyil.');
 if(action==='open'){
  const {rows:[room]}=await pool.query(`select id,room_name,pin_cipher,delivery_id from ${U} where id=$1`,[id]);
  if(!room)throw fail(404,'Otaq tapılmadı.');
  const value=JSON.parse(security.decryptSecret(room.pin_cipher));
  if(value.id!==room.id||typeof value.pin!=='string'||!/^\d{4}$/.test(value.pin))throw fail(409,'Otağın PIN-i oxunmadı.');
  return {id:room.id,name:room.room_name,pin:value.pin,editable:!room.delivery_id};
 }
 const room=parseRoom(input);
 try{
  const {rowCount}=await pool.query(`update ${U} set room_name=$2,room_key=$3,pin_cipher=$4 where id=$1 and delivery_id is null`,
   [id,room.name,room.key,security.encryptSecret(JSON.stringify({id:id.toLowerCase(),pin:room.pin}))]);
  if(!rowCount)throw fail(409,'Otaq tapılmadı və ya artıq sifarişə ayrılıb.');
  return {id,name:room.name};
 }catch(e){if(e.code==='23505')throw fail(409,'Bu hesabda eyni adlı otaq artıq stokdadır.');throw e;}
}
export function parseRoomBatch(b){
 const {requestId,email,password,startsOn,endsOn,rooms}=b||{};
 if(typeof requestId!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId))throw fail(400,'Saxlama sorğusu düzgün deyil.');
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||!password.trim()||password.length>512||/[\r\n\0]/.test(password))throw fail(400,'Etibarlı hesab e-poçtu və şifrəsi yazın.');
 if(!isoDate(endsOn)||startsOn!==undefined&&(!isoDate(startsOn)||startsOn>=endsOn))throw fail(400,'Bitmə tarixi düzgün deyil.');
 if(!Array.isArray(rooms)||rooms.length<1||rooms.length>20)throw fail(400,'1–20 otaq əlavə edin.');
 const seen=new Set();
 return {requestId,email:email.trim(),password,startsOn,endsOn,rooms:rooms.map(room=>{
  const {name,key,pin}=parseRoom(room);
  if(seen.has(key))throw fail(400,'Eyni otaq adı təkrarlana bilməz.');
  seen.add(key);return {name,key,pin};
 })};
}
export async function netflixRooms(pool){
 const {rows}=await pool.query(`select r.id,r.room_name as name,g.starts_on::text as "startsOn",g.ends_on::text as "endsOn",
  case when g.ends_on<=public.payment_baku_date() then 'expired' when r.delivery_id is not null then 'sold' else 'free' end status
  from ${U} r join ${G} g on g.id=r.group_id order by g.created_at desc,r.room_name,r.id limit 250`);
 return {rooms:rows};
}
export async function saveNetflixRooms(pool,security,secret,actor,input){
 const b=parseRoomBatch(input),accountKey=digest(secret,['netflix-room-account',b.email.toLowerCase()]);
 const fingerprint=digest(secret,['netflix-room-batch',b]);
 const c=await pool.connect();
 try{
  await c.query('begin');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['netflix-room:'+accountKey]);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['netflix-room-request:'+b.requestId.toLowerCase()]);
  const {rows:[existing]}=await c.query(`select fingerprint from ${G} where id=$1`,[b.requestId]);
  if(existing){
   if(existing.fingerprint!==fingerprint)throw fail(409,'Bu sorğu fərqli məlumatla artıq istifadə olunub.');
   await c.query('commit');return {added:b.rooms.length,replayed:true};
  }
  const startsOn=b.startsOn??bakuDate();
  if(startsOn>=b.endsOn)throw fail(400,'Bitmə tarixi Bakı vaxtı ilə bu gündən sonra olmalıdır.');
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
  }
  await c.query('commit');return {added:b.rooms.length,replayed:!inserted.rowCount};
 }catch(e){await c.query('rollback');if(e.code==='23505')throw fail(409,'Bu hesabda eyni adlı otaq artıq stokdadır.');throw e;}finally{c.release();}
}

// Only the exact account, room and PIN from an ordinary delivery can claim stock.
export async function bindNetflixRoom(c,security,secret,deliveryId,{email,password,roomName,roomCode}){
 if(!secret||!email||!roomName||!roomCode)return;
 const installed=await c.query("select to_regclass('mirpanel_community.netflix_room_units') as present");
 if(!installed.rows[0].present)return;
 const accountKey=digest(secret,['netflix-room-account',email.trim().toLowerCase()]);
 const {rows:[room]}=await c.query(`select r.id,r.pin_cipher,r.delivery_id,g.id group_id,g.account_cipher,
   g.ends_on<=public.payment_baku_date() as expired
   from ${U} r join ${G} g on g.id=r.group_id
   where r.account_key=$1 and r.room_key=$2 for update of r`,
  [accountKey,roomName.trim().normalize('NFC').toLowerCase()]);
 if(!room)return;
 const pin=JSON.parse(security.decryptSecret(room.pin_cipher));
 const account=JSON.parse(security.decryptSecret(room.account_cipher));
 if(pin.id!==room.id||account.id!==room.group_id||pin.pin!==roomCode||(password&&password!==account.password))
  throw fail(409,'Təhvil məlumatları stokdakı otağa uyğun gəlmir.');
 if(room.delivery_id)throw fail(409,'Bu stok otağı artıq təhvil verilib.');
 if(room.expired)throw fail(409,'Bu stok otağının müddəti bitib.');
 await c.query(`update ${U} set delivery_id=$2 where id=$1`,[room.id,deliveryId]);
}
