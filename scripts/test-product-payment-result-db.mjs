import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {recordDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';
import crypto from 'node:crypto';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,id,catalog}=f;
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
try{
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',50000)");
 const items=[{productId:'ordinary',planIndex:0,quantity:2},{productId:'unlimited',planIndex:0,quantity:1}],hash='a'.repeat(64);
 const q=await shop.quote({user:'a'},items,hash),g=await shop.checkout({user:'a'},hash,{mode:'wallet',requestId:id(),consentAccepted:true,items:items.map(x=>({...x,termsVersion:q.items.find(y=>y.productId===x.productId).termsVersion}))});
 const read=()=>shop.get({user:'a'},hash,g.id),initial=await read();assert.equal(initial.paymentConfirmed,true);assert.equal(initial.deliverySummary.total,3);assert.equal(initial.deliverySummary.ready,false);assert.equal(initial.paidCents,1600);
 await assert.rejects(shop.get({user:'b'},hash,g.id),{status:404});await assert.rejects(shop.get({user:'a'},'b'.repeat(64),g.id),{status:404});
 const before=(await pool.query("select (select count(*) from payment_orders)::int orders,(select count(*) from wallet_ledger)::int ledger,(select cents from wallet_accounts where user_id='a')::text balance")).rows[0];
 const d=id();await recordDelivery(pool,security,'synthetic',g.orderId,d,0,1,'Synthetic delivery',{email:'demo@example.test',password:'SYNTHETIC'});
 const partial=await read();assert.equal(partial.deliverySummary.ready,false);assert.equal(partial.deliverySummary.delivered,1);assert.equal(partial.deliveryStatus,'partial');
 await recordDelivery(pool,security,'synthetic',g.orderId,id(),0,1,'Synthetic second');await recordDelivery(pool,security,'synthetic',g.orderId,id(),1,1,'Synthetic third');
 const ready=await read();assert.equal(ready.deliverySummary.ready,true);assert.equal(ready.deliverySummary.delivered,3);assert.equal(ready.deliverySummary.deliveryIds.length,3);
 // Display saved order amounts, never the checkout total or supplier cost.
 await pool.query('update shop_checkouts set total_cents=99999 where id=$1',[g.id]);assert.equal((await read()).paidCents,1600);
 const own=user=>createAccountOrders({security,store:{},resolve:async()=>({userId:user,codes:x=>ownerCodes(pool,user,x),catalog:async()=>catalog})});assert.equal((await own('a').codes({},d)).email,'demo@example.test');await assert.rejects(own('b').codes({},d),{status:404});
 for(let n=0;n<4;n++)await read();
 const after=(await pool.query("select (select count(*) from payment_orders)::int orders,(select count(*) from wallet_ledger)::int ledger,(select cents from wallet_accounts where user_id='a')::text balance")).rows[0];assert.deepEqual(after,before);
 await pool.query("update payment_orders set status='rejected' where id=$1",[g.orderId]);const rejected=await read();assert.equal(rejected.paymentConfirmed,false);assert.equal(rejected.deliverySummary.ready,false);assert.equal(rejected.paidCents,null);
 console.log('PASS isolated PostgreSQL: actual order amount, exact delivery quantities, partial/full readiness, no stock inference, checkout + credentials ownership, repeated reads create no orders/debits/deliveries; rejected cannot be success.');
}finally{await f.close();}
