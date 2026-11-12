import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
import {ensureReadyStockSales,saveNetflixSales} from '../mirpanel-admin/community/ready-stock-sales.mjs';
import {saveNetflixRoomCards,deleteNetflixRoom} from '../mirpanel-admin/community/netflix-room-stock.mjs';
import {readyStockView,drainReadyStock} from '../mirpanel-admin/community/ready-stock.mjs';
import {adminPendingDeliveries} from '../mirpanel-admin/community/order-delivery.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig:config});
try{
 const {pool,db,catalog,id,shop,rpc}=f;
 for(const file of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','netflix-room-sheets.sql','subscriptions-migration.sql','netflix-room-renewal.sql','netflix-room-legacy.sql']){
  await db.exec(db.read('mirpanel-admin/community/'+file));
 }
 await db.exec(db.read('supabase/migrations/202611090902_product_sale_overrides.sql'));
 await db.exec(db.read('supabase/migrations/202611090904_topup_emails.sql'));
 for(const file of ['netflix-room-sale.sql','netflix-room-form.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 const p={id:'netflix',title:'Netflix Şəxsi',stockEnabled:true,plans:[{label:'1 ay',months:1,price:5},{label:'3 ay',months:3,price:12}]};
 catalog.products.push(p);
 const security=createPaymentSecurity(config);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000),('b',100000)");
 const stock=async()=> (await rpc('inventory_snapshot')).find(row=>row.productId==='netflix');
 const before=await stock();
 await ensureReadyStockSales(pool);
 await db.exec(db.read('mirpanel-admin/community/ready-stock-sales.sql'));
 assert.deepEqual(await stock(),before);
 const write={available:50,requestId:id(),expectedVersion:0};
 await saveNetflixSales(pool,write,'admin');
 await saveNetflixSales(pool,write,'admin');
 assert.equal((await stock()).available,50);
 await assert.rejects(saveNetflixSales(pool,{...write,requestId:id(),available:40},'admin'),{status:409});
 const cards=n=>Array.from({length:n},(_,i)=>({requestId:id(),email:'synthetic-'+id()+'@example.test',password:'Synthetic-only',name:String(i+1),pin:'0408'}));
 const add=rows=>saveNetflixRoomCards(pool,security,config.tokenSecret,'admin',rows);
 await add(cards(2));
 const view=async()=>readyStockView(pool,catalog,[inventoryAvailability(p,await stock())],security);
 const first=(await view()).products.find(row=>row.id==='netflix');
 assert.equal(first.plans[0].sales,50);
 assert.equal(first.plans[0].ready,2);
 const buy=async(quantity=1,mode='wallet',who='a')=>{
  const item={productId:'netflix',planIndex:0,quantity};
  const quote=await shop.quote({user:who},[item],who.repeat(64));
  return shop.checkout({user:who},who.repeat(64),{mode,methodId:mode==='card'?f.method:undefined,items:[{...item,termsVersion:quote.items[0].termsVersion}],consentAccepted:true,requestId:id()});
 };
 const deliveries=async order=>(await pool.query('select id from customer_order_deliveries where order_id=$1',[order.orderId])).rows;
 const old=await buy(3);
 assert.equal((await deliveries(old)).length,2);
 assert.equal((await stock()).available,47);
 assert.deepEqual(await adminPendingDeliveries(pool,[old.orderId]),[old.orderId]);
 const newer=await buy(1);
 assert.equal((await deliveries(newer)).length,0);
 assert.equal((await stock()).available,46);
 await add(cards(1));
 const drain=async()=>{
  const c=await pool.connect();
  try{await c.query('begin');const result=await drainReadyStock(c,()=>security);await c.query('commit');return result;}
  catch(error){await c.query('rollback');throw error;}finally{c.release();}
 };
 assert.equal((await drain()).units,1);
 assert.equal((await deliveries(old)).length,3);
 assert.equal((await deliveries(newer)).length,0);
 assert.equal((await stock()).available,46);
 await add(cards(1));
 await Promise.all([drain(),drain()]);
 assert.equal((await deliveries(newer)).length,1);
 assert.equal((await drain()).units,0);
 // New purchases must not reserve rooms ahead of an older paid order.
 const waiting=await buy();
 await add(cards(1));
 const newest=await buy();
 assert.equal((await deliveries(waiting)).length,1);
 assert.equal((await deliveries(newest)).length,0);
 // Held rooms cannot be deleted or allocated twice.
 await add(cards(2));
 await drain(); // Fulfill the last waiting order, leaving one available room.
 const card=await buy(1,'card');
 const held=(await pool.query('select id from netflix_room_sale_state where held')).rows[0];
 assert.ok(held);
 await assert.rejects(deleteNetflixRoom(pool,'admin',held.id),{status:409});
 assert.equal((await drain()).units,0);
 await shop.cancel({user:'a'},'a'.repeat(64),card.id);
 assert.equal((await pool.query('select count(*)::int n from netflix_room_sellable')).rows[0].n,1);
 const current=await stock();
 await saveNetflixSales(pool,{available:1,requestId:id(),expectedVersion:current.version},'admin');
 const race=await Promise.allSettled([buy(1,'wallet','a'),buy(1,'wallet','b')]);
 assert.equal(race.filter(row=>row.status==='fulfilled').length,1);
 assert.equal((await stock()).available,0);
 assert.equal((await pool.query('select count(*)::int n from netflix_room_units where delivery_id is not null')).rows[0].n,7);
 console.log(JSON.stringify({syntheticOnly:true,independentSales:50,readyRooms:2,fifo:true,partial:true,heldDeleteBlocked:true,parallelLastUnit:true,retry:true,existingStockPreserved:true}));
}finally{await f.close();}
