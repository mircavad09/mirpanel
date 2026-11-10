import {roomPaidPeriod} from './netflix-room-paid-period.mjs';
import {legacyInstalled} from './netflix-room-legacy.mjs';
import {roomSalesInstalled} from './netflix-room-sale.mjs';
export async function roomStates(db,{groupId=null,roomId=null,deliveryId=null,lock=false}={}){
 const legacy=await legacyInstalled(db);
 const managed=await roomSalesInstalled(db);
 const {rows}=await db.query(`select r.*,r.stock_ends_on::text stock_end,g.account_cipher,g.ends_on::text group_end,
  ${legacy?'a.paid_until::text legacy_paid_until,a.created_at bound_at,':''}
  ${managed?'s.unexpired,s.synthetic,s.held,s.assigned,(v.id is not null) sellable,':''}
  d.line_index,d.delivered_at,d.message_cipher,o.product_id,o.checkout_snapshot,o.duration_months,o.plan_name,
  ${legacy?'coalesce(a.user_id,l.user_id)':'l.user_id'} user_id,n.member_number::text,customer.name customer_name,public.payment_baku_date()::text today,
  (o.status not in ('cancelled','rejected','expired') and
   (o.payment_confirmed or o.status in ('approved','completed'))) purchase_paid,
  coalesce((select jsonb_agg(jsonb_build_object('base',v.base_expires_on,'orderId',v.order_id,
   'paidOn',(coalesce(ro.completed_at,ro.created_at) at time zone 'Asia/Baku')::date,
   'months',case when v.period_unit='months' then v.period_count end,'confirmed',true)
   order by v.base_expires_on,v.order_id)
   from mirpanel_community.subscription_renewals v join public.payment_orders ro on ro.id=v.order_id
   where v.source_id=r.delivery_id and v.user_id=l.user_id and ro.status not in ('cancelled','rejected','expired')
    and (ro.payment_confirmed or ro.status in ('approved','completed'))),'[]') renewals
  from mirpanel_community.netflix_room_units r join mirpanel_community.netflix_room_groups g on g.id=r.group_id
  left join mirpanel_community.customer_order_deliveries d on d.id=r.delivery_id
  left join public.payment_orders o on o.id=d.order_id
  left join mirpanel_community.community_order_owners l on l.order_id=o.id
  ${legacy?'left join mirpanel_community.netflix_room_legacy a on a.id=r.legacy_assignment_id':''}
  left join mirpanel_community.community_member_numbers n on n.user_id=${legacy?'coalesce(a.user_id,l.user_id)':'l.user_id'}
  left join mirpanel_community."user" customer on customer.id=${legacy?'coalesce(a.user_id,l.user_id)':'l.user_id'}
  ${managed?'join mirpanel_community.netflix_room_sale_state s on s.id=r.id left join mirpanel_community.netflix_room_sellable v on v.id=r.id':''}
  where ($1::uuid is null or r.group_id=$1) and ($2::uuid is null or r.id=$2)
   and ($3::uuid is null or r.delivery_id=$3)
  order by r.group_id,r.room_key,r.id ${lock?'for update of r':''}`,[groupId,roomId,deliveryId]);
 return rows.map(room=>{
  const period=room.legacy_paid_until?{expiresOn:room.legacy_paid_until}:room.purchase_paid&&room.user_id?roomPaidPeriod(room):null;
  const active=!!period&&room.today<=period.expiresOn;
  if(room.legacy_paid_until)return {...room,period,active,state:active?'paid':'expired'};
  if(managed&&!room.assigned){
   const state=room.synthetic?'synthetic':room.held?'reserved':!room.unexpired?'expired':room.sellable?'free':'review';
   return {...room,period,active,state};
  }
  const review=room.delivery_id?!period:room.availability==='review';
  const state=review?'review':!room.delivery_id?'free':!active?'expired':period.months>1||period.renewed?'paid':'sold';
  return {...room,period,active,state};
 });
}
export const roomStateLabels={review:'Yoxlama tələb olunur',free:'Satılmayıb',reserved:'Rezerv edilib',synthetic:'Sınaq — satışdan kənar',sold:'Satılıb / yenilənmə gözlənilir',paid:'Ödəniş edib, ödənilmiş müddəti davam edir',expired:'Müddəti bitib, yenilənməyib'};
