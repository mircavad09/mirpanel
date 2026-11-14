import assert from 'node:assert/strict';
import {protectedRoomUpsert,mergeRoomStatus,sheetHeaders} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {roomDateCell,roomSheetCells} from '../mirpanel-admin/community/netflix-room-sheet-style.mjs';
import {roomSheetState} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';
const row=['1234','4 · 0012','synthetic@example.test','synthetic','2026-12-09','✓ Yenilənib\nÖdənilmiş müddətin sonu: 20 dekabr','room','group'];
for(const date of ['infinity','-infinity','',null,undefined,'2026-02-30','not-a-date',Infinity,-Infinity,NaN]){
 const next=['',...row.slice(1)];next[4]=date;next[5]='✓ Satılıb';
 const result=protectedRoomUpsert([sheetHeaders,row],next);
 assert.equal(result.values[0],'1234');assert.equal(result.values[4],'2026-12-09');assert.equal(result.values[5],row[5]);
 assert.equal(roomDateCell(date),null);
 if(date!==''&&date!=null)assert.throws(()=>roomSheetCells(next),/DATE_INVALID/);
}
const unknown=['',...row.slice(1)];unknown[4]='infinity';
assert.equal(protectedRoomUpsert([sheetHeaders],unknown).values[4],null);
const withWarning=[...row];withWarning[5]+='\nHesabın bitmə tarixi yoxlanılır';
assert(!protectedRoomUpsert([sheetHeaders,withWarning],['',...withWarning.slice(1)]).values[5].includes('yoxlanılır'));
assert.throws(()=>protectedRoomUpsert([sheetHeaders,row],['5678',...row.slice(1)]),/OWNER_CONFLICT/);
const release={roomId:'room',eventId:'12345678-0000-4000-8000-000000000001',previousMember:'1234'};
assert.equal(protectedRoomUpsert([sheetHeaders,row],['5678',...row.slice(1)],{release}).values[0],'5678');
const clear=['',...row.slice(1)];clear[5]='✕ Satılmayıb';
assert.equal(protectedRoomUpsert([sheetHeaders,row],clear,{release}).values[0],'');
assert.equal(protectedRoomUpsert([sheetHeaders,row],clear,{release:{...release,previousMember:'0000'}}).values[0],'1234');
assert.equal(mergeRoomStatus(row[5],'✓ Satılıb'),row[5]);
const legacy={legacy_assignment_id:'link',legacy_paid_until:'2027-01-09',member_number:'1234',group_end:'2026-12-09'};
assert.equal(roomSheetState(legacy)[1],'2026-12-09');assert(roomSheetState(legacy)[2].includes('9 yanvar'));
assert.equal(roomSheetState({delivery_id:'id',purchase_paid:null})[2].split('\n')[0],'Yoxlama tələb olunur');
assert.equal(roomSheetState({group_end:'infinity',stock_end:'-infinity'})[1],null);
console.log('PASS: finite account dates only; unknown dates/IDs preserve cells; explicit release proof; renewal cannot regress; legacy paid expiry stays in status, not account E date');

// Exercise the real Google transport builder with narrow cell writes and a row sort.
const {generateKeyPairSync}=await import('node:crypto');
const {roomSheetClient,sheetTitle}=await import('../mirpanel-admin/community/netflix-room-sheet-client.mjs');
const {roomSheetStyleKey,roomSheetStyleVersion}=await import('../mirpanel-admin/community/netflix-room-sheet-style.mjs');
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const account={client_email:'synthetic@test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const owned=[...row];owned[4]=roomDateCell(row[4]).userEnteredValue.numberValue;
const header=[...sheetHeaders,'Stok otağının ID-si','Netflix hesabının ID-si'];let grid=[header,owned,['','2 · 0408','other@example.test','','','','other','other-group']],reads=0,columns=[];
const client=roomSheetClient('synthetic-spreadsheet-id',account,'owner@example.test',async(url,options)=>{
 if(url.endsWith('/token'))return Response.json({access_token:'synthetic',expires_in:3600});
 if(url.includes('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.test'},{type:'user',role:'writer',emailAddress:account.client_email}]});
 if(url.includes('?fields=properties'))return Response.json({properties:{title:sheetTitle},sheets:[{properties:{sheetId:7,title:'Stock',gridProperties:{columnCount:8}},developerMetadata:[{metadataKey:roomSheetStyleKey,metadataValue:roomSheetStyleVersion}]}]});
 if(decodeURIComponent(url).endsWith('A1:H1'))return Response.json({values:[header]});
 if(new URL(url).searchParams.get('ranges')==="'Stock'!A1:H"){
  if(++reads===2)grid=[header,grid[2],grid[1]];
  return Response.json({sheets:[{properties:{sheetId:7},data:[{rowData:grid.map(r=>({values:r.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v}}))}))}]}]});
 }
 if(url.endsWith(':batchUpdate')){for(const r of JSON.parse(options.body).requests){const op=r.updateCells;if(!op)continue;columns.push(op.start.columnIndex);for(const [i,c]of op.rows[0].values.entries()){assert(!/infinity/.test(JSON.stringify(c)));grid[op.start.rowIndex][op.start.columnIndex+i]=c.userEnteredValue.stringValue??c.userEnteredValue.numberValue;}}return Response.json({});}
 throw Error('Unexpected synthetic request');
});
const sheet=await client.open();const next=['',...row.slice(1)];next[3]='Synthetic-new-password';next[4]='infinity';next[5]='✓ Satılıb';
await sheet.upsert(next);assert(!columns.includes(0));assert(!columns.includes(4));assert.equal(grid[2][0],'1234');assert.equal(grid[2][4],owned[4]);assert.equal(grid[2][5],row[5]);
const writes=columns.length;await sheet.upsert(next);assert.equal(columns.length,writes,'no-op does not rewrite');await sheet.group();assert.equal(columns.length,writes,'automatic full-grid rewrite is disabled');
console.log('PASS: actual API payload omits unknown A/E, preserves renewal detail, follows sorted identity, readback/no-op and no full-grid rewriting');
