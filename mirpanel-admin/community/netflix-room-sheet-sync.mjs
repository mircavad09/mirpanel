import {addCalendarMonthsMinusDay,bakuDate,safeCalendarDate} from '../payment-order-lifecycle.mjs';
import {subscriptionPeriod} from './subscriptions.mjs';
import {paidStatus,roomSheetClient} from './netflix-room-sheet-client.mjs';

const sync='mirpanel_community.netflix_room_sheet_sync';
const pending='Yenilənmə gözlənilir';
export function roomSheetState(room){
 if(!room.delivery_id)return ['',room.group_end,'',''];
 const items=room.checkout_snapshot?.items;
 const plan=items?.[room.line_index]??room.checkout_snapshot;
 const period=subscriptionPeriod({
  durationDays:plan?.durationDays,durationMonths:plan?.durationMonths??room.duration_months,
  label:plan?.planName??room.plan_name
 });
 const starts=bakuDate(room.delivered_at);
 let months=period?.unit==='months'?period.count:null;
 const explicit=(!items||items.length===1)&&Number(plan?.quantity??room.order_quantity??1)===1;
 let end=(explicit&&safeCalendarDate(room.service_expires_on))||(months?addCalendarMonthsMinusDay(starts,months):'');
 let paid=false;
 for(const renewal of room.renewals){
  if(renewal.base!==end)continue;
  if(!renewal.end||room.today<renewal.starts){paid=true;break;}
  end=renewal.end;
  months=renewal.months;
 }
 const status=paid?paidStatus:end&&room.today>end?'Yenilənməyib':pending;
 return [room.member_number??'',end||'',status,[1,3,6].includes(months)?months+' ay':''];
}

export async function syncRoomSheetBatch(pool,security,target,client,cursor=null){
 const c=await pool.connect();
 try{
  await c.query('begin');
  const locked=(await c.query('select pg_try_advisory_xact_lock(926110213) locked')).rows[0].locked;
  if(!locked){await c.query('rollback');return cursor;}
  const {rows}=await c.query(`select r.*,g.account_cipher,g.ends_on::text group_end,
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
    select jsonb_agg(jsonb_build_object('base',v.base_expires_on,'end',v.expires_on,
      'starts',greatest(v.base_expires_on+1,(rd.delivered_at at time zone 'Asia/Baku')::date),
      'months',case when v.period_unit='months' then v.period_count end)
      order by v.base_expires_on, v.expires_on desc nulls last) events
    from mirpanel_community.subscription_renewals v join public.payment_orders ro on ro.id=v.order_id
    left join mirpanel_community.customer_order_deliveries rd on rd.order_id=v.order_id and rd.line_index=v.line_index
    where v.source_id=r.delivery_id and v.user_id=l.user_id
     and ro.status not in ('cancelled','rejected','expired')
     and (ro.payment_confirmed or ro.status in ('approved','completed'))
   ) renewals on true
   where ($2::uuid is null or r.id>$2) order by r.id limit 25`,[target,cursor]);
  let sheet;
  for(const room of rows){
   if(room.deferred)continue;
   const state=roomSheetState(room);
   if(JSON.stringify(room.sent)===JSON.stringify(state))continue;
   try{
    sheet??=await client.open();
    const account=JSON.parse(security.decryptSecret(room.account_cipher));
    const pin=JSON.parse(security.decryptSecret(room.pin_cipher));
    if(pin.id!==room.id||account.id!==room.group_id||!/^\d{4}$/.test(pin.pin))throw Error('ROOM_SHEET_DATA');
    const [member,end,status,packageName]=state;
    await sheet.upsert([member,room.room_name+' · '+pin.pin,account.email,account.password,end,status,packageName,room.id]);
    await c.query(`insert into ${sync}(room_id,target,sent) values($1,$2,$3)
     on conflict(room_id) do update set target=excluded.target,sent=excluded.sent,retry_at='-infinity',failures=0`,
    [room.id,target,JSON.stringify(state)]);
   }catch{
    const delay=Math.min(3600,30*2**Math.min(room.failures,7));
    await c.query(`insert into ${sync} as previous(room_id,target,retry_at,failures)
     values($1,$2,clock_timestamp()+make_interval(secs=>$3),1)
     on conflict(room_id) do update set sent=case when previous.target=excluded.target then previous.sent end,
      target=excluded.target,retry_at=excluded.retry_at,failures=$4`,[room.id,target,delay,room.failures+1]);
    console.warn('NETFLIX_ROOM_SHEET_RETRY');
    await c.query('commit');
    // After an ambiguous append failure, re-read column H before any retry.
    return room.id;
   }
  }
  await c.query('commit');
  return rows.length===25?rows.at(-1).id:null;
 }catch(error){await c.query('rollback');throw error;}
 finally{c.release();}
}

export function startRoomSheetSync(pool,security,env){
 const target=env.NETFLIX_ROOM_SHEET_ID;
 if(!target)return;
 const client=roomSheetClient(target,JSON.parse(env.NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT||'{}'));
 let cursor=null;
 async function tick(){
  try{cursor=await syncRoomSheetBatch(pool,security,target,client,cursor);}
  catch{console.warn('NETFLIX_ROOM_SHEET_SYNC_UNAVAILABLE');}
  finally{setTimeout(tick,15000).unref();}
 }
 void tick();
}
