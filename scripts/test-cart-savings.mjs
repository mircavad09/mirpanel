import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture();
try{
 const p=f.catalog.products.find(p=>p.id==='ordinary'),plan=p.plans[0];
 plan.regularPrice=9.98;
 const q=await f.shop.quote({},[{productId:p.id,planIndex:0,quantity:3}],'a'.repeat(64));
 assert.equal(q.items[0].oldUnitCents,998);assert.equal(q.items[0].unitCents,500);assert.equal(q.totalCents,1500);
 assert.equal((q.items[0].oldUnitCents-q.items[0].unitCents)*q.items[0].quantity,1494);
 for(const regularPrice of [null,'',undefined,'invalid',-1]){plan.regularPrice=regularPrice;const r=await f.shop.quote({},[{productId:p.id,planIndex:0,quantity:1}],'a'.repeat(64));assert.equal(r.items[0].oldUnitCents,null);assert.equal(r.totalCents,500);}
 assert.equal((await f.pool.query('select count(*)::int n from payment_orders')).rows[0].n,0);
 console.log('PASS server quote exposes display-only former price; total unchanged; 3 units; missing/invalid former price; no orders created');
}finally{await f.close();}
