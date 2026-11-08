import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {adminDashboard} from '../mirpanel-admin/community/admin-dashboard.mjs';
import {counts,SITE_PRESENCE_ID} from '../mirpanel-admin/community/public-service.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,method,id}=f;
try{
 const initial=await adminDashboard(pool);
 assert.deepEqual([initial.online,initial.orders,initial.pendingOrders,initial.walletCents],[0,0,0,'0']);
 await pool.query(`update "user" set email=id||'@dashboard.example' where id in ('a','b')`);
 const start=await adminDashboard(pool);
 assert.equal(start.users,initial.users+2);
 for(const [s,u,age] of [['dashboard-1','a','1 hour'],['dashboard-2','a','1 hour'],['dashboard-3','b','1 hour'],['dashboard-4','b','-1 minute']]){
  await pool.query(`insert into session(id,token,"userId","updatedAt","expiresAt") values($1,$1,$2,clock_timestamp(),clock_timestamp()+$3::interval)`,[s,u,age]);
 }
 for(const [u,s,tab,age] of [['a','dashboard-1',SITE_PRESENCE_ID,'4 minutes'],['a','dashboard-1',id(),'3 minutes'],['a','dashboard-2',SITE_PRESENCE_ID,'2 minutes'],['b','dashboard-3',SITE_PRESENCE_ID,'5 minutes 1 second'],['b','dashboard-4',SITE_PRESENCE_ID,'0 seconds']]){
  await pool.query('insert into community_presence(user_id,session_id,tab_id,last_seen) values($1,$2,$3,clock_timestamp()-$4::interval)',[u,s,tab,age]);
 }
 assert.equal((await adminDashboard(pool)).online,1);
 assert.equal((await counts(pool)).online,0);
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
 assert.deepEqual(await adminDashboard(pool),{users:initial.users+2,online:1,orders:1,pendingOrders:1,walletCents:'501'});
 console.log('Dashboard: 5-minute presence deduplicated; 2 lines counted as one order; pending top-up excluded; 5.01 AZN exact.');
}finally{await f.close();}
