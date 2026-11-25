import assert from 'node:assert/strict';
import {localEmployeeDatabase} from './employee-local-postgres.mjs';
import {createProductSalesRepository} from '../mirpanel-admin/product-sales-repository.mjs';
const db=await localEmployeeDatabase();
try{
 await db.exec(`create table public.payment_orders(id uuid primary key,product_id text,status text,quantity integer,checkout_snapshot jsonb,payment_confirmed boolean default false,payment_source text,fulfillment_cancellation jsonb);create schema mirpanel_community;create table mirpanel_community.customer_order_deliveries(id uuid primary key,order_id uuid,line_index integer,quantity integer);create table mirpanel_community.community_refunds(order_id uuid primary key,cents bigint);create table mirpanel_community.epoint_purchases(id uuid primary key,order_id uuid,paid_at timestamptz);`);
 await db.exec(db.read('supabase/migrations/202610100001_product_sales.sql'));
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 await db.sql`insert into payment_orders(id,product_id,status,quantity) values(${id(1)},'legacy','approved',2)`;
 for(const f of ['product-sales-delivery.sql','product-sales-baselines.sql','product-sales-paid.sql'])await db.exec(db.read('mirpanel-admin/community/'+f));
 await db.sql`select product_sales_initialize('[{"product_id":"chatgpt","count":99},{"product_id":"capcut","count":9901}]','test')`;
 const snap=async()=>(await db.sql`select product_sales_snapshot() v`)[0].v;
 const count=async p=>(await snap()).real.find(r=>r.product_id===p)?.count||0;
 const add=async(n,p,q=1,paid=true,status='reviewing',items)=>db.sql`insert into payment_orders(id,product_id,status,quantity,payment_confirmed,checkout_snapshot) values(${id(n)},${p},${status},${q},${paid},${items?db.sql.json({cartVersion:2,items}):null})`;
 await add(2,'chatgpt');assert.equal(99+await count('chatgpt'),100);
 await add(103,'chatgpt');await db.sql`update payment_orders set checkout_snapshot='{"epointPayment":{"excessPayment":true}}'::jsonb where id=${id(103)}`;assert.equal(99+await count('chatgpt'),100);
 await add(3,'chatgpt',2);assert.equal(99+await count('chatgpt'),102);
 await add(4,'__cart__',4,true,'reviewing',[{productId:'capcut',quantity:2},{productId:'spotify',quantity:2}]);assert.equal(await count('capcut'),2);assert.equal(await count('spotify'),2);
 for(let n=5;n<10;n++)await add(n,'capcut',1,false,['reviewing','rejected','cancelled','expired','approved'][n-5]);assert.equal(await count('capcut'),2);
 // Every confirmed source uses the same order/line projection, before delivery.
 await Promise.all([10,11,12,13,14].map(n=>add(n,'capcut')));assert.equal(await count('capcut'),7);
 for(const [i,method] of ['wallet','apple-pay','google-pay','birbank','card','m10'].entries()){
 await add(30+i,'methods',2);await db.sql`update payment_orders set payment_source=${method==='wallet'?'wallet':method==='card'?'card':'epoint'},checkout_snapshot=${db.sql.json({epointPayment:{method}})} where id=${id(30+i)}`;
 }assert.equal(await count('methods'),12,'every payment method counts purchased quantity');
 const prior=await snap();await Promise.all(Array.from({length:6},()=>db.sql`update payment_orders set payment_confirmed=true where id=${id(2)}`));assert.equal(await count('chatgpt'),3);
 await db.sql`insert into mirpanel_community.customer_order_deliveries values(${id(100)},${id(3)},0,1)`;assert.equal(await count('chatgpt'),3);
 await db.sql`update mirpanel_community.customer_order_deliveries set id=${id(101)} where order_id=${id(3)}`;assert.equal(await count('chatgpt'),3,'replacement never counts twice');
 const cancel={lines:[{index:0,quantity:1,cents:100}],refundCents:100,refundStatus:'wallet_refunded'};
 await db.sql`update payment_orders set fulfillment_cancellation=${db.sql.json(cancel)} where id=${id(3)}`;assert.equal(await count('chatgpt'),3,'promise of refund is not refund evidence');
 await db.sql`insert into mirpanel_community.community_refunds values(${id(3)},100)`;assert.equal(await count('chatgpt'),2,'only undelivered refunded unit removed');
 await db.sql`update mirpanel_community.community_refunds set cents=100 where order_id=${id(3)}`;assert.equal(await count('chatgpt'),2);
 await db.sql`update payment_orders set fulfillment_cancellation=${db.sql.json({...cancel,lines:[{index:0,quantity:1,cents:100}]})},status='cancelled' where id=${id(2)}`;await db.sql`insert into mirpanel_community.community_refunds values(${id(2)},100)`;assert.equal(await count('chatgpt'),1);
 await add(20,'capcut',1,false);await db.sql`insert into mirpanel_community.epoint_purchases values(${id(20)},${id(20)},now())`;assert.equal(await count('capcut'),8,'signed Epoint payment counts even awaiting stock');
 assert.equal(await count('legacy'),2);assert.equal((await snap()).legacyInferredUnits,2);
 const after=await snap();await db.exec(db.read('mirpanel-admin/community/product-sales-paid.sql'));assert.deepEqual(await snap(),after,'reinstall idempotent');const c=db.connection();assert.deepEqual((await c`select product_sales_snapshot() v`)[0].v,after);await c.end();
 const client={async rpc(name,args={}){return{data:(await db.sql.unsafe('select public.'+name+'() v'))[0].v}}};const repo=createProductSalesRepository(client,{loadCatalog:async()=>({products:[{id:'chatgpt',title:'Changed name'},{id:'capcut',title:'CapCut'},{id:'mirpanel_token',title:'Unrelated display title'}]})});
 assert.equal((await repo.publicProduct('chatgpt')).productTotal,100);await add(21,'chatgpt');assert.equal((await repo.publicProduct('chatgpt')).productTotal,101,'revision invalidates snapshot immediately');
 const beforeRevision=(await db.sql`select product_sales_revision() v`)[0].v;await db.sql`update payment_orders set checkout_snapshot='{"renamedPlan":"X"}' where id=${id(21)}`;assert.notEqual((await db.sql`select product_sales_revision() v`)[0].v,beforeRevision);assert.equal((await repo.publicProduct('chatgpt')).productTotal,101);
 await add(40,'mirpanel-token');await add(41,'mirpanel_token',2);assert.equal((await repo.publicProduct('mirpanel_token')).productTotal,3,'audited stable-ID rename preserves historical purchases');assert.equal((await repo.snapshot()).unknownProductIds.some(p=>p.productId==='mirpanel-token'),false);
 assert.equal((await db.sql`select has_table_privilege('anon','public.product_sales_paid_units','select') v`)[0].v,false);
 console.log('PASS paid units: 99→100→102, cart quantities, unpaid/failed exclusions, parallel confirmations, replay, delivery/replacement, full/partial actual refunds, Epoint before fulfillment, legacy preserved, stable IDs, cache invalidation, restart/reinstall, private access.');
}finally{await db.close()}
