import {createHash} from 'node:crypto';
import {roomSheetClient} from './netflix-room-sheet-client.mjs';
import {roomPaymentStatus} from './netflix-room-paid-period.mjs';

const sync='mirpanel_community.netflix_room_sheet_sync';
export function roomSheetState(room){
 return [room.delivery_id?room.member_number??'':'',room.stock_end??room.group_end,roomPaymentStatus(room)];
}

export async function syncRoomSheetBatch(pool,security,target,client,cursor=null){
 const c=await pool.connect();
 try{
  await c.query('begin');
  const locked=(await c.query('select pg_try_advisory_xact_lock(926110213) locked')).rows[0].locked;
  if(!locked){await c.query('rollback');return cursor;}
  const {rows}=await c.query(`select r.*,r.stock_ends_on::text stock_end,g.account_cipher,g.ends_on::text group_end,
    l.user_id,(o.status not in ('cancelled','rejected','expired') and (o.payment_confirmed or o.status in ('approved','completed'))) purchase_paid,
    n.member_number::text,d.line_index,d.delivered_at,o.checkout_snapshot,o.duration_months,o.plan_name,
    o.quantity order_quantity,o.service_expires_on::text,public.payment_baku_date()::text today,
    case when s.target=$1 then s.sent end sent,
    case when s.target=$1 then coalesce(s.failures,0) else 0 end failures,
    case when s.target=$1 then s.retry_at>clock_timestamp() else false end deferred,
    coalesce(renewals.events,'[]') renewals
   from mirpanel_community.netflix_room_units r
   join mirpanel_community.netflix_room_groups g on g.id=r.group_id
   left join ${sync} s on s.room_id=r.id
   left join mirpanel_community.customer_order_deliveries d on d.id=r.delivery_id
   left join public.payment_orders o on o.id=d.order_id
   left join mirpanel_community.community_order_owners l on l.order_id=o.id
   left join mirpanel_community.community_member_numbers n on n.user_id=l.user_id
   left join lateral (
    select jsonb_agg(jsonb_build_object('base',v.base_expires_on,'orderId',v.order_id,
      'paidOn',(coalesce(ro.completed_at,ro.created_at) at time zone 'Asia/Baku')::date,
      'months',case when v.period_unit='months' then v.period_count end,'confirmed',true)
      order by v.base_expires_on,v.order_id) events
    from mirpanel_community.subscription_renewals v join public.payment_orders ro on ro.id=v.order_id
    where v.source_id=r.delivery_id and v.user_id=l.user_id
     and ro.status not in ('cancelled','rejected','expired')
     and (ro.payment_confirmed or ro.status in ('approved','completed'))
   ) renewals on true
   where ($2::uuid is null or (r.group_id,r.room_key,r.id)>($2,$3,$4::uuid))
   order by r.group_id,r.room_key,r.id limit 25`,[target,...(cursor??[null,null,null])]);
  const position=room=>[room.group_id,room.room_key,room.id];
  let sheet;
  for(const room of rows){
   if(room.deferred)continue;
   const state=roomSheetState(room);
   const revision=createHash('sha256').update(JSON.stringify([room.room_name,room.account_cipher,room.pin_cipher])).digest('hex');
   const checkpoint=[...state,revision,room.group_id];
   if(JSON.stringify(room.sent)===JSON.stringify(checkpoint))continue;
   try{
    sheet??=await client.open();
    const account=JSON.parse(security.decryptSecret(room.account_cipher));
    const pin=JSON.parse(security.decryptSecret(room.pin_cipher));
    if(pin.id!==room.id||account.id!==room.group_id||!/^\d{4}$/.test(pin.pin))throw Error('ROOM_SHEET_DATA');
    const [member,end,status]=state;
    await sheet.upsert([member,room.room_name+' · '+pin.pin,account.email,account.password,end,status,room.id,room.group_id]);
    await c.query(`insert into ${sync}(room_id,target,sent) values($1,$2,$3)
     on conflict(room_id) do update set target=excluded.target,sent=excluded.sent,retry_at='-infinity',failures=0`,
    [room.id,target,JSON.stringify(checkpoint)]);
   }catch{
    const delay=Math.min(3600,30*2**Math.min(room.failures,7));
    await c.query(`insert into ${sync} as previous(room_id,target,retry_at,failures)
     values($1,$2,clock_timestamp()+make_interval(secs=>$3),1)
     on conflict(room_id) do update set sent=case when previous.target=excluded.target then previous.sent end,
      target=excluded.target,retry_at=excluded.retry_at,failures=$4`,[room.id,target,delay,room.failures+1]);
    console.warn('NETFLIX_ROOM_SHEET_RETRY');
    await c.query('commit');
    // After an ambiguous append failure, re-read hidden column G before retrying.
    return position(room);
   }
  }
  if(sheet?.group)await sheet.group();
  await c.query('commit');
  return rows.length===25?position(rows.at(-1)):null;
 }catch(error){await c.query('rollback');throw error;}
 finally{c.release();}
}

export function startRoomSheetSync(pool,security,env){
 const target=env.NETFLIX_ROOM_SHEET_ID;
 if(!target)return;
 const client=roomSheetClient(target,JSON.parse(env.NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT||'{}'),env.NETFLIX_ROOM_SHEET_OWNER_EMAIL);
 let cursor=null;
 async function tick(){
  try{cursor=await syncRoomSheetBatch(pool,security,target,client,cursor);}
  catch{console.warn('NETFLIX_ROOM_SHEET_SYNC_UNAVAILABLE');}
  finally{setTimeout(tick,15000).unref();}
 }
 void tick();
}
