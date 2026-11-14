// Real isolated PostgreSQL, fixed per-round-trip delay matching measured region RTT.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery as current,ownerCodes,createCustomerOrderMailer} from '../mirpanel-admin/community/order-delivery.mjs';
import {saveNetflixRooms} from '../mirpanel-admin/community/netflix-room-stock.mjs';
import {writeNextSheetCustomerId} from '../mirpanel-admin/community/netflix-sheet-customer-id.mjs';
const before=process.argv.includes('--before'),pause=ms=>new Promise(r=>setTimeout(r,ms));
let delivery=current;
function baselineModule(file){const base=pathToFileURL(path.resolve(file));const src=execFileSync('git',['show','5ca7ef0:'+file],{encoding:'utf8'}).replace(/from '([^']+)'/g,(_,s)=>{
 const url=new URL(s,base),changed=['netflix-room-stock.mjs','netflix-sheet-customer-id.mjs'];
 const target=file.endsWith('/order-delivery.mjs')&&changed.some(n=>s.endsWith('/'+n))?baselineModule('mirpanel-admin/community/'+s.split('/').at(-1)):url.href;
 return 'from '+JSON.stringify(target);
});return 'data:text/javascript;base64,'+Buffer.from(src).toString('base64');}
if(before)delivery=(await import(baselineModule('mirpanel-admin/community/order-delivery.mjs'))).adminDelivery;
process.env.MIRPANEL_CART_V2_TEST='1';
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')}),f=await shopFixture(),roomStockSecret=crypto.randomBytes(32);
let calls=0;const delayed={connect:async()=>{const c=await f.pool.connect();return {query:async(...args)=>{calls++;await pause(146);return c.query(...args);},release:()=>c.release()};}};
const results=[];
try{
 await f.pool.query(await fs.readFile('mirpanel-admin/community/ready-stock-product-messages-migration.sql','utf8'));
 await f.pool.query(await fs.readFile('supabase/migrations/202611090904_topup_emails.sql','utf8'));
 await f.pool.query(await fs.readFile('supabase/migrations/202611090901_api_integrations.sql','utf8'));
 for(const file of ['ready-stock-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','subscriptions-migration.sql','netflix-room-renewal.sql','netflix-room-legacy.sql','netflix-sheet-customer-id.sql'])await f.pool.query(await fs.readFile('mirpanel-admin/community/'+file,'utf8'));
 await f.pool.query(await fs.readFile('supabase/migrations/202611090902_product_sale_overrides.sql','utf8'));
 for(const file of ['netflix-room-sale.sql','netflix-room-form.sql','netflix-sheet-all-deliveries.sql'])await f.pool.query(await fs.readFile('mirpanel-admin/community/'+file,'utf8'));
 const rooms={requestId:f.id(),email:'synthetic@example.test',password:'synthetic-only',endsOn:'2099-02-01',rooms:[{name:'1',pin:'0408'},{name:'2',pin:'1234'}]};
 await saveNetflixRooms(f.pool,security,roomStockSecret,'owner',rooms);
 await f.pool.query("update netflix_room_units set availability='available'");
 for(const productId of ['spotify','capcut','netflix']){
  f.catalog.products.push({id:productId,title:productId,active:true,plans:[{price:5,months:1,label:'Sintetik 1 ay'}]});
  await f.pool.query('insert into ready_stock_product_messages(product_id,message_cipher) values($1,$2)',[productId,security.encryptSecret(JSON.stringify({productId,message:'Sintetik hazır mesaj'}))]);
  await f.pool.query("insert into wallet_accounts(user_id,cents) values('a',20000) on conflict(user_id) do update set cents=20000");
  const items=[{productId:'ordinary',planIndex:0,quantity:2}],q=await f.shop.quote({user:'a'},items,'a'.repeat(64));items[0].termsVersion=q.items[0].termsVersion;
  const order=await f.shop.checkout({user:'a'},'a'.repeat(64),{items,mode:'wallet',requestId:f.id(),consentAccepted:true});
  await f.pool.query("update payment_orders set product_id=$2,checkout_snapshot=jsonb_set(checkout_snapshot,'{items,0,productId}',to_jsonb($2::text)) where id=$1",[order.orderId,productId]);
  const input={requestId:f.id(),line:0,quantity:1,email:'synthetic@example.test',password:'synthetic-only',message:'Sintetik hazır mesaj',...(productId==='netflix'?{roomName:'1',roomCode:'0408'}:{})},timing={};
  let releaseMail,mailStarted;const gate=new Promise(r=>releaseMail=r),started=new Promise(r=>mailStarted=r);
  const worker=createCustomerOrderMailer(f.pool,async()=>{mailStarted();await gate;return {id:'synthetic-mail'};},'https://mirpanel.com');
  const sending=worker.wake();await Promise.race([started,pause(5000).then(()=>{throw Error('Synthetic mail worker did not reach transport');})]);
  calls=0;const at=performance.now();const result=await delivery(delayed,security,'synthetic-admin',order.orderId,input,{productMessage:true,roomStockSecret,onTiming:v=>Object.assign(timing,v)});const ms=Math.round(performance.now()-at);
  // Mail is still blocked outside the transaction when delivery is confirmed.
  assert(ms<4000);releaseMail();await sending;await worker.stop();
  assert.equal(result.status,'preparing');assert.equal(result.lines[0].remaining,1);
  results.push({productId,ms,roundTrips:calls,timing,mailBlockedDuringResponse:true});
  const [a,b]=await Promise.all([delivery(f.pool,security,'synthetic-admin',order.orderId,input,{productMessage:true}),delivery(f.pool,security,'synthetic-admin',order.orderId,input,{productMessage:true})]);assert(a.replayed&&b.replayed);
  let sheetJob,releaseSheet;
  if(productId==='netflix'){
   let sheetStarted;const gate=new Promise(r=>releaseSheet=r),ready=new Promise(r=>sheetStarted=r);
   sheetJob=writeNextSheetCustomerId(f.pool,security,{writeCustomerId:async()=>{sheetStarted();await gate;return {done:true};}});
   await Promise.race([ready,pause(5000).then(()=>{throw Error('Synthetic Sheets job did not reach transport');})]);
  }
  const finalAt=performance.now();
  const final={...input,requestId:f.id(),...(productId==='netflix'?{roomName:'2',roomCode:'1234'}:{})};const same=await Promise.all([delivery(f.pool,security,'synthetic-admin',order.orderId,final,{productMessage:true,roomStockSecret}),delivery(f.pool,security,'synthetic-admin',order.orderId,final,{productMessage:true,roomStockSecret})]);assert.equal(same[0].status,'completed');assert.equal(same[1].status,'completed');
  if(sheetJob){assert(performance.now()-finalAt<1000);releaseSheet();await sheetJob;results.at(-1).sheetBlockedDuringNewDelivery=true;}
  assert.equal((await f.pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[order.orderId])).rows[0].n,2);
  assert.equal((await f.pool.query('select count(*)::int n from customer_order_mail where delivery_id=$1',[input.requestId])).rows[0].n,1);
  assert.equal((await ownerCodes(f.pool,'b',input.requestId)).length,0);
  if(productId==='netflix'){
   assert.equal((await f.pool.query('select count(*)::int n from netflix_sheet_customer_ids')).rows[0].n,2);
   assert((await delivery(f.pool,security,'synthetic-admin',order.orderId,input,{productMessage:true,roomStockSecret})).replayed);
  }
 }
 await fs.mkdir('outputs/admin-delivery-speed',{recursive:true});await fs.writeFile('outputs/admin-delivery-speed/'+(before?'before':'after')+'-server.json',JSON.stringify({results,synthetic:true,productionWrites:0},null,2));console.log(JSON.stringify({results,passed:true,productionWrites:0}));
}finally{await f.close();}
