import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {saveNetflixRooms} from '../mirpanel-admin/community/netflix-room-stock.mjs';
import {assignLegacyRoom,withLegacyHistory,legacyRoomSource} from '../mirpanel-admin/community/netflix-room-legacy.mjs';
import {saveProductMessage} from '../mirpanel-admin/community/ready-stock-product-messages.mjs';
import {customerSubscriptions} from '../mirpanel-admin/community/subscriptions.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {syncRoomSheetBatch} from '../mirpanel-admin/community/netflix-room-sheet-sync.mjs';
import {locateRoomRow} from '../mirpanel-admin/community/netflix-room-sheet-client.mjs';
import {updateRoomPassword} from '../mirpanel-admin/community/netflix-room-password.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture();
try{
 const {pool,db,id}=f;
 for(const file of ['ready-stock-product-messages-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','netflix-room-sheets.sql','subscriptions-migration.sql','netflix-room-renewal.sql','netflix-room-legacy.sql','netflix-room-legacy.sql']){
  await db.exec(db.read('mirpanel-admin/community/'+file));
 }
 const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
 const secret=crypto.randomBytes(32),date=days=>shiftCalendarDays(bakuDate(),days);
 const catalog={products:[{id:'netflix',title:'Netflix Şəxsi',plans:[]}]};
 await saveProductMessage(pool,security,catalog,{productId:'netflix',message:'Sintetik hazır mesaj'});
 await saveNetflixRooms(pool,security,secret,'synthetic:owner',{
  requestId:id(),email:'netflix@example.test',password:'synthetic-original',endsOn:date(20),
  rooms:[1,2,3,4].map(n=>({name:String(n),pin:'0408'}))
 });
 const rooms=(await pool.query('select id from mirpanel_community.netflix_room_units order by room_name')).rows;
 const call=input=>assignLegacyRoom(pool,security,catalog,input);
 const person=(await call({action:'search',q:'Reader A'})).users[0];
 assert.equal(person.id,'a');
 for(const q of ['a@example.test','#'+person.memberNumber])assert.equal((await call({action:'search',q})).users[0].id,'a');
 const bind=(index,userId='a',paidUntil=date(31))=>call({action:'confirm',id:rooms[index].id,userId,paidUntil});
 assert.deepEqual(await call({action:'open',id:rooms[0].id}),{email:'netflix@example.test',room:'1',pin:'0408'});
 const results=await Promise.all([bind(0),bind(0)]);
 assert.equal(results.filter(r=>r.replayed).length,1);
 assert.equal(results[0].orderCode,results[1].orderCode);
 await assert.rejects(bind(0,'b'),{status:409});
 const parallel=await Promise.allSettled([bind(1,'a',date(93)),bind(1,'b',date(93))]);
 assert.equal(parallel.filter(x=>x.status==='fulfilled').length,1);
 await bind(2,'a',date(153));await bind(3,'a',date(184));
 const orderAPI=user=>createAccountOrders({security,store:f.store,resolve:async()=>withLegacyHistory(pool,user,{
  userId:user,catalog:async()=>catalog,page:async()=>[],owned:async()=>null,byCode:async()=>null,deliveries:async()=>[],codes:async()=>[]
 })});
 const a=orderAPI('a'),b=orderAPI('b'),code=results[0].orderCode;
 const entry=(await a.list(null,null,code)).orders.find(o=>o.orderCode===code);
 assert.equal(entry.status,'completed');assert.equal(entry.amount,null);assert.ok(entry.plan.includes(legacyRoomSource));
 assert.deepEqual(await a.codes(null,entry.id),{text:'Sintetik hazır mesaj',email:'netflix@example.test',password:'synthetic-original',netflixRoom:{name:'1',code:'0408'}});
 assert.ok((await a.guide(null,entry.id,0)).tracks.phone.length);
 await assert.rejects(b.codes(null,entry.id),{status:404});await assert.rejects(b.guide(null,entry.id,0),{status:404});
 assert.ok(!(await b.list(null,null,code)).orders.some(o=>o.id===entry.id));
 const subscriptions=(await customerSubscriptions(pool,'a',async()=>catalog,async()=>[])).subscriptions;
 assert.equal(subscriptions.find(x=>x.id===entry.id).expiresOn,date(31));
 assert.equal(subscriptions.find(x=>x.id===entry.id).days,31);
 assert.ok(subscriptions.some(x=>x.expiresOn===date(153))&&subscriptions.some(x=>x.expiresOn===date(184)));
 const group=(await pool.query('select id from mirpanel_community.netflix_room_groups')).rows[0];
 const preview=await updateRoomPassword(pool,security,'owner',{groupId:group.id,action:'preview'});
 assert.equal(preview.activeRooms,4);
 await updateRoomPassword(pool,security,'owner',{groupId:group.id,action:'rotate',password:'synthetic-rotated',expectedRevision:preview.revision});
 assert.equal((await a.codes(null,entry.id)).password,'synthetic-rotated');
 const sheet=[['0'],['existing-room','','','','','',rooms[0].id]];
 const client={async open(){return {async upsert(values){
  const row=locateRoomRow(sheet.map(r=>[r[6]]),values[6]);
  if(row===null)sheet.push(values);else sheet[row-1]=values;
 }};}};
 await syncRoomSheetBatch(pool,security,'synthetic-target',client);
 assert.equal(sheet[1][6],rooms[0].id);assert.equal(sheet[1][0],String(person.memberNumber));assert.equal(sheet[1][4],date(31));
 assert.match(sheet[1][5],/Ödənilib: .*adək/);assert.equal(sheet[1][3],'synthetic-rotated');
 assert.equal((await pool.query('select count(*)::int n from public.payment_orders')).rows[0].n,0);
 assert.equal((await pool.query('select count(*)::int n from mirpanel_community.customer_order_mail')).rows[0].n,0);
 const audit=(await pool.query("select details from mirpanel_community.community_audit where action='netflix-room-legacy-bind'")).rows;
 assert.equal(audit.length,4);assert.doesNotMatch(JSON.stringify(audit),/0408|synthetic-rotated|netflix@example/);
 console.log('PASS: search, stable binding, replay/race, owner-only order/code/guide, paid dates, password rotation, Sheets row update, no order/mail');
}finally{await f.close();}
