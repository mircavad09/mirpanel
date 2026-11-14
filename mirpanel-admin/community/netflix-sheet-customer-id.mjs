import {sheetReason,sheetIssue,retryableSheetReason} from './netflix-sheet-errors.mjs';
import {roomSheetClient} from './netflix-room-sheet-client.mjs';
import {syncRoomSheetBatch} from './netflix-room-sheet-sync.mjs';

const queue='mirpanel_community.netflix_sheet_customer_ids';


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

const present=r=>({deliveryId:r.delivery_id,roomId:r.room_id||null,orderCode:r.order_code,roomName:r.room_name,
 state:r.state,retryDelivery:true,attempts:r.attempts??0,nextAt:r.next_at,...sheetIssue(r.reason,r.state)});
export async function sheetCustomerIdStates(db){
 if(!await sheetQueueInstalled(db))return {rooms:new Map(),manual:[],entries:[]};
 const {rows}=await db.query(`select j.delivery_id,j.room_id,j.state,j.reason,j.attempts,j.next_at,o.order_code::text,r.room_name
  from ${queue} j left join mirpanel_community.netflix_room_units r on r.id=j.room_id
  join mirpanel_community.customer_order_deliveries d on d.id=j.delivery_id join public.payment_orders o on o.id=d.order_id
  where j.state<>'done' and (r.delivery_id=j.delivery_id or j.room_id is null)
  order by j.created_at desc,j.delivery_id`);
 const entries=rows.map(present),rooms=new Map(),manual=[];
 for(const r of entries){if(r.roomId)rooms.set(r.roomId,r);else manual.push(r);}
 if((await db.query("select to_regclass('mirpanel_community.netflix_room_sheet_sync') present")).rows[0].present){
  const failures=(await db.query(`select s.room_id,s.failures,s.retry_at,coalesce(s.sent->>'error',s.sent->>'warning') reason,
    r.room_name,d.id delivery_id,o.order_code::text from mirpanel_community.netflix_room_sheet_sync s
    join mirpanel_community.netflix_room_units r on r.id=s.room_id
    left join mirpanel_community.customer_order_deliveries d on d.id=r.delivery_id left join public.payment_orders o on o.id=d.order_id
    where s.failures>0 or s.sent->>'warning' is not null`)).rows;
  for(const r of failures){
   const prior=rooms.get(r.room_id),issue=prior?.needsReview?{reason:prior.reason,message:prior.message,fix:prior.fix,needsReview:true}:sheetIssue(r.reason);
   const value={...prior,retryDelivery:!!prior?.retryDelivery,deliveryId:prior?.deliveryId||r.delivery_id,roomId:r.room_id,roomRetryId:r.room_id,roomName:r.room_name,
    orderCode:prior?.orderCode||r.order_code,state:issue.needsReview?'blocked':'pending',attempts:Math.max(prior?.attempts||0,r.failures),nextAt:r.retry_at,...issue};
   if(prior)entries.splice(entries.indexOf(prior),1,value);else entries.push(value);
   rooms.set(r.room_id,value);
  }
 }
 return {rooms,manual,entries};
}

export async function retrySheetCustomerId(db,deliveryId){
 if(typeof deliveryId!=='string'||! /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(deliveryId))
  throw Object.assign(Error('Təhvil identifikatoru düzgün deyil.'),{status:400});
 const {rowCount}=await db.query(`update ${queue} j set state='pending',next_at=least(next_at,now())
  where j.delivery_id=$1 and j.state<>'done' and (j.state<>'pending' or j.next_at>now()) and (j.room_id is null or exists(
   select 1 from mirpanel_community.netflix_room_units r where r.id=j.room_id and r.delivery_id=j.delivery_id))`,[deliveryId]);
 if(!rowCount){
  const current=(await db.query(`select 1 from ${queue} j where j.delivery_id=$1 and j.state='pending' and (j.room_id is null or exists(select 1 from mirpanel_community.netflix_room_units r where r.id=j.room_id and r.delivery_id=j.delivery_id))`,[deliveryId])).rowCount;
  if(!current)throw Object.assign(Error('Təkrar yazıla bilən cari təhvil tapılmadı.'),{status:409});
 }
 return {queued:true};
}

export async function retrySheetRoom(db,roomId){
 if(typeof roomId!=='string'||! /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(roomId))throw Object.assign(Error('Otaq düzgün deyil.'),{status:400});
 const result=await db.query("update mirpanel_community.netflix_room_sheet_sync set retry_at=least(retry_at,now()) where room_id=$1 and (failures>0 or sent->>'warning' is not null)",[roomId]);
 if(!result.rowCount)throw Object.assign(Error('Təkrar yoxlanacaq otaq tapılmadı.'),{status:409});return {queued:true};
}

export async function writeNextSheetCustomerId(pool,security,client){
 const c=await pool.connect();
 try{
  await c.query('begin');
  // Serialize Sheets reads and writes even across Render instances.
  if(!(await c.query('select pg_try_advisory_xact_lock(926110213) locked')).rows[0].locked){await c.query('commit');return false;}
  const {rows:[job]}=await c.query(`select * from ${queue} where state in ('pending','blocked','done') and reason is distinct from 'released' and next_at<=now()
   order by (state='done'),next_at,created_at limit 1 for update skip locked`);
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
     if(!result.done&&!result.reason)throw Error('ROOM_SHEET_WRITE_NOT_CONFIRMED');
     state=result.done?'done':'blocked';reason=result.reason??null;
    }catch(error){reason=sheetReason(error);state=retryableSheetReason(reason)?'pending':'blocked';}
   }
  }
  const delay=state==='done'?900:state==='blocked'?900:Math.min(3600,30*2**Math.min(job.attempts,7));
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
