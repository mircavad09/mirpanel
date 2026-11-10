import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {adminDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
import {restockNetflixRoom,saveNetflixRooms} from '../mirpanel-admin/community/netflix-room-stock.mjs';
import {roomSheetState,syncRoomSheetBatch} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';
import {examplesTitle,locateRoomRow,paidStatus,roomSheetClient,sheetHeaders,sheetTitle} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const paymentConfig={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig});
const {pool,id,shop}=f;
const today=bakuDate(),day=n=>shiftCalendarDays(today,n);
const security=createPaymentSecurity(paymentConfig);
const secret=crypto.randomBytes(32);
const credentials={email:'room@example.test',password:crypto.randomUUID(),roomName:'1',roomCode:'0408'};
const owner='a'.repeat(64),user={user:'a'},productId='netflix';
const items=[{productId,planIndex:0,quantity:1,details:{name:"1",code_4:"0408"}}];
const sheet=[];
let loseResponse=true;
const client={async open(){return {async upsert(values){
 const row=locateRoomRow(sheet.map(r=>[r[6]]),values[6]);
 if(row===null)sheet.push(values);
 else sheet[row-1]=values;
 if(loseResponse){loseResponse=false;throw Error('RESPONSE_LOST');}
 }};}};
const sync=()=>syncRoomSheetBatch(pool,security,'synthetic-sheet',client);
const safeColumns=row=>[row[0],row[1],...row.slice(4,6)];
async function checkGooglePayload(){
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const account={client_email:'synthetic@test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 let publicLink=true,write,header;
 const batches=[];
 const api=roomSheetClient('synthetic-spreadsheet-id',account,'owner@example.test',async(url,options)=>{
  if(url.includes('/token'))return Response.json({access_token:'synthetic',expires_in:3600});
  if(url.includes('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.test'},
   {type:'user',role:'writer',emailAddress:account.client_email},...(publicLink?[{type:'anyone',role:'reader'}]:[])]});
  if(url.includes('fields=properties'))return Response.json({properties:{title:sheetTitle},sheets:[{properties:{title:examplesTitle,sheetId:8}},{properties:{title:'Otaqlar',sheetId:7}}]});
  if(decodeURIComponent(url).endsWith('A1:F1'))return Response.json({values:[sheetHeaders]});
  if(decodeURIComponent(url).includes('!E2:E?'))return Response.json({values:[[47821],['9 dekabr']]});
  if(decodeURIComponent(url).endsWith('A1:H1'))return Response.json({values:header?[header]:[]});
  if(decodeURIComponent(url).endsWith('A2:H')||url.includes('valueRenderOption=UNFORMATTED_VALUE'))return Response.json({});
  if(decodeURIComponent(url).endsWith('G2:G'))return Response.json({values:[['other-room'],['test-room']]});
  if(url.endsWith(':batchUpdate')){
   const operations=JSON.parse(options.body).requests;
   batches.push(...operations);
   if(operations[0].updateSpreadsheetProperties){header=operations[1].updateCells.rows[0].values.map(v=>v.userEnteredValue.stringValue);}
   if(operations[0].updateCells)write=operations[0];
   return Response.json({});
  }
  throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
 });
 await assert.rejects(api.open(),/ROOM_SHEET_ACCESS/);
 publicLink=false;
 await (await api.open()).upsert(['','1 · 0408','synthetic@example.test','=1+1','2030-01-01',paidStatus,'test-room']);
 assert.deepEqual(header.slice(0,6),sheetHeaders);
 assert.equal(write.updateCells.start.rowIndex,2);
 assert.equal(write.updateCells.rows[0].values[3].userEnteredValue.stringValue,'=1+1');
 assert.equal(write.updateCells.rows[0].values[5].userEnteredValue.stringValue,paidStatus);
 assert.equal(write.updateCells.rows[0].values[4].userEnteredFormat.numberFormat.pattern,'d \"yanvar\"');
 batches.length=0;
 await api.applyLightStyle();
 assert.ok(batches.every(operation=>!operation.setBasicFilter&&!operation.updateBorders&&!operation.clearBasicFilter));
 const stripe=batches.find(operation=>operation.addConditionalFormatRule).addConditionalFormatRule.rule;
 assert.deepEqual(stripe.ranges,[{sheetId:7,startRowIndex:1,endColumnIndex:6}]);
 assert.equal(stripe.booleanRule.condition.values[0].userEnteredValue,'=ISEVEN(ROW())');
 const formats=batches.filter(operation=>operation.updateCells).map(operation=>operation.updateCells);
 assert.equal(formats.length,1);
 assert.equal(formats[0].start.columnIndex,4);
 assert.equal(formats[0].fields,'userEnteredFormat.numberFormat');
 assert.equal(formats[0].rows[0].values[0].userEnteredValue,undefined);

}
try{
 await checkGooglePayload();
 for(const migration of ['netflix-room-stock.sql','netflix-room-sheets.sql','netflix-room-restock.sql','ready-stock-migration.sql','ready-stock-product-messages-migration.sql','subscriptions-migration.sql','netflix-room-renewal.sql'])
  await f.db.exec(f.db.read('mirpanel-admin/community/'+migration));
 const batch={requestId:id(),email:credentials.email,password:credentials.password,startsOn:day(-1),endsOn:day(60),
  rooms:[{name:'1',pin:'0408'},{name:'2',pin:'0002'}]};
 await saveNetflixRooms(pool,security,secret,'owner',batch);
 await sync();
 await pool.query("update mirpanel_community.netflix_room_sheet_sync set retry_at='-infinity'");
 await sync();
 assert.equal(sheet.length,2);
 const roomId=sheet.find(row=>row[1]==='1 · 0408')[6];
 const row=()=>sheet.find(row=>row[6]===roomId);
 assert.deepEqual(safeColumns(row()),['','1 · 0408',day(60),'Sat\u0131lmay\u0131b']);
 assert.deepEqual(sheet.map(row=>row[1]),['1 · 0408','2 · 0002']);
 sheet.reverse();
 f.catalog.products.push({id:productId,title:'Synthetic Netflix',plans:[{label:'1 ay',months:1,price:5}]});
 await pool.query("insert into mirpanel_community.wallet_accounts(user_id,cents) values('a',10000)");
 await pool.query("insert into mirpanel_community.community_member_numbers(user_id,member_number) values('a',9999) on conflict(user_id) do nothing");
 const number=(await pool.query("select member_number::text from mirpanel_community.community_member_numbers where user_id='a'")).rows[0].member_number;
 const termsVersion=(await shop.quote(user,items,owner)).items[0].termsVersion;
 const checkout=rows=>shop.checkout(user,owner,{items:rows,mode:'wallet',requestId:id(),consentAccepted:true});
 const first=await checkout([{...items[0],termsVersion}]);
 await pool.query('update payment_orders set service_expires_on=$2 where id=$1',[first.orderId,day(5)]);
 const deliver=(orderId,data)=>adminDelivery(pool,security,'owner',orderId,{requestId:id(),line:0,quantity:1,message:'Synthetic delivery',...data},{roomStockSecret:secret});
 assert.equal((await pool.query('select count(*)::int n from mirpanel_community.customer_order_deliveries where order_id=$1',[first.orderId])).rows[0].n,1);
 await assert.rejects(deliver(first.orderId,credentials));
 await sync();
 assert.equal(row()[0],number);assert.equal(row()[4],day(60));assert.match(row()[5],/^Yenilənmə gözlənilir\nÖdənilmiş müddət:/);
 assert.equal(sheet.length,2);
 const sub=(await shop.subscriptions(user)).subscriptions[0];
 const draft=await shop.saveDraft(user,owner,{id:id(),productId,planIndex:0,values:items[0].details,termsVersion,renewalId:sub.id,renewalExpiresOn:sub.expiresOn});
 const renewal=await checkout([{...items[0],termsVersion,draftId:draft.draftId,lineId:draft.lineId}]);
 await sync();
 assert.ok(row()[5].startsWith(paidStatus+'\nÖdənilmiş müddət:'));
 await deliver(renewal.orderId,{renewalApplied:true});
 await sync();
 assert.ok(row()[5].startsWith(paidStatus+'\nÖdənilmiş müddət:'));
 const assignment=(await pool.query('select delivery_id from mirpanel_community.netflix_room_units where id=$1',[roomId])).rows[0].delivery_id;
 await assert.rejects(restockNetflixRoom(pool,{id:roomId,deliveryId:assignment,endsOn:day(45),confirmedEmpty:true}),{status:409});
 await pool.query("update customer_order_deliveries set delivered_at=clock_timestamp()-interval '200 days' where id=$1",[assignment]);
 await pool.query("update public.payment_orders set completed_at=clock_timestamp()-interval '100 days' where id=$1",[renewal.orderId]);
 await restockNetflixRoom(pool,{id:roomId,deliveryId:assignment,endsOn:day(45),confirmedEmpty:true});
 await sync();
 assert.deepEqual(safeColumns(row()),['','1 · 0408',day(45),'Sat\u0131lmay\u0131b']);
 assert.equal(sheet.length,2);
 assert.throws(()=>locateRoomRow([[roomId],[roomId]],roomId),/ROOM_SHEET_DUPLICATE_ID/);
 console.log('PASS: automatic wallet stock allocation, confirmed renewal, separate account date, reordered rows, restock and ambiguous retry');
}finally{await f.close();}
