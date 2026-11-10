import assert from 'node:assert/strict';
import {roomPaidPeriod,roomPaymentStatus} from '../mirpanel-admin/community/netflix-room-paid-period.mjs';
import {roomSheetExamples} from './netflix-room-sheet-examples.mjs';
import {roomStatusCaption,roomSheetStyleRequests} from '../mirpanel-admin/community/netflix-room-sheet-style.mjs';
const base={delivery_id:'example',line_index:0,delivered_at:'2026-12-01T08:00:00Z',today:'2027-01-15',stock_end:'2026-12-31'};
for(const [months,end] of [[1,'2027-01-01'],[3,'2027-03-01'],[6,'2027-06-01']]){
 const room={...base,checkout_snapshot:{items:[{durationMonths:months}]}};
 assert.equal(roomPaidPeriod(room).endsBefore,end);
 assert.equal(roomPaidPeriod({...room,stock_end:'2040-01-01'}).endsBefore,end);
 assert.equal(roomPaymentStatus(room).split('\n')[0],months===1?'Yenilənməyib':'✓ Ödəniş edib');
}
const initial={...base,checkout_snapshot:{items:[{durationMonths:3}]}};
const renewal={orderId:'renew-1',confirmed:true,paidOn:'2026-12-15',months:3};
assert.equal(roomPaidPeriod({...initial,renewals:[renewal,renewal]}).endsBefore,'2027-06-01');
assert.equal(roomPaidPeriod({...initial,renewals:[{...renewal,confirmed:false}]}).endsBefore,'2027-03-01');
assert.equal(roomPaidPeriod({...initial,renewals:[{...renewal,months:6}]}).endsBefore,'2027-09-01');
assert.equal(roomPaidPeriod({...initial,renewals:[{...renewal,paidOn:'2027-04-01'}]}).endsBefore,'2027-07-01');
assert.equal(roomPaymentStatus({...initial,delivery_id:null}),'Satılmayıb');
assert.equal(roomPaidPeriod({...base,checkout_snapshot:{items:[{durationDays:7,durationMonths:7}]}}),null);
assert.equal(roomStatusCaption(roomPaymentStatus(initial)),'✓ Ödəniş edib\nÖdənilmiş müddət: 1 dekabr → 1 mart');
assert.equal(roomStatusCaption(roomStatusCaption(roomPaymentStatus(initial))),roomStatusCaption(roomPaymentStatus(initial)));
const examples=roomSheetExamples('2026-12-15');
assert.equal(examples.length,6);assert.equal(examples[0].values[5],'Satılmayıb');
assert.ok(examples[2].values[5].includes('1 dekabr → 1 mart'));
assert.ok(examples[3].values[5].includes('1 dekabr → 1 iyun'));
assert.ok(examples[4].values[5].includes('1 dekabr → 1 aprel'));
assert.ok(examples[5].values[5].startsWith('Yenilənməyib'));
assert.ok(roomSheetStyleRequests(7).filter(r=>r.addConditionalFormatRule).every(r=>r.addConditionalFormatRule.rule.booleanRule.condition.type==='TEXT_STARTS_WITH'));
console.log('PASS: 1/3/6 months, early/late renewals, pending/rejected exclusion, duplicate renewal, account date isolation and six synthetic examples');
