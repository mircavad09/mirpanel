import assert from 'node:assert/strict';import {shopFixture} from './shop-test-fixture.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{shop,pool,method,id,rpc}=f,owner='a'.repeat(64);let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{f.store.rawMethod=async id=>(await pool.query('select * from payment_methods where id=$1',[id])).rows[0];
await pool.query("update payment_methods set daily_limit=1,limit_mode='limited' where id=$1",[method]);
const q=await shop.quote({},[{productId:'ordinary',planIndex:0,quantity:1}],owner),items=q.items.map(x=>({productId:x.productId,planIndex:x.planIndex,quantity:1,termsVersion:x.termsVersion}));
const g=await shop.checkout({},owner,{items,mode:'card',methodId:method,requestId:id(),consentAccepted:true});
await rpc('payment_method_queue_snapshot',[false,false]);
const raw=await f.store.rawMethod(method);eq(raw.active,false); // Last slot is held by THIS checkout.
await assert.rejects(shop.method(method),e=>e.code==='PAYMENT_METHOD_UNAVAILABLE');checks++;
eq((await shop.method(method,{req:{},owner,checkoutId:g.id})).id,method);
await assert.rejects(shop.method(method,{req:{},owner:'b'.repeat(64),checkoutId:g.id}),e=>e.status===404);checks++;
eq((await pool.query("select count(*)::int n from payment_reservations where method_id=$1 and not capacity_shadow and status='reserved'",[method])).rows[0].n,1);
await pool.query('update payment_methods set manual_disabled=true where id=$1',[method]);
await assert.rejects(shop.method(method,{req:{},owner,checkoutId:g.id}),e=>e.code==='PAYMENT_METHOD_UNAVAILABLE');checks++;
await pool.query("update shop_checkouts set expires_at=clock_timestamp()-interval '1 second' where id=$1",[g.id]);
await assert.rejects(shop.method(method,{req:{},owner,checkoutId:g.id}),e=>e.code==='CART_RESERVATION_EXPIRED');checks++;
console.log(JSON.stringify({checks,lastSlotReproduced:true,ownReservationReadable:true,manualDisableRespected:true,productionWrites:0}));}finally{await f.close();}
