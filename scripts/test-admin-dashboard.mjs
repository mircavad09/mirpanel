import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {adminDirectory} from '../mirpanel-admin/community/admin-directory.mjs';
import {adminDashboard} from '../mirpanel-admin/community/admin-dashboard.mjs';
import {counts,SITE_PRESENCE_ID} from '../mirpanel-admin/community/public-service.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,method,id}=f;
try{
 await f.db.exec(f.db.read('mirpanel-admin/community/customer-activity-migration.sql'));
 const initial=await adminDashboard(pool);
 assert.deepEqual([initial.active30,initial.orders,initial.pendingOrders,initial.walletCents],[0,0,0,'0']);
 await pool.query(`update "user" set email=id||'@dashboard.example' where id in ('a','b')`);
 const start=await adminDashboard(pool);
 assert.equal(start.users,initial.users+2);
 for(const [session,user] of [['dashboard-1','a'],['dashboard-2','a'],['dashboard-3','b'],['dashboard-4','owner']]){
  await pool.query(`insert into session(id,token,"userId","updatedAt","expiresAt") values($1,$1,$2,clock_timestamp(),clock_timestamp()+interval '1 hour')`,[session,user]);
 }
 for(const [user,session,tab,age] of [['a','dashboard-1',SITE_PRESENCE_ID,'29 minutes 5 seconds'],['a','dashboard-1',id(),'29 minutes 2 seconds'],['a','dashboard-2',SITE_PRESENCE_ID,'29 minutes 2 seconds'],['b','dashboard-3',SITE_PRESENCE_ID,'31 minutes'],['owner','dashboard-4',SITE_PRESENCE_ID,'2 minutes 2 seconds']]){
  await pool.query('insert into community_presence(user_id,session_id,tab_id,last_seen) values($1,$2,$3,clock_timestamp()-$4::interval)',[user,session,tab,age]);
 }
 const recent=()=>adminDirectory(pool,null,{filter:'active30'});
 const active=await recent();
 assert.deepEqual(active.users.map(user=>user.id),['owner','a']);
 assert.deepEqual(active.users.map(user=>Math.floor((Date.parse(active.asOf)-Date.parse(user.lastSeen))/60000)),[2,29]);
 assert.equal(active.total,2);
 assert.equal((await adminDashboard(pool)).active30,active.total);
 assert.equal((await counts(pool)).online,0);
 // The most recent observation remains after one of the duplicate sessions closes.
 await pool.query("delete from session where id='dashboard-2'");
 assert.equal((await recent()).total,2);
 await pool.query("update community_customer_activity set last_seen=statement_timestamp()-interval '30 minutes 1 second' where user_id='a'");
 assert.deepEqual((await recent()).users.map(user=>user.id),['owner']);
 assert.equal((await adminDashboard(pool)).active30,1);
 await pool.query(`insert into "user"(id,name,email,"emailVerified")
  select 'active-'||i,'Active '||i,'active-'||i||'@example.test',true from generate_series(1,24) i`);
 await pool.query(`insert into community_customer_activity(user_id,last_seen)
  select id,statement_timestamp()-interval '3 minutes' from "user" where id like 'active-%'`);
 const first=await recent(),next=await adminDirectory(pool,null,{filter:'active30',page:'2'});
 assert.deepEqual([first.total,first.users.length,first.hasMore,next.total,next.users.length,next.hasMore],[25,20,true,25,5,false]);
 assert.equal(new Set([...first.users,...next.users].map(user=>user.id)).size,25);
 assert.equal((await adminDashboard(pool)).active30,25);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',1101),('b',500)");
 await pool.query("insert into wallet_topups(id,user_id,request_id,requested_cents,method_id,status) values($1,'a',$2,1000,$3,'reviewing')",[id(),id(),method]);
 assert.equal((await adminDashboard(pool)).walletCents,'1601');
 const buyer={user:'a'},hash='a'.repeat(64),items=['ordinary','unlimited'].map(productId=>({productId,planIndex:0,quantity:1}));
 const quoted=await shop.quote(buyer,items,hash);
 const paid=await shop.checkout(buyer,hash,{items:items.map((x,i)=>({...x,termsVersion:quoted.items[i].termsVersion})),mode:'wallet',requestId:id(),consentAccepted:true});
 const order=(await pool.query('select checkout_snapshot,order_code from public.payment_orders where id=$1',[paid.orderId])).rows[0];
 assert.equal(order.checkout_snapshot.items.length,2);
 assert.equal(String(order.order_code),String(paid.orderCode));
 // The order is still preparing, so the existing pending admin filter includes it.
 assert.deepEqual(await adminDashboard(pool),{users:initial.users+2,online:1,active30:25,orders:1,pendingOrders:1,walletCents:'501'});
 console.log('Dashboard: 30-minute activity deduplicated, sorted and paginated; 2 lines counted as one order; pending top-up excluded; 5.01 AZN exact.');
}finally{await f.close();}
