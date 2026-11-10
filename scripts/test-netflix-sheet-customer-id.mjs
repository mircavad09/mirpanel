import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {saveReadyStock,readyStockView} from '../mirpanel-admin/community/ready-stock.mjs';
import {roomSheetClient,sheetHeaders,sheetTitle,locateCustomerIdCell} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {writeNextSheetCustomerId} from '../mirpanel-admin/community/netflix-sheet-customer-id.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';

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
let rows=[header,row1,row2],reads=0,writes=0,sortDuringRead=false,offline=false;
const client=roomSheetClient('synthetic-spreadsheet-id',account,'owner@example.test',async(url,options)=>{
 if(url.endsWith('/token'))return Response.json({access_token:'synthetic',expires_in:3600});
 if(url.includes('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.test'},{type:'user',role:'writer',emailAddress:account.client_email}]});
 if(url.includes('?fields=properties'))return Response.json({properties:{title:sheetTitle},sheets:[{properties:{sheetId:7,title:'Stock'}}]});
 if(decodeURIComponent(url).includes('!A1:C?valueRenderOption=FORMULA')){
  reads++;
  if(sortDuringRead&&reads===2)rows=[header,row2,row1];
  return Response.json({values:rows.map(r=>r.slice(0,3))});
 }
 if(url.endsWith(':batchUpdate')){
  const {requests}=JSON.parse(options.body);
  assert.equal(requests.length,1);
  const {updateCells:write}=requests[0];
  assert.equal(write.start.sheetId,7);
  assert.equal(write.start.columnIndex,0);
  assert.equal(write.fields,'userEnteredValue');
  assert.equal(write.rows.length,1);
  assert.equal(write.rows[0].values.length,1);
  rows[write.start.rowIndex][0]=write.rows[0].values[0].userEnteredValue.stringValue;
  writes++;
  if(offline){offline=false;return new Response(null,{status:503});}
  return Response.json({});
 }
 throw Error('Unexpected synthetic Google API request');
});

try{
 for(const file of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','subscriptions-migration.sql','netflix-room-renewal.sql','netflix-room-legacy.sql','netflix-room-sale.sql','netflix-sheet-customer-id.sql'])
  await fixture.db.exec(fixture.db.read('mirpanel-admin/community/'+file));
 await fixture.db.exec(fixture.db.read('supabase/migrations/202611090902_product_sale_overrides.sql'));
 const product={id:'netflix',title:'Netflix Şəxsi',stockEnabled:true,plans:[{months:1,label:'1 ay',price:5}]};
 catalog.products.push(product);
 const save=input=>saveReadyStock(pool,security,paymentConfig.tokenSecret,catalog,'admin',input);
 for(const [name,pin] of [['1','4555'],['2','0408']]){
  await save({netflixRooms:{requestId:id(),email,password:'synthetic-only',endsOn:shiftCalendarDays(bakuDate(),30),saleMode:'ready',rooms:[{name,pin}]}});
 }
 const run=()=>writeNextSheetCustomerId(pool,security,client);
 assert.equal(await run(),false);assert.equal(reads,0);assert.equal(writes,0);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',5000)");
 const base={productId:'netflix',planIndex:0,quantity:1};
 const quote=(await shop.quote(buyer,[base],owner)).items[0];
 assert.deepEqual(quote.fields,[]);
 const request={items:[{...base,termsVersion:quote.termsVersion}],requestId:id(),mode:'wallet',consentAccepted:true};
 const [first,replay]=await Promise.all([shop.checkout(buyer,owner,request),shop.checkout(buyer,owner,request)]);
 assert.equal(first.orderId,replay.orderId);assert.equal(first.deliveryStatus,'completed');
 const orders=createAccountOrders({security,store:fixture.store,resolve:async r=>({userId:r.user,codes:d=>ownerCodes(pool,r.user,d)})});
 const [code]=(await orders.codes(buyer)).codes;
 const delivery=await orders.codes(buyer,code.id);
 assert.deepEqual(delivery.netflixRoom,{name:'1',code:'4555'});
 await assert.rejects(orders.codes({user:'b'},code.id),{status:404});
 const member=(await pool.query("select member_number::text from community_member_numbers where user_id='a'")).rows[0].member_number;
 const otherCells=rows.slice(1).map(r=>r.slice(1));
 sortDuringRead=true;offline=true;
 assert.equal(await run(),true);
 assert.equal(row1[0],member);assert.equal(row2[0],'');assert.equal(writes,1);
 const queued=(await readyStockView(pool,catalog,[],security)).netflixRooms.find(r=>r.deliveryId===code.id).sheetCustomerId;
 assert.equal(queued.state,'pending');assert.ok(queued.message);
 await save({netflixSheetIdRetry:{deliveryId:code.id}});
 await run();assert.equal(writes,1);
 assert.deepEqual([row1.slice(1),row2.slice(1)],otherCells);
 const second=await shop.checkout(buyer,owner,{...request,requestId:id()});
 assert.equal(second.deliveryStatus,'completed');
 const secondCode=(await orders.codes(buyer)).codes.find(c=>c.id!==code.id);
 row2[0]='999999';await run();
 const blocked=async()=> (await readyStockView(pool,catalog,[],security)).netflixRooms.find(r=>r.deliveryId===secondCode.id).sheetCustomerId;
 assert.match((await blocked()).message,/başqa dəyər/);assert.equal(writes,1);
 row2[0]='';rows=[header,row2,row1,[...row2]];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.match((await blocked()).message,/birdən çox/);assert.equal(writes,1);
 rows=[header,row1];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.match((await blocked()).message,/tapılmadı/);assert.equal(writes,1);
 rows=[header,row1,row2];
 await save({netflixSheetIdRetry:{deliveryId:secondCode.id}});await run();
 assert.equal(row2[0],member);assert.equal(writes,2);assert.equal((await blocked()).state,'done');
 assert.equal(await run(),false);
 assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries')).rows[0].n,2);
 assert.equal((await pool.query("select cents::int from wallet_accounts where user_id='a'")).rows[0].cents,4000);
 assert.deepEqual(locateCustomerIdCell([header,['=T(1)','2 · 0408',email]],{email,roomName:'2',roomCode:'0408'},member),{reason:'conflict'});
 console.log('PASS: two rooms, wallet delivery without customer PIN, moved rows, leading zero and hyphen PIN, A-only write, lost reply, retry, conflicting/duplicate/missing row and exactly two debits');
}finally{await fixture.close();}
