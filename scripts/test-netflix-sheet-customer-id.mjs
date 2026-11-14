import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {saveReadyStock,readyStockView,approveCardWithReadyStock} from '../mirpanel-admin/community/ready-stock.mjs';
import {roomSheetClient,sheetHeaders,sheetTitle,locateCustomerIdCell} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {writeNextSheetCustomerId,reconcileSheetDeliveryQueue,retrySheetCustomerId} from '../mirpanel-admin/community/netflix-sheet-customer-id.mjs';
import {sheetReason,sheetIssue} from '../mirpanel-admin/community/netflix-sheet-errors.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {adminDelivery,ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';

const paymentConfig={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
process.env.MIRPANEL_CART_V2_TEST='1';
const fixture=await shopFixture({paymentConfig});
const {pool,shop,catalog,id}=fixture,security=createPaymentSecurity(paymentConfig);
const buyer={user:'a'},owner='a'.repeat(64),email='same@example.test';
const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const account={client_email:'test@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const header=[...sheetHeaders];
const row1=['','1 · 45-55',email,'test-secret','date','status'];
const row2=['','2 · 0408',email,'test-secret','date','status'];
const numberFormatted=new Map([[row1,{userEnteredValue:{numberValue:123456},formattedValue:'1 4555'}],[row2,{userEnteredValue:{numberValue:654321},formattedValue:'2 0408'}]]);
let rows=[header,row1,row2],reads=0,writes=0,sortDuringRead=false,offline=false;
const client=roomSheetClient('synthetic-spreadsheet-id',account,'owner@example.test',async(url,options)=>{
 if(url.endsWith('/token'))return Response.json({access_token:'synthetic',expires_in:3600});
 if(url.includes('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.test'},{type:'user',role:'writer',emailAddress:account.client_email}]});
 if(url.includes('?fields=properties'))return Response.json({properties:{title:sheetTitle},sheets:[{properties:{sheetId:7,title:'Stock'}}]});
 if(new URL(url).searchParams.get('ranges')==="'Stock'!A1:F"){
  reads++;
  if(sortDuringRead&&reads===2)rows=[header,row2,row1];
  return Response.json({sheets:[{properties:{sheetId:7},data:[{rowData:rows.map(r=>({values:r.slice(0,6).map((value,col)=>
   col===1&&numberFormatted.has(r)?numberFormatted.get(r):
   value.startsWith('=')?{userEnteredValue:{formulaValue:value},formattedValue:''}:
   value?{userEnteredValue:{stringValue:value},formattedValue:value}:{}
  )}))}]}]});
 }
 if(url.endsWith(':batchUpdate')){
  const {requests}=JSON.parse(options.body);
  assert.equal(requests.length,2);
  const {updateCells:write}=requests[0];
  assert.equal(write.start.sheetId,7);
  assert.equal(write.start.columnIndex,0);
  assert.equal(write.fields,'userEnteredValue');
  assert.equal(write.rows.length,1);
  assert.equal(write.rows[0].values.length,1);
  rows[write.start.rowIndex][0]=write.rows[0].values[0].userEnteredValue.stringValue;
  const status=requests[1].updateCells;assert.equal(status.start.columnIndex,5);assert.equal(status.start.rowIndex,write.start.rowIndex);
  rows[status.start.rowIndex][5]=status.rows[0].values[0].userEnteredValue.stringValue;
  writes++;
  if(offline){offline=false;return new Response(null,{status:503});}
  return Response.json({});
 }
 throw Error('Unexpected synthetic Google API request');
});

try{
 for(const file of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','subscriptions-migration.sql','netflix-room-renewal.sql','netflix-room-legacy.sql','netflix-sheet-customer-id.sql'])
  await fixture.db.exec(fixture.db.read('mirpanel-admin/community/'+file));
 await fixture.db.exec(fixture.db.read('supabase/migrations/202611090902_product_sale_overrides.sql'));
 for(const file of ['netflix-room-sale.sql','netflix-room-form.sql','netflix-sheet-all-deliveries.sql'])await fixture.db.exec(fixture.db.read('mirpanel-admin/community/'+file));
 const product={id:'netflix',title:'Netflix Şəxsi',stockEnabled:true,plans:[{months:1,label:'1 ay',price:5}]};
 catalog.products.push(product);
 const save=input=>saveReadyStock(pool,security,paymentConfig.tokenSecret,catalog,'admin',input);
 const cards=[['1','4555'],['2','0408']].map(([name,pin])=>({
  requestId:'00000000-0000-4000-8000-00000000000'+name,email,password:'synthetic-only',name,pin
 }));
 const stock=async()=>await readyStockView(pool,catalog,[],security);
 const inventory=async()=> (await fixture.rpc('inventory_snapshot')).find(x=>x.productId==='netflix').available;
 assert.equal((await save({netflixRoomCards:cards})).added,2);
 assert.equal((await save({netflixRoomCards:cards})).replayed,true);
 assert.equal(await inventory(),2);
 let saved=(await stock()).netflixRooms;
 assert.equal(saved.length,2);assert.ok(saved.every(r=>r.endsOn===null&&r.canDelete));
 await assert.rejects(save({netflixRoomCards:[{...cards[0],requestId:id(),name:'3'},{...cards[1],requestId:id()}]}),{status:409});
 assert.equal(await inventory(),2);
 const removed=saved.find(r=>r.name==='2');
 await save({netflixRoomDelete:{id:removed.id}});
 await save({netflixRoomDelete:{id:removed.id}});
 assert.equal(await inventory(),1);
 assert.ok(!(await stock()).netflixRooms.some(r=>r.id===removed.id));
 await save({netflixRoomCards:[{...cards[1],requestId:'00000000-0000-4000-8000-000000000003'}]});
 assert.equal(await inventory(),2);
 await save({netflixRooms:{requestId:id(),email:'legacy-form@example.test',password:'synthetic-only',endsOn:shiftCalendarDays(bakuDate(),30),
  saleMode:'ready',rooms:Array.from({length:5},(_,i)=>({name:String(i+1),pin:'0408'}))}});
 assert.equal(await inventory(),7);
 const legacy=(await stock()).netflixRooms.filter(r=>r.accountEmail==='legacy-form@example.test');
 assert.equal(legacy.length,5);
 for(const [i,room] of legacy.entries()){
  assert.ok(room.canDelete);await save({netflixRoomDelete:{id:room.id}});assert.equal(await inventory(),6-i);
 }
 const run=()=>writeNextSheetCustomerId(pool,security,client);
 assert.equal(await run(),false);assert.equal(reads,0);assert.equal(writes,0);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',5000)");
 const base={productId:'netflix',planIndex:0,quantity:1};
 const quote=(await shop.quote(buyer,[base],owner)).items[0];
 assert.deepEqual(quote.fields,[]);
 const request={items:[{...base,termsVersion:quote.termsVersion}],requestId:id(),mode:'wallet',consentAccepted:true};
 const held=await shop.checkout(buyer,owner,{...request,requestId:id(),mode:'card',methodId:fixture.method});
 const reserved=(await stock()).netflixRooms.find(r=>r.status==='reserved');
 assert.ok(reserved);assert.equal(reserved.canDelete,false);
 await assert.rejects(save({netflixRoomDelete:{id:reserved.id}}),{status:409,message:/rezervdə/});
 assert.equal(await inventory(),1);
 await shop.cancel(buyer,owner,held.id);assert.equal(await inventory(),2);
 const [first,replay]=await Promise.all([shop.checkout(buyer,owner,request),shop.checkout(buyer,owner,request)]);
 assert.equal(first.orderId,replay.orderId);assert.equal(first.deliveryStatus,'completed');
 const orders=createAccountOrders({security,store:fixture.store,resolve:async r=>({userId:r.user,codes:d=>ownerCodes(pool,r.user,d)})});
 const [code]=(await orders.codes(buyer)).codes;
 const delivery=await orders.codes(buyer,code.id);
 assert.deepEqual(delivery.netflixRoom,{name:'1',code:'4555'});
 await assert.rejects(orders.codes({user:'b'},code.id),{status:404});
 const sold=(await stock()).netflixRooms.find(r=>r.deliveryId===code.id);
 assert.equal(sold.canDelete,false);
 await assert.rejects(save({netflixRoomDelete:{id:sold.id}}),{status:409,message:/təhvil verilmiş/});
 const member=(await pool.query("select member_number::text from community_member_numbers where user_id='a'")).rows[0].member_number;
 const otherCells=rows.slice(1).map(r=>r.slice(1,5));
 sortDuringRead=true;offline=true;
 assert.equal(await run(),true);
 assert.equal(row1[0],member);assert.equal(row2[0],'');assert.equal(writes,1);
 const queued=(await readyStockView(pool,catalog,[],security)).netflixRooms.find(r=>r.deliveryId===code.id).sheetCustomerId;
 assert.equal(queued.state,'pending');assert.ok(queued.message);
 // Advance the scheduled time, then let the worker retry without admin action.
 assert.equal(await run(),false);
 await pool.query('update netflix_sheet_customer_ids set next_at=now() where delivery_id=$1',[code.id]);
 await run();assert.equal(writes,1);
 assert.deepEqual([row1.slice(1,5),row2.slice(1,5)],otherCells);
 assert.equal(row1[5],'✓ Satılıb');
 const second=await shop.checkout(buyer,owner,{...request,requestId:id()});
 assert.equal(second.deliveryStatus,'completed');
 const secondCode=(await orders.codes(buyer)).codes.find(c=>c.id!==code.id);
 row2[0]='999999';await run();
 const blocked=async()=> (await readyStockView(pool,catalog,[],security)).netflixRooms.find(r=>r.deliveryId===secondCode.id).sheetCustomerId;
 assert.match((await blocked()).message,/başqa dəyər/);assert.equal(writes,1);
 row2[0]='';rows=[header,row2,row1,[...row2]];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.match((await blocked()).message,/birdən çox/);assert.equal(writes,1);
 row2[0]='=IF(TRUE,"","")';rows=[header,row2,row1];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.match((await blocked()).message,/başqa dəyər/);assert.equal(writes,1);
 row2[0]='';
 rows=[header,row1];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.match((await blocked()).message,/tapılmadı/);assert.equal(writes,1);
 rows=[header,row1,row2];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.equal(row2[0],member);assert.equal(writes,2);assert.equal(await blocked(),undefined);
 assert.equal(await run(),false);
 assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries')).rows[0].n,2);
 assert.equal((await pool.query("select cents::int from wallet_accounts where user_id='a'")).rows[0].cents,4000);
 assert.deepEqual(locateCustomerIdCell([header,['=T(1)','2 · 0408',email]],{email,roomName:'2',roomCode:'0408'},member),{reason:'conflict'});
 const newRows=Array.from({length:5},(_,i)=>['','New '+(i+1)+' · 0408',email,'untouched','date','status']);
 rows.push(...newRows);
 const extraCards=newRows.slice(0,4).map((_,i)=>({requestId:id(),email,password:'synthetic-only',name:'New '+(i+1),pin:'0408'}));
 await save({netflixRoomCards:extraCards});
 const multi=await shop.checkout(buyer,owner,{...request,requestId:id(),items:[{...request.items[0],quantity:2}]});
 assert.equal(multi.deliveryStatus,'completed');
 const jobs=async orderId=>(await pool.query(`select j.delivery_id,j.room_id,j.state from netflix_sheet_customer_ids j
  join customer_order_deliveries d on d.id=j.delivery_id where d.order_id=$1`,[orderId])).rows;
 assert.equal((await jobs(multi.orderId)).length,2);
 await run();await run();assert.equal(newRows.filter(r=>r[0]===member).length,2);
 const card=await shop.checkout(buyer,owner,{...request,requestId:id(),mode:'card',methodId:fixture.method});
 const receipt={path:'cart/'+card.id+'/synthetic.png',mimeType:'image/png',size:3,sha256:crypto.createHash('sha256').update('abc').digest('hex')};
 fixture.files.set(receipt.path,Buffer.from('abc'));
 await shop.savedReceipt(buyer,owner,'cart',card.id,receipt);
 const cardOrder=await shop.submit(buyer,owner,card.id);
 await approveCardWithReadyStock(pool,security,cardOrder.orderId,null,'admin',false);
 assert.equal((await jobs(cardOrder.orderId)).length,1);
 await run();assert.equal(newRows.filter(r=>r[0]===member).length,3);

 // A historical paid order outside room reservation still follows manual delivery.
 const oldItem={productId:'ordinary',planIndex:0,quantity:2};
 const oldQuote=(await shop.quote(buyer,[oldItem],owner)).items[0];
 const manual=await shop.checkout(buyer,owner,{...request,requestId:id(),items:[{...oldItem,termsVersion:oldQuote.termsVersion}]});
 const {checkout_snapshot:snapshot}=(await pool.query('select checkout_snapshot from payment_orders where id=$1',[manual.orderId])).rows[0];
 snapshot.items[0].productId='netflix';
 await pool.query('update payment_orders set checkout_snapshot=$2 where id=$1',[manual.orderId,snapshot]);
 const unused=(await stock()).netflixRooms.find(r=>r.status==='free');
 assert.ok(unused);
 const send=(requestId,roomName)=>adminDelivery(pool,security,'admin',manual.orderId,{
  requestId,line:0,quantity:1,message:'Synthetic delivery',email,password:'synthetic-only',roomName,roomCode:'0408'
 },{roomStockSecret:paymentConfig.tokenSecret});
 const boundId=id(),unboundId=id();
 await send(boundId,unused.name);
 assert.equal((await send(boundId,unused.name)).replayed,true);
 await send(unboundId,'New 5');
 assert.equal((await jobs(manual.orderId)).length,2);
 assert.ok((await jobs(manual.orderId)).some(r=>r.delivery_id===boundId&&r.room_id===unused.id));
 assert.ok((await jobs(manual.orderId)).some(r=>r.delivery_id===unboundId&&r.room_id===null));
 newRows[4][0]='999999';
 await run();await run();
 assert.equal(newRows.filter(r=>r[0]===member).length,4);
 const manualState=(await stock()).netflixSheetManual.find(r=>r.deliveryId===unboundId);
 assert.match(manualState.message,/başqa dəyər/);
 newRows[4][0]='';
 await save({netflixSheetIdRetry:{deliveryId:unboundId}});
 await run();assert.equal(newRows.filter(r=>r[0]===member).length,5);
 assert.equal(await run(),false);
 assert.equal(writes,7);
 // Previously successful writes are verified again, not trusted forever.
 row1[0]='';row1[5]='✕ Satılmayıb';
 await pool.query('update netflix_sheet_customer_ids set next_at=now() where delivery_id=$1',[code.id]);
 await run();assert.equal(row1[0],member);assert.equal(row1[5],'✓ Satılıb');
 await pool.query('delete from netflix_sheet_customer_ids where delivery_id=$1',[unboundId]);
 assert.equal(await reconcileSheetDeliveryQueue(pool),1);
 assert.equal(await reconcileSheetDeliveryQueue(pool),0);
 await run();
 assert.equal((await pool.query('select state from netflix_sheet_customer_ids where delivery_id=$1',[unboundId])).rows[0].state,'done');
 // Failed writes retain their exact safe category; retries never add a second job or erase attempt history.
 for(const [reason,expected] of [['connection','pending'],['quota','pending'],['timeout','pending'],['verify','pending'],['permission','blocked'],['auth','blocked']]){
  await pool.query("update netflix_sheet_customer_ids set state='pending',next_at=now() where delivery_id=$1",[unboundId]);
  await writeNextSheetCustomerId(pool,security,{writeCustomerId:async()=>{throw Object.assign(Error('ROOM_SHEET_REQUEST'),{sheetReason:reason});}});
  const state=(await pool.query('select state,reason,attempts from netflix_sheet_customer_ids where delivery_id=$1',[unboundId])).rows[0];assert.equal(state.state,expected);assert.equal(state.reason,reason);assert(sheetIssue(reason,expected).message);assert.equal(sheetIssue(reason,expected).needsReview,expected==='blocked');
  await Promise.all([retrySheetCustomerId(pool,unboundId),retrySheetCustomerId(pool,unboundId)]);
  assert.equal((await pool.query('select attempts from netflix_sheet_customer_ids where delivery_id=$1',[unboundId])).rows[0].attempts,state.attempts);
  assert.equal((await pool.query('select count(*)::int n from netflix_sheet_customer_ids where delivery_id=$1',[unboundId])).rows[0].n,1);
  await run();assert.equal((await pool.query('select state from netflix_sheet_customer_ids where delivery_id=$1',[unboundId])).rows[0].state,'done');
 }
 // A completed job cannot starve a newly queued write.
 await retrySheetCustomerId(pool,unboundId).catch(()=>{});
 await pool.query("update netflix_sheet_customer_ids set state='pending',next_at=now() where delivery_id=$1",[unboundId]);
 await pool.query("update netflix_sheet_customer_ids set next_at=now()-interval '1 hour' where delivery_id=$1",[code.id]);
 let selected;await writeNextSheetCustomerId(pool,security,{writeCustomerId:async snapshot=>{selected=snapshot.id;return {done:true};}});assert.equal(selected,unboundId);
 await run();
 assert.equal((await stock()).netflixSheetQueue.length,0);
 assert.equal(sheetReason(new DOMException('Timed out','TimeoutError')),'timeout');
 console.log('PASS: automatic/manual/card delivery, atomic A+status-only write, numeric/formatted PIN, moved rows, lost reply/retry, missing/conflict/duplicate protection, done-job recheck and historical queue backfill without duplicate delivery');
}finally{await fixture.close();}
