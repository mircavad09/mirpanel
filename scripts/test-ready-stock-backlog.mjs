import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {shopFixture} from './shop-test-fixture.mjs';
import {createShop} from '../mirpanel-admin/shop.mjs';
import {signature} from '../mirpanel-admin/employee-security.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {ensureReadyDeliverySettings,saveReadyDeliverySettings} from '../mirpanel-admin/community/ready-stock-availability.mjs';
import {saveReadyStock} from '../mirpanel-admin/community/ready-stock.mjs';
import {createReadyStockQueue} from '../mirpanel-admin/community/ready-stock-queue.mjs';
import {adminDelivery,adminPendingDeliveries,ownerCodes,customerStatus,deliveryRecords} from '../mirpanel-admin/community/order-delivery.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,db,catalog,id,rpc}=f;
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
const security=createPaymentSecurity(config);
const shop=createShop({context:async req=>({pool,user:req.user}),catalog:async()=>catalog,snapshot:()=>rpc('inventory_snapshot'),store:f.store,config});
const queue=createReadyStockQueue(pool,()=>security,{pollMs:70});
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const save=(productId,n,autoWallet=true,index=0)=>saveReadyStock(pool,security,config.tokenSecret,catalog,'synthetic-admin',{
 productId,index,planSignature:signature(catalog.products.find(p=>p.id===productId).plans[index]),requestId:id(),autoWallet,
 messages:Array.from({length:n},(_,i)=>'Sintetik hazır hesab '+id()+'\nSətir '+i)});
const buy=async(productId,quantity=1,who='a')=>{
 const owner=who.repeat(64),request={user:who},items=Array.isArray(productId)?productId:[{productId,quantity,planIndex:0}],quote=await shop.quote(request,items,owner);
 return shop.checkout(request,owner,{mode:'wallet',items:items.map((item,i)=>({...item,termsVersion:quote.items[i].termsVersion})),requestId:id(),consentAccepted:true});
};
const delivered=async order=>(await pool.query('select * from customer_order_deliveries where order_id=$1',[order.orderId])).rows;
const remaining=async productId=>Number((await pool.query('select count(*) n from ready_stock_units where product_id=$1 and delivery_id is null',[productId])).rows[0].n);
try{
 await db.exec(db.read('mirpanel-admin/community/ready-stock-migration.sql'));
 await db.exec(db.read('mirpanel-admin/community/ready-stock-product-messages-migration.sql'));
 for(const p of catalog.products)await rpc('inventory_set_nullable_quantity',[p.id,100,'synthetic-admin',id(),(await rpc('inventory_snapshot')).find(x=>x.productId===p.id)?.version||0,null]);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000),('b',100000)");
 // No ready units: five genuine paid test checkouts remain in the durable queue.
 await save('ordinary',0);
 const five=[];for(let i=0;i<5;i++)five.push(await buy('ordinary'));
 eq((await adminPendingDeliveries(pool,five.map(x=>x.orderId))).length,5);
 await save('ordinary',10);
 const filled=await queue.wake();
 eq([filled.orders,filled.units,filled.completed,await remaining('ordinary')],[5,5,5,5]);
 eq((await adminPendingDeliveries(pool,five.map(x=>x.orderId))).length,0);
 const all=await Promise.all(five.map(delivered));eq(all.map(x=>x.length),[1,1,1,1,1]);
 const firstDelivery=all[0][0];
 eq((await ownerCodes(pool,'b',firstDelivery.id)).length,0);
 eq((await queue.wake()).units,0);
 // Only the two missing units are supplied to a seven-unit paid order.
 const partial=await buy('ordinary',7);eq((await delivered(partial)).length,5);
 await save('ordinary',2);eq((await queue.wake()).units,2);
 eq((await delivered(partial)).length,7);
 eq((await queue.wake()).units,0);
 // Exact package signature, then FIFO under a shortage.
 await save('finite',0);
 const fifo=[];for(let i=0;i<3;i++)fifo.push(await buy('finite'));
 catalog.products.find(p=>p.id==='finite').plans.push({label:'3 aylıq',months:3,price:15});
 await save('finite',2,true,1);eq((await queue.wake()).units,0);
 await save('finite',2);eq((await queue.wake()).units,2);
 eq(await Promise.all(fifo.map(async x=>(await delivered(x)).length)),[1,1,0]);
 await save('finite',1);eq((await queue.wake()).units,1);
 // A newer purchase cannot take ready stock ahead of an older paid order.
 const old=await buy('ordinary');
 await save('ordinary',1);
 const newer=await buy('ordinary',1,'b');
 eq([(await delivered(old)).length,(await delivered(newer)).length],[1,0]);
 // Parallel stock saves, duplicate wakes, a new buyer and manual fulfillment.
 const batch={productId:'ordinary',index:0,planSignature:signature(catalog.products[0].plans[0]),requestId:id(),autoWallet:true,messages:['Parallel synthetic account']};
 const saves=await Promise.all([saveReadyStock(pool,security,config.tokenSecret,catalog,'synthetic-admin',batch),saveReadyStock(pool,security,config.tokenSecret,catalog,'synthetic-admin',batch)]);
 eq(saves.filter(x=>x.replayed).length,1);
 const manual={requestId:id(),line:0,quantity:1,message:'Sintetik əl ilə təhvil'};
 await Promise.allSettled([queue.wake(),queue.wake(),adminDelivery(pool,security,'synthetic-admin',newer.orderId,manual),buy('ordinary')]);
 eq((await delivered(newer)).length,1);
 eq(Number((await pool.query('select count(*) n from ready_stock_units where delivery_id is not null')).rows[0].n),
    Number((await pool.query("select count(*) n from customer_order_deliveries where actor in ('stock:auto','wallet:auto')")).rows[0].n));
 const duplicate=await pool.query('select delivery_id from customer_order_mail where delivery_id is not null group by delivery_id having count(*)>1');
 eq(duplicate.rowCount,0);
 // Temporary encryption failure rolls back just that order; restart retries it.
 await queue.stop();
 let fail=true;
 const retry=createReadyStockQueue(pool,()=>{if(fail)throw Error('SYNTHETIC_TEMPORARY');return security;},{pollMs:70});
 await buy('ordinary',4);
 await save('ordinary',5);
 eq((await retry.wake()).errors>0,true);
 fail=false;retry.start();
 for(let i=0;i<50&&(await adminPendingDeliveries(pool)).length;i++)await new Promise(r=>setTimeout(r,40));
 eq((await adminPendingDeliveries(pool)).length,0);
 await retry.stop();
 await save('ordinary',1);
 const multi=await buy([{productId:'ordinary',quantity:1,planIndex:0},{productId:'unlimited',quantity:2,planIndex:0}]);
 eq((await delivered(multi)).length,1);
 await save('unlimited',2);
 const again=createReadyStockQueue(pool,()=>security);
 eq((await again.wake()).units,2);
 eq((await delivered(multi)).map(x=>x.line_index).sort(),[0,1,1]);
 eq((await again.wake()).units,0);
 await again.stop();
 const disabled=await buy('zero');
 await save('zero',2,false);
 const switchQueue=createReadyStockQueue(pool,()=>security);
 eq((await switchQueue.wake()).units,0);
 eq((await delivered(disabled)).length,0);
 await save('zero',0,true);
 eq((await switchQueue.wake()).units,1);
 eq((await delivered(disabled)).length,1);
 // A historical completed order without new delivery tracking is not reopened.
 const historical=await buy('finite');
 await pool.query("update public.payment_orders set status='approved',payment_source='card',payment_confirmed=false,completed_at=clock_timestamp(),receipt_bucket='synthetic',receipt_path='test.png',receipt_mime='image/png',receipt_size=3,receipt_sha256=$2 where id=$1",[historical.orderId,'a'.repeat(64)]);
 await pool.query('delete from customer_order_mail where order_id=$1',[historical.orderId]);
 await save('finite',1);
 eq((await switchQueue.wake()).units,0);
 eq((await delivered(historical)).length,0);
 await switchQueue.stop();
 // The separate settings button must persist autoWallet and wake only its exact SKU.
 await ensureReadyDeliverySettings(pool);
 await db.exec(db.read('supabase/migrations/202611090911_fulfillment_cancellation.sql'));
 const custom={id:'new_ready_product',title:'Synthetic future product',active:true,plans:[{pricingId:id(),label:'Birinci paket',months:1,price:5},{pricingId:id(),label:'İkinci paket',months:3,price:10}]};
 catalog.products.push(custom);
 await rpc('inventory_set_nullable_quantity',[custom.id,100,'synthetic-admin',id(),0,null]);
 await save(custom.id,3,false,0);await save(custom.id,2,true,1);
 const backlog=[];for(let i=0;i<5;i++)backlog.push(await buy(custom.id));
 const second=await buy([{productId:custom.id,quantity:1,planIndex:1}]);
 // Unpaid/cancelled/completed must never be resurrected.
 const excluded=[];
 for(const status of ['cancelled','rejected','reviewing']){
  const o=await buy(custom.id);excluded.push(o);
  await pool.query("update public.payment_orders set status=$2,payment_confirmed=false,payment_source='card',receipt_bucket='synthetic',receipt_path='test.png',receipt_mime='image/png',receipt_size=3,receipt_sha256=$3 where id=$1",[o.orderId,status,'a'.repeat(64)]);
 }
 const balanceBefore=(await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents;
 const configInput={productId:custom.id,index:0,planSignature:signature(custom.plans[0]),autoWallet:true,allowWaiting:true};
 const saved=await saveReadyDeliverySettings(pool,catalog,'synthetic-admin',configInput);
 eq((await pool.query('select auto_wallet from ready_stock_plans where product_id=$1 and plan_key=$2',[custom.id,saved.scope.planKey])).rows[0].auto_wallet,true);
 const settingsQueue=createReadyStockQueue(pool,()=>security);
 const completed=await settingsQueue.wake(saved.scope);
 eq([completed.completed,completed.waiting,completed.units],[3,2,3]);
 eq(await Promise.all(backlog.map(async o=>(await delivered(o)).length)),[1,1,1,0,0]);
 eq((await delivered(second)).length,1); // Its own purchase was already delivered; no cross-package allocation.
 eq(await Promise.all(excluded.map(async o=>(await delivered(o)).length)),[0,0,0]);
 eq((await settingsQueue.wake(saved.scope)).units,0);
 const otherQueue=createReadyStockQueue(pool,()=>security);
 await save(custom.id,1,true);
 const parallel=await Promise.all([settingsQueue.wake(saved.scope),otherQueue.wake(saved.scope),settingsQueue.wake(saved.scope)]);
 eq(parallel.reduce((n,r)=>n+(r.units||0),0),1);
 eq((await delivered(backlog[3])).length,1);eq((await delivered(backlog[4])).length,0);
 await settingsQueue.stop();await otherQueue.stop();
 // Persisted queue survives a new worker instance; later stock wakes it without a browser.
 const restarted=createReadyStockQueue(pool,()=>security,{pollMs:30});restarted.start();
 await save(custom.id,1,true);
 for(let i=0;i<60&&!(await delivered(backlog[4])).length;i++)await new Promise(r=>setTimeout(r,30));
 eq((await delivered(backlog[4])).length,1);await restarted.stop();
 await saveReadyDeliverySettings(pool,catalog,'synthetic-admin',{...configInput,autoWallet:false});
 const stopOrder=await buy(custom.id);await save(custom.id,1,false);
 const disabledWorker=createReadyStockQueue(pool,()=>security);
 eq((await disabledWorker.wake(saved.scope)).units,0);eq((await delivered(stopOrder)).length,0);
 await disabledWorker.stop();
 // A brand-new Node process has no access to the former worker's memory.
 await saveReadyDeliverySettings(pool,catalog,'synthetic-admin',configInput);
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import pg from './mirpanel-admin/node_modules/pg/lib/index.js';
  import {createReadyStockQueue} from './mirpanel-admin/community/ready-stock-queue.mjs';
  import {createPaymentSecurity} from './mirpanel-admin/payment-security.mjs';
  let raw='';for await(const chunk of process.stdin)raw+=chunk;const x=JSON.parse(raw);
  if(x.connection.host!=='127.0.0.1'||!x.connection.database.startsWith('mirpanel_shop_'))throw Error('LOCAL_ONLY');
  const pool=new pg.Pool({...x.connection,options:'-c search_path=mirpanel_community,public'});
  const worker=createReadyStockQueue(pool,()=>createPaymentSecurity(x.config));
  try{await worker.wake(x.scope);}finally{await worker.stop();await pool.end();}
 `],{stdio:['pipe','ignore','pipe'],windowsHide:true});
 let childError='';child.stderr.on('data',b=>childError+=b);child.stdin.end(JSON.stringify({connection:f.connection,config,scope:saved.scope}));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('WORKER_TIMEOUT'));},15000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(childError));});});
 eq((await delivered(stopOrder)).length,1);
 eq((await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents,String(Number(balanceBefore)-500));
 eq((await pool.query('select delivery_id from ready_stock_units where delivery_id is not null group by delivery_id having count(*)>1')).rowCount,0);
 console.log(JSON.stringify({checks,syntheticOnly:true,fiveWaiting:5,tenUnits:10,completed:5,remaining:5,fifo:true,partial:true,parallel:true,retry:true,ownerDenied:true}));
}finally{await queue.stop();await f.close();}
