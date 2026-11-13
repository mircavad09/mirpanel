import {createHash} from 'node:crypto';
import {legacyInstalled} from './netflix-room-legacy.mjs';
import {roomSalesInstalled} from './netflix-room-sale.mjs';

const sync='mirpanel_community.netflix_room_sheet_sync';
export function roomSheetState(room){
 const renewed=(room.renewals||[]).some(event=>event.confirmed&&event.orderId);
 if(room.legacy_paid_until)return [room.member_number??'',room.legacy_paid_until,renewed?'✓ Yenilənib':'✓ Satılıb'];
 if(room.sale_managed&&!room.delivery_id)return ['',room.stock_end??room.group_end,
  room.synthetic?'Sınaq — satışdan kənar':room.held?'Rezerv edilib':!room.unexpired?'Yenilənməyib':room.sellable?'Satılmayıb':'Yoxlama tələb olunur'];
 const status=room.delivery_id?(room.purchase_paid===false?'Yoxlama tələb olunur':renewed?'✓ Yenilənib':'✓ Satılıb'):
  room.availability==='review'?'Yoxlama tələb olunur':'✕ Satılmayıb';
 return [room.delivery_id?room.member_number??'':'',room.stock_end??room.group_end,status];
}

export async function syncRoomSheetBatch(pool,security,target,client,cursor=null){
 const c=await pool.connect();
 try{
  await c.query('begin');
  const locked=(await c.query('select pg_try_advisory_xact_lock(926110213) locked')).rows[0].locked;
  if(!locked){await c.query('rollback');return cursor;}
  const legacy=await legacyInstalled(c);
  const managed=await roomSalesInstalled(c);
  const {rows}=await c.query(`select r.*,r.stock_ends_on::text stock_end,g.account_cipher,g.ends_on::text group_end,
    ${legacy?'coalesce(a.user_id,l.user_id)':'l.user_id'} user_id,(o.status not in ('cancelled','rejected','expired') and (o.payment_confirmed or o.status in ('approved','completed'))) purchase_paid,
    ${legacy?'a.paid_until::text legacy_paid_until,':''}
    ${managed?'true sale_managed,rs.synthetic,rs.held,rs.unexpired,(sv.id is not null) sellable,':''}
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
   ${legacy?'left join mirpanel_community.netflix_room_legacy a on a.id=r.legacy_assignment_id':''}
   left join mirpanel_community.community_member_numbers n on n.user_id=${legacy?'coalesce(a.user_id,l.user_id)':'l.user_id'}
   ${managed?'join mirpanel_community.netflix_room_sale_state rs on rs.id=r.id left join mirpanel_community.netflix_room_sellable sv on sv.id=r.id':''}
   left join lateral (
    select jsonb_agg(jsonb_build_object('base',v.base_expires_on,'orderId',v.order_id,
      'paidOn',(coalesce(ro.completed_at,ro.created_at) at time zone 'Asia/Baku')::date,
      'months',case when v.period_unit='months' then v.period_count end,'confirmed',true)
      order by v.base_expires_on,v.order_id) events
    from mirpanel_community.subscription_renewals v join public.payment_orders ro on ro.id=v.order_id
    where v.source_id=${legacy?'coalesce(r.delivery_id,a.id)':'r.delivery_id'} and v.user_id=${legacy?'coalesce(a.user_id,l.user_id)':'l.user_id'}
     and ro.status not in ('cancelled','rejected','expired')
     and (ro.payment_confirmed or ro.status in ('approved','completed'))
   ) renewals on true
   where to_jsonb(r)->>'deleted_at' is null and ($2::uuid is null or (r.group_id,r.room_key,r.id)>($2,$3,$4::uuid))
   order by r.group_id,r.room_key,r.id limit 25`,[target,...(cursor??[null,null,null])]);
  const position=room=>[room.group_id,room.room_key,room.id];
  let sheet;
  for(const room of rows){
   if(room.deferred&&room.failures>0)continue;
   const state=roomSheetState(room);
   const revision=createHash('sha256').update(JSON.stringify([room.room_name,room.account_cipher,room.pin_cipher])).digest('hex');
   const checkpoint=[...state,revision,room.group_id];
   if(room.deferred&&JSON.stringify(room.sent)===JSON.stringify(checkpoint))continue;
   try{
    sheet??=await client.open();
    const account=JSON.parse(security.decryptSecret(room.account_cipher));
    const pin=JSON.parse(security.decryptSecret(room.pin_cipher));
    if(pin.id!==room.id||account.id!==room.group_id||!/^\d{4}$/.test(pin.pin))throw Error('ROOM_SHEET_DATA');
    const [member,end,status]=state;
    if((room.delivery_id||room.legacy_paid_until)&&(!/^\d+$/.test(member)||room.purchase_paid===false))throw Error('ROOM_SHEET_DATA');
    await sheet.upsert([member,room.room_name+' · '+pin.pin,account.email,account.password,end,status,room.id,room.group_id]);
    await c.query(`insert into ${sync}(room_id,target,sent,retry_at) values($1,$2,$3,clock_timestamp()+interval '15 minutes')
     on conflict(room_id) do update set target=excluded.target,sent=excluded.sent,retry_at=excluded.retry_at,failures=0`,
    [room.id,target,JSON.stringify(checkpoint)]);
   }catch(error){
    const reason=/^ROOM_SHEET_(?:DUPLICATE(?:_ID)?|MISSING|OWNER_CONFLICT|IDENTITY_CONFLICT|HEADERS|DATA)$/.test(error.message)?error.message:'ROOM_SHEET_RETRY';
    const delay=Math.min(3600,30*2**Math.min(room.failures,7));
    await c.query(`insert into ${sync} as previous(room_id,target,retry_at,failures,sent)
     values($1,$2,clock_timestamp()+make_interval(secs=>$3),1,jsonb_build_object('error',$5::text))
     on conflict(room_id) do update set sent=jsonb_build_object('error',$5::text),
      target=excluded.target,retry_at=excluded.retry_at,failures=$4`,[room.id,target,delay,room.failures+1,reason]);
    console.warn('NETFLIX_ROOM_SHEET_RETRY');
    await c.query('commit');
    // After an ambiguous append failure, re-read hidden column G before retrying.
    return position(room);
   }
  }
  // Never sort/rewrite the entire sheet in a background sync. Human sorting is
  // resolved by identity on every write; a whole-grid rewrite can erase edits.
  await c.query('commit');
  return rows.length===25?position(rows.at(-1)):null;
 }catch(error){await c.query('rollback');throw error;}
 finally{c.release();}
}
