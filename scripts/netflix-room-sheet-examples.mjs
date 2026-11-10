import {bakuDate,addCalendarMonthsMinusDay,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {roomPaymentStatus} from '../mirpanel-admin/community/netflix-room-paid-period.mjs';

// Demonstration rows only: never inserted into inventory or customer tables.
export function roomSheetExamples(today=bakuDate()){
 const start=today.slice(0,8)+'01';
 const expiry=addCalendarMonthsMinusDay(start,1);
 const scenarios=[
  {label:'Satılmayıb',months:1,sold:false},
  {label:'Biraylıq — yenilənmə gözlənilir',months:1},
  {label:'Üçaylıq — ödəniş edib',months:3},
  {label:'Altıaylıq — ödəniş edib',months:6},
  {label:'Erkən yenilənib — 1 + 3 ay',months:1,renew:true},
  {label:'Müddəti bitib — yenilənməyib',months:1,expired:true}
 ];
 return scenarios.map((scenario,index)=>{
  const startsOn=scenario.expired?shiftCalendarDays(start,-100):start;
  const room={delivery_id:scenario.sold===false?null:'example-delivery',today,
   delivered_at:startsOn+'T08:00:00Z',checkout_snapshot:{items:[{durationMonths:scenario.months}]},line_index:0,
   renewals:scenario.renew?[{orderId:'example-renewal',confirmed:true,base:expiry,paidOn:start,months:3}]:[]};
  return {label:scenario.label,values:[scenario.sold===false?'':String(900001+index),String(index%5+1)+' · 0408',
   'synthetic.netflix.room.'+(index+1)+'.long.example@example.com','Example-only-password-'+(index+1)+'-not-a-real-account',
   scenario.expired?shiftCalendarDays(start,-1):expiry,roomPaymentStatus(room),
   '00000000-0000-4000-8000-'+String(index+1).padStart(12,'0')]};
 });
}
