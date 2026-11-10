import crypto from 'node:crypto';
const G='mirpanel_community.netflix_room_groups', U='mirpanel_community.netflix_room_units';
const fail=(status,message)=>Object.assign(Error(message),{status});
const digest=(secret,value)=>crypto.createHmac('sha256',secret).update(JSON.stringify(value)).digest('hex');
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value.slice(0,4)!=='0000'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function parseRoomBatch(b){
 const {requestId,email,password,startsOn,endsOn,rooms}=b||{};
 if(typeof requestId!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestId))throw fail(400,'Saxlama sorğusu düzgün deyil.');
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||!password.trim()||password.length>512||/[\r\n\0]/.test(password))throw fail(400,'Etibarlı hesab e-poçtu və şifrəsi yazın.');
 if(!isoDate(startsOn)||!isoDate(endsOn)||startsOn>=endsOn)throw fail(400,'Dövrün son tarixi başlanğıcdan sonra olmalıdır.');
 if(!Array.isArray(rooms)||rooms.length<1||rooms.length>20)throw fail(400,'1–20 otaq əlavə edin.');
 const seen=new Set();
 return {requestId,email:email.trim(),password,startsOn,endsOn,rooms:rooms.map(room=>{
  const name=typeof room?.name==='string'?room.name.trim().normalize('NFC'):'',pin=room?.pin;
  if(!name||name.length>50||/[\x00-\x1f\x7f]/.test(name)||typeof pin!=='string'||!/^\d{4}$/.test(pin))throw fail(400,'Hər otağa ad və dörd rəqəmli PIN yazın.');
  const key=name.toLowerCase();
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
  const inserted=await c.query(`insert into ${G}(id,fingerprint,account_key,account_cipher,starts_on,ends_on,created_by)
   values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing returning id`,[b.requestId,fingerprint,accountKey,
   security.encryptSecret(JSON.stringify({id:b.requestId,email:b.email,password:b.password})),b.startsOn,b.endsOn,actor]);
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
