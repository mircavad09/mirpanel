import {roomSheetClient} from './netflix-room-sheet-client.mjs';

const queue='mirpanel_community.netflix_sheet_customer_ids';
const messages={
 headers:'Cədvəldə A, B və C sütunlarının başlıqlarını yoxlayın.',
 delivery:'Təhvil məlumatı və ya müştəri ID-si tapılmadı.',
 missing:'Gmail, otaq adı və PIN üzrə uyğun sətir tapılmadı.',
 duplicate:'Gmail, otaq adı və PIN üzrə birdən çox sətir tapıldı.',
 conflict:'Uyğun sətrin A xanasında başqa dəyər var.',
 released:'Bu təhvil artıq otağın cari təhvili deyil.',
 sheets:'Google Sheets bağlantısı uğursuz oldu. Sistem yenidən cəhd edəcək.'
};

export async function sheetCustomerIdStates(db){
 if(!(await db.query("select to_regclass($1) installed",[queue])).rows[0].installed)return new Map();
 const {rows}=await db.query(`select distinct on (room_id) room_id,delivery_id,state,reason from ${queue}
  order by room_id,created_at desc,delivery_id`);
 return new Map(rows.map(r=>[r.room_id,{deliveryId:r.delivery_id,state:r.state,message:messages[r.reason]}]));
}

export async function retrySheetCustomerId(db,deliveryId){
 if(typeof deliveryId!=='string'||! /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(deliveryId))
  throw Object.assign(Error('Təhvil identifikatoru düzgün deyil.'),{status:400});
 const {rowCount}=await db.query(`update ${queue} j set state='pending',reason=null,next_at=now(),attempts=0
  from mirpanel_community.netflix_room_units r where j.delivery_id=$1 and j.room_id=r.id and r.delivery_id=j.delivery_id and j.state<>'done'`,[deliveryId]);
 if(!rowCount)throw Object.assign(Error('Təkrar yazıla bilən cari təhvil tapılmadı.'),{status:409});
 return {queued:true};
}

export async function writeNextSheetCustomerId(pool,security,client){
 const c=await pool.connect();
 try{
  await c.query('begin');
  // Serialize Sheets reads and writes even across Render instances.
  if(!(await c.query('select pg_try_advisory_xact_lock(926110213) locked')).rows[0].locked){await c.query('commit');return false;}
  const {rows:[job]}=await c.query(`select * from ${queue} where state='pending' and next_at<=now()
   order by next_at,created_at limit 1 for update skip locked`);
  if(!job){await c.query('commit');return false;}
  const {rows:[delivery]}=await c.query(`select d.order_id,d.line_index,d.message_cipher,n.member_number::text,
   r.delivery_id current_delivery
   from mirpanel_community.netflix_room_units r
   join mirpanel_community.customer_order_deliveries d on d.id=$2
   join public.payment_orders o on o.id=d.order_id
   join mirpanel_community.community_order_owners u on u.order_id=o.id
   left join mirpanel_community.community_member_numbers n on n.user_id=u.user_id
   where r.id=$1 and o.payment_confirmed and o.status not in ('rejected','cancelled','expired')
   for share of r`,[job.room_id,job.delivery_id]);
  let state='blocked',reason='delivery';
  if(delivery&&delivery.current_delivery!==job.delivery_id)reason='released';
  else if(delivery?.member_number){
   let snapshot;
   try{snapshot=JSON.parse(security.decryptSecret(delivery.message_cipher));}catch{}
   if(snapshot?.id===job.delivery_id&&snapshot.order===delivery.order_id&&snapshot.line===delivery.line_index){
    try{
     const result=await client.writeCustomerId(snapshot,delivery.member_number);
     state=result.done?'done':'blocked';reason=result.reason??null;
    }catch{state='pending';reason='sheets';}
   }
  }
  const delay=Math.min(3600,30*2**Math.min(job.attempts,7));
  await c.query(`update ${queue} set state=$2,reason=$3,attempts=attempts+1,next_at=now()+make_interval(secs=>$4) where delivery_id=$1`,
   [job.delivery_id,state,reason,delay]);
  await c.query('commit');return true;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

export function startSheetCustomerIdSync(pool,security,env){
 const target=env.NETFLIX_ROOM_SHEET_ID;
 if(!target)return;
 const client=roomSheetClient(target,JSON.parse(env.NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT||'{}'),env.NETFLIX_ROOM_SHEET_OWNER_EMAIL);
 async function tick(){
  try{for(let i=0;i<5&&await writeNextSheetCustomerId(pool,security,client);i++);}
  catch{console.warn('NETFLIX_SHEET_CUSTOMER_ID_UNAVAILABLE');}
  finally{setTimeout(tick,15000).unref();}
 }
 void tick();
}
