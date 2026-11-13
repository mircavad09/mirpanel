import assert from 'node:assert/strict';
import {protectedRoomUpsert,locateCustomerIdCell,sheetHeaders,roomIdentityMatches} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {roomSheetState} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';
import {roomPaidPeriod} from '../mirpanel-admin/community/netflix-room-paid-period.mjs';
const incoming=['','1 · 0408','synthetic@example.test','synthetic-only','2027-01-01','✕ Satılmayıb','room-id','group-id'];
const owned=['900001','1 · 0408','synthetic@example.test','old-synthetic','2027-01-01','✓ Satılıb','room-id','group-id'];
const original=structuredClone(owned);
const rows=[sheetHeaders,owned];
const kept=protectedRoomUpsert(rows,incoming);
assert.equal(kept.values[0],'900001');assert.equal(kept.values[5],'✓ Satılıb');assert.deepEqual(owned,original);
assert.equal(kept.rowIndex,1);
assert.throws(()=>protectedRoomUpsert(rows,['900002',...incoming.slice(1)]),/OWNER_CONFLICT/);
assert.throws(()=>protectedRoomUpsert([sheetHeaders,owned,[...owned]],incoming),/DUPLICATE/);
assert.throws(()=>protectedRoomUpsert([sheetHeaders,[...owned.slice(0,1),'2 · 0408',...owned.slice(2)]],incoming),/IDENTITY_CONFLICT/);
assert.throws(()=>protectedRoomUpsert([sheetHeaders],['900001',...incoming.slice(1)]),/MISSING/);
assert.equal(protectedRoomUpsert([sheetHeaders],incoming).rowIndex,null);
for(const label of ['1 · 0408','1 • 0408','1:0408','1 | 04-08','1 — 0408','1-0408','1 0408','1 · 408',10408]){
 const legacy=['',label,' SYNTHETIC@EXAMPLE.TEST '];
 assert(roomIdentityMatches(legacy,{email:incoming[2],roomName:'1',roomCode:'0408'}));
 assert.deepEqual(locateCustomerIdCell([sheetHeaders,legacy],{email:incoming[2],roomName:'1',roomCode:'0408'},'900001'),{rowIndex:1});
 assert.equal(protectedRoomUpsert([sheetHeaders,legacy],incoming).rowIndex,1);
}
assert(!roomIdentityMatches(['','=1+408',incoming[2]],{email:incoming[2],roomName:'1',roomCode:'0408'}));
assert.equal(protectedRoomUpsert([sheetHeaders,['','2 · 0002',incoming[2]],owned],incoming).rowIndex,2);
for(const durationMonths of [1,3,6]){
 const room={delivery_id:'delivery',purchase_paid:true,user_id:'synthetic',member_number:'900001',line_index:0,
  checkout_snapshot:{items:[{productId:'netflix',durationMonths}]},delivered_at:'2026-12-01T08:00:00Z',stock_end:'2026-12-31'};
 assert.equal(roomPaidPeriod(room).months,durationMonths);
 assert.equal(roomSheetState(room)[2],'✓ Satılıb');
 assert.equal(roomSheetState({...room,renewals:[{confirmed:false,orderId:'pending'}]})[2],'✓ Satılıb');
 assert.equal(roomSheetState({...room,renewals:[{confirmed:true,orderId:'paid'}]})[2],'✓ Yenilənib');
}
assert.equal(roomSheetState({member_number:'900001',legacy_paid_until:'2027-06-01',today:'2026-12-01'})[2],'✓ Satılıb');
console.log('PASS: whole-row writer cannot erase ID/status; conflicts/missing/duplicates block; reordered legacy rows, separators, leading-zero PIN; 1/3/6-month sales and confirmed-only renewals');
