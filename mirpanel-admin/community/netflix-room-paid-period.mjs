import {addCalendarMonthsMinusDay,bakuDate,safeCalendarDate,shiftCalendarDays} from '../payment-order-lifecycle.mjs';
import {subscriptionPeriod} from './subscriptions.mjs';

const months='yanvar fevral mart aprel may iyun iyul avqust sentyabr oktyabr noyabr dekabr'.split(' ');

export function shortRoomDate(date){
 const value=safeCalendarDate(date);
 return value?Number(value.slice(8))+' '+months[Number(value.slice(5,7))-1]:'';
}

// Coverage is reconstructed from immutable purchase snapshots. The account's
// stock expiry is deliberately absent from this calculation.
export function roomPaidPeriod(room){
 if(!room.delivery_id||room.purchase_paid===false||room.user_id===null)return null;
 const plan=room.checkout_snapshot?.items?.[room.line_index]??room.checkout_snapshot;
 const productId=plan?.productId??room.product_id;
 if(productId&&productId!=='netflix')return null;
 const period=subscriptionPeriod({
  durationDays:plan?.durationDays,durationMonths:plan?.durationMonths??room.duration_months,
  label:plan?.planName??room.plan_name
 });
 if(period?.unit!=='months'||![1,3,6].includes(period.count)||!room.delivered_at)return null;
 const startsOn=bakuDate(room.delivered_at);
 let expiresOn=addCalendarMonthsMinusDay(startsOn,period.count);
 let renewed=false;
 const seen=new Set();
 const renewals=[...(room.renewals||[])].sort((a,b)=>
  String(a.base).localeCompare(String(b.base))||String(a.paidOn).localeCompare(String(b.paidOn))||
  String(a.orderId).localeCompare(String(b.orderId)));
 for(const renewal of renewals){
  if(!renewal.confirmed||!renewal.orderId||seen.has(renewal.orderId)||![1,3,6].includes(renewal.months))continue;
  const paidOn=safeCalendarDate(renewal.paidOn);
  if(!paidOn)continue;
  seen.add(renewal.orderId);
  const continuation=shiftCalendarDays(expiresOn,1);
  const nextStart=paidOn>continuation?paidOn:continuation;
  expiresOn=addCalendarMonthsMinusDay(nextStart,renewal.months);
  renewed=true;
 }
 return {startsOn,expiresOn,endsBefore:shiftCalendarDays(expiresOn,1),months:period.count,renewed};
}

export function roomPaymentStatus(room){
 const period=roomPaidPeriod(room);
 if(!period)return room.delivery_id||room.availability==='review'?'Yoxlama tələb olunur':'Satılmayıb';
 const status=room.today>period.expiresOn?'Yenilənməyib':
  period.months>1||period.renewed?'✓ Ödəniş edib':'Yenilənmə gözlənilir';
 return status+'\nÖdənilmiş müddət: '+shortRoomDate(period.startsOn)+' → '+shortRoomDate(period.endsBefore);
}
