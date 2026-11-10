import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {adminDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
import {saveNetflixRooms} from '../mirpanel-admin/community/netflix-room-stock.mjs';
import {roomSheetState,syncRoomSheetBatch} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';
import {locateRoomRow,paidStatus,roomSheetClient,sheetHeaders,sheetTitle} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture();
const {pool,id,shop}=f;
const today=bakuDate(),day=n=>shiftCalendarDays(today,n);
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const secret=crypto.randomBytes(32);
const credentials={email:'room@example.test',password:crypto.randomUUID(),roomName:'1',roomCode:'0408'};
const owner='a'.repeat(64),user={user:'a'},productId='netflix';
const items=[{productId,planIndex:0,quantity:1,details:{name:"1",code_4:"0408"}}];
const sheet=[];
let loseResponse=true;
const client={async open(){return {async upsert(values){
 const row=locateRoomRow(sheet.map(r=>[r[7]]),values[7]);
 if(row===null)sheet.push(values);
 else sheet[row-1]=values;
 if(loseResponse){loseResponse=false;throw Error('RESPONSE_LOST');}
 }};}};
const sync=()=>syncRoomSheetBatch(pool,security,'synthetic-sheet',client);
const safeColumns=row=>[row[0],row[1],...row.slice(4,7)];
async function checkGooglePayload(){
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const account={client_email:'synthetic@test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 let publicLink=true,write;
 const api=roomSheetClient('synthetic-spreadsheet-id',account,async(url,options)=>{
  if(url.includes('/token'))return Response.json({access_token:'synthetic',expires_in:3600});
  if(url.includes('/permissions'))return Response.json({permissions:[{type:'user',role:'owner'},
   {type:'user',role:'writer',emailAddress:account.client_email},...(publicLink?[{type:'anyone',role:'reader'}]:[])]});
  if(url.includes('fields=properties'))return Response.json({properties:{title:sheetTitle},sheets:[{properties:{title:'Otaqlar',sheetId:7}}]});
  if(decodeURIComponent(url).endsWith('A1:H1'))return Response.json({values:[sheetHeaders]});
  if(decodeURIComponent(url).endsWith('H2:H'))return Response.json({values:[['other-room'],['test-room']]});
  if(url.endsWith(':batchUpdate')){write=JSON.parse(options.body).requests[0];return Response.json({});}
  throw Error('UNEXPECTED_SYNTHETIC_REQUEST');
 });
 await assert.rejects(api.open(),/ROOM_SHEET_ACCESS/);
 publicLink=false;
 await (await api.open()).upsert(['','1 · 0408','synthetic@example.test','=1+1','2030-01-01',paidStatus,'1 ay','test-room']);
 assert.equal(write.updateCells.start.rowIndex,2);
 assert.equal(write.updateCells.rows[0].values[3].userEnteredValue.stringValue,'=1+1');
 assert.ok(write.updateCells.rows[0].values[5].userEnteredFormat.textFormat.foregroundColor.green>.5);
}
try{
 await checkGooglePayload();
 for(const migration of ['netflix-room-stock.sql','netflix-room-sheets.sql','ready-stock-migration.sql','subscriptions-migration.sql'])
  await f.db.exec(f.db.read('mirpanel-admin/community/'+migration));
 const batch={requestId:id(),email:credentials.email,password:credentials.password,startsOn:day(-1),endsOn:day(60),
  rooms:[{name:'1',pin:'0408'},{name:'2',pin:'0002'}]};
 await saveNetflixRooms(pool,security,secret,'owner',batch);
 await sync();
 await pool.query("update mirpanel_community.netflix_room_sheet_sync set retry_at='-infinity'");
 await sync();
 assert.equal(sheet.length,2);
 const roomId=sheet.find(row=>row[1]==='1 · 0408')[7];
 const row=()=>sheet.find(row=>row[7]===roomId);
 assert.deepEqual(safeColumns(row()),['','1 · 0408',day(60),'','']);
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
 await deliver(first.orderId,credentials);
 await sync();
 assert.deepEqual(safeColumns(row()),[number,'1 · 0408',day(5),'Yenilənmə gözlənilir','1 ay']);
 assert.equal(sheet.length,2);
 const sub=(await shop.subscriptions(user)).subscriptions[0];
 const draft=await shop.saveDraft(user,owner,{id:id(),productId,planIndex:0,values:items[0].details,termsVersion,renewalId:sub.id,renewalExpiresOn:sub.expiresOn});
 const renewal=await checkout([{...items[0],termsVersion,draftId:draft.draftId,lineId:draft.lineId}]);
 await sync();
 assert.equal(row()[5],paidStatus);
 await deliver(renewal.orderId,{renewalApplied:true});
 await sync();
 assert.equal(row()[5],paidStatus);
 const base={delivery_id:'synthetic',member_number:number,service_expires_on:day(5),delivered_at:new Date(),
  plan_name:'1 ay',duration_months:1,line_index:0,order_quantity:1};
 const future={base:day(5),starts:day(6),end:day(35),months:3};
 assert.deepEqual(roomSheetState({...base,today:day(6),renewals:[future]}),[number,day(35),'Yenilənmə gözlənilir','3 ay']);
 assert.equal(roomSheetState({...base,today:day(5),renewals:[]})[2],'Yenilənmə gözlənilir');
 assert.equal(roomSheetState({...base,today:day(6),renewals:[]})[2],'Yenilənməyib');
 assert.throws(()=>locateRoomRow([[roomId],[roomId]],roomId),/ROOM_SHEET_DUPLICATE_ID/);
 console.log('PASS: stock, delivery, payment, next period, Baku expiry, reordered rows and ambiguous retry');
}finally{await f.close();}
