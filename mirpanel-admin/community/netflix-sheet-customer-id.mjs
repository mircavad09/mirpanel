import {roomSheetClient} from './netflix-room-sheet-client.mjs';
import {syncRoomSheetBatch} from './netflix-room-sheet-sync.mjs';

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

async function sheetQueueInstalled(db){
 return (await db.query("select to_regclass($1) installed",[queue])).rows[0].installed;
}

export async function queueManualSheetCustomerId(db,deliveryId){
 if(!await sheetQueueInstalled(db))return;
 // The room trigger has already queued a stock assignment when one exists.
 // A manual delivery can also identify a room registered only in the sheet.
 await db.query(`insert into ${queue}(delivery_id,room_id)
  select $1,null where exists(select 1 from pg_attribute
   where attrelid=to_regclass($2) and attname='room_id' and not attnotnull and not attisdropped)
  on conflict(delivery_id) do nothing`,[deliveryId,queue]);
}

export async function reconcileSheetDeliveryQueue(db){
 if(!await sheetQueueInstalled(db))return 0;
 const nullable=(await db.query(`select not attnotnull nullable from pg_attribute
  where attrelid=to_regclass($1) and attname='room_id' and not attisdropped`,[queue])).rows[0]?.nullable;
 const result=await db.query(`insert into ${queue}(delivery_id,room_id)
  select d.id,r.id from mirpanel_community.customer_order_deliveries d
  join public.payment_orders o on o.id=d.order_id
  left join mirpanel_community.netflix_room_units r on r.delivery_id=d.id
  where coalesce(o.checkout_snapshot->'items'->d.line_index->>'productId',o.checkout_snapshot->>'productId',o.product_id)='netflix'
   and (o.payment_confirmed or o.status in ('approved','completed')) and o.status not in ('cancelled','rejected','expired')
   and not exists(select 1 from mirpanel_community.netflix_room_assignment_history h where h.delivery_id=d.id)
   and (r.id is not null or $1::boolean)
  on conflict(delivery_id) do nothing`,[!!nullable]);
 return result.rowCount;
}

const present=r=>({deliveryId:r.delivery_id,state:r.state,message:messages[r.reason]});
export async function sheetCustomerIdStates(db){
 if(!await sheetQueueInstalled(db))return {rooms:new Map(),manual:[]};
 const {rows}=await db.query(`select j.delivery_id,j.room_id,j.state,j.reason,o.order_code::text
  from ${queue} j
  left join mirpanel_community.netflix_room_units r on r.id=j.room_id
  join mirpanel_community.customer_order_deliveries d on d.id=j.delivery_id
  join public.payment_orders o on o.id=d.order_id
  where r.delivery_id=j.delivery_id or (j.room_id is null and j.state<>'done')
  order by j.created_at desc,j.delivery_id`);
 const rooms=new Map(),manual=[];
 for(const r of rows){
  if(r.room_id)rooms.set(r.room_id,present(r));
  else manual.push({...present(r),orderCode:r.order_code});
 }
 if((await db.query("select to_regclass('mirpanel_community.netflix_room_sheet_sync') present")).rows[0].present){
  const failures=(await db.query(`select room_id,sent->>'error' reason from mirpanel_community.netflix_room_sheet_sync where failures>0`)).rows;
  const descriptions={ROOM_SHEET_DUPLICATE:messages.duplicate,ROOM_SHEET_DUPLICATE_ID:messages.duplicate,ROOM_SHEET_MISSING:messages.missing,ROOM_SHEET_DATA:messages.delivery,
   ROOM_SHEET_OWNER_CONFLICT:messages.conflict,ROOM_SHEET_IDENTITY_CONFLICT:'Sabit otaq ID-si ilə Gmail, otaq adı və PIN uyğun gəlmir.',ROOM_SHEET_HEADERS:messages.headers};
  for(const row of failures)rooms.set(row.room_id,{state:'pending',message:descriptions[row.reason]??messages.sheets});
 }
 return {rooms,manual};
}

export async function retrySheetCustomerId(db,deliveryId){
 if(typeof deliveryId!=='string'||! /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(deliveryId))
  throw Object.assign(Error('Təhvil identifikatoru düzgün deyil.'),{status:400});
 const {rowCount}=await db.query(`update ${queue} j set state='pending',reason=null,next_at=now(),attempts=0
  where j.delivery_id=$1 and j.state<>'done' and (j.room_id is null or exists(
   select 1 from mirpanel_community.netflix_room_units r where r.id=j.room_id and r.delivery_id=j.delivery_id))`,[deliveryId]);
 if(!rowCount)throw Object.assign(Error('Təkrar yazıla bilən cari təhvil tapılmadı.'),{status:409});
 return {queued:true};
}

export async function writeNextSheetCustomerId(pool,security,client){
 const c=await pool.connect();
 try{
  await c.query('begin');
  // Serialize Sheets reads and writes even across Render instances.
  if(!(await c.query('select pg_try_advisory_xact_lock(926110213) locked')).rows[0].locked){await c.query('commit');return false;}
  const {rows:[job]}=await c.query(`select * from ${queue} where state in ('pending','done') and next_at<=now()
   order by next_at,created_at limit 1 for update skip locked`);
  if(!job){await c.query('commit');return false;}
  const current=job.room_id&&(await c.query('select delivery_id from mirpanel_community.netflix_room_units where id=$1 for share',[job.room_id])).rows[0];
  const {rows:[delivery]}=await c.query(`select d.order_id,d.line_index,d.message_cipher,n.member_number::text,
   exists(select 1 from mirpanel_community.subscription_renewals v join public.payment_orders ro on ro.id=v.order_id
    where v.source_id=d.id and v.user_id=u.user_id and ro.status not in ('cancelled','rejected','expired')
    and (ro.payment_confirmed or ro.status in ('approved','completed'))) renewed
   from mirpanel_community.customer_order_deliveries d
   join public.payment_orders o on o.id=d.order_id
   join mirpanel_community.community_order_owners u on u.order_id=o.id
   left join mirpanel_community.community_member_numbers n on n.user_id=u.user_id
   where d.id=$1 and (o.payment_confirmed or o.status in ('approved','completed'))
    and o.status not in ('rejected','cancelled','expired')`,[job.delivery_id]);
  let state='blocked',reason='delivery';
  if(job.room_id&&current?.delivery_id!==job.delivery_id)reason='released';
  else if(delivery?.member_number){
   let snapshot;
   try{snapshot=JSON.parse(security.decryptSecret(delivery.message_cipher));}catch{}
   if(snapshot?.id===job.delivery_id&&snapshot.order===delivery.order_id&&snapshot.line===delivery.line_index){
    try{
     const result=await client.writeCustomerId(snapshot,delivery.member_number,{status:delivery.renewed?'✓ Yenilənib':'✓ Satılıb'});
     state=result.done?'done':'blocked';reason=result.reason??null;
    }catch{state='pending';reason='sheets';}
   }
  }
  const delay=state==='done'?900:Math.min(3600,30*2**Math.min(job.attempts,7));
  await c.query(`update ${queue} set state=$2,reason=$3,attempts=attempts+1,next_at=now()+make_interval(secs=>$4) where delivery_id=$1`,
   [job.delivery_id,state,reason,delay]);
  await c.query('commit');return true;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

export function startSheetCustomerIdSync(pool,security,env){
 const target=env.NETFLIX_ROOM_SHEET_ID;
 if(!target)return;
 const client=roomSheetClient(target,JSON.parse(env.NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT||'{}'),env.NETFLIX_ROOM_SHEET_OWNER_EMAIL);
 let cursor=null,backfilled=false;
 async function tick(){
  try{
   if(!backfilled){await reconcileSheetDeliveryQueue(pool);backfilled=true;}
   for(let i=0;i<5&&await writeNextSheetCustomerId(pool,security,client);i++);
   if((await pool.query("select to_regclass('mirpanel_community.netflix_room_sheet_sync') present")).rows[0].present)
    cursor=await syncRoomSheetBatch(pool,security,target,client,cursor);
  }
  catch{console.warn('NETFLIX_SHEET_CUSTOMER_ID_UNAVAILABLE');}
  finally{setTimeout(tick,15000).unref();}
 }
 void tick();
}
