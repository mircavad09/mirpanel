import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs/promises';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {saveReadyStock} from '../mirpanel-admin/community/ready-stock.mjs';
import {createReadyStockQueue} from '../mirpanel-admin/community/ready-stock-queue.mjs';
import {deliveryRecords,ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {signature} from '../mirpanel-admin/employee-security.mjs';
import {saveProductMessage} from '../mirpanel-admin/community/ready-stock-product-messages.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},security=createPaymentSecurity(config),f=await shopFixture({paymentConfig:config});
const {pool,db,catalog,shop,id,rpc}=f,queue=createReadyStockQueue(pool,()=>security);
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const account=createAccountOrders({security,store:f.store,resolve:async r=>({userId:r.user,catalog:async()=>catalog,page:async()=> (await pool.query('select o.* from payment_orders o join community_order_owners l on l.order_id=o.id where l.user_id=$1 order by o.created_at desc',[r.user])).rows,deliveries:ids=>deliveryRecords(pool,ids),codes:x=>ownerCodes(pool,r.user,x)})});
const listed=async order=>(await account.list({user:'a'})).orders.find(x=>x.id===order.orderId);
const buy=async(items,key=id())=>{const quote=await shop.quote({user:'a'},items,'a'.repeat(64));return shop.checkout({user:'a'},'a'.repeat(64),{mode:'wallet',requestId:key,consentAccepted:true,items:items.map(x=>({...x,termsVersion:quote.items.find(q=>q.productId===x.productId&&q.planIndex===x.planIndex).termsVersion}))});};
const save=(productId,n,index=0)=>saveReadyStock(pool,security,config.tokenSecret,catalog,'synthetic-admin',{productId,index,requestId:id(),planSignature:signature(catalog.products.find(x=>x.id===productId).plans[index]),autoWallet:true,accounts:Array.from({length:n},()=>({email:id()+'@example.test',password:'synthetic-only'}))});
const item=(productId,quantity=1,planIndex=0)=>({productId,quantity,planIndex});
try{
 for(const file of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql','netflix-room-stock.sql','netflix-room-restock.sql','subscriptions-migration.sql','netflix-room-renewal.sql','netflix-room-legacy.sql','netflix-sheet-customer-id.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 await db.exec(db.read('supabase/migrations/202611090902_product_sale_overrides.sql'));
 for(const file of ['netflix-room-sale.sql','netflix-room-form.sql','netflix-sheet-all-deliveries.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 for(const [productId,title] of [['netflix','Netflix Şəxsi'],['prime','Amazon Prime Video'],['capcut','CapCut Pro']]){
  catalog.products.push({id:productId,title,active:true,formFields:[],stockEnabled:true,image:'/synthetic-'+productId+'.svg',plans:[{label:'1 ay',months:1,price:5},{label:'3 ay',months:3,price:14}]});
  await saveProductMessage(pool,security,catalog,{productId,message:'Sintetik '+title+' təlimatı'});
  if(productId!=='netflix')await rpc('inventory_set_nullable_quantity',[productId,100,'synthetic-admin',id(),0,null]);
 }
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000)");
 await saveReadyStock(pool,security,config.tokenSecret,catalog,'admin',{netflixRoomCards:Array.from({length:5},(_,n)=>({requestId:id(),email:'synthetic-netflix@example.test',password:'synthetic-only',name:String(n+1),pin:'0408'}))});
 await save('prime',0);
 const firstItems=[item('netflix'),item('prime')],key=id(),first=await buy(firstItems,key);
 const before=await listed(first);
 eq(before.status,'preparing');eq(before.deliveries.map(x=>x.line),[0]);
 eq(before.fulfillmentStatus,'partial');eq(before.items.map(x=>[x.fulfillmentStatus,x.deliveredQuantity,x.remainingQuantity]),[['completed',1,0],['preparing',0,1]]);
 const delivered=await account.codes({user:'a'},before.deliveries[0].id);eq(delivered.netflixRoom.code,'0408');
 await assert.rejects(account.codes({user:'b'},before.deliveries[0].id),e=>e.status===404);checks++;
 const charge=(await pool.query("select count(*)::int n from wallet_ledger where kind='purchase_debit'")).rows[0].n;
 eq((await buy(firstItems,key)).orderId,first.orderId);
 await save('prime',1);await Promise.all([queue.wake(),queue.wake(),queue.wake()]);
 const completed=await listed(first);eq(completed.status,'completed');eq(completed.items.map(x=>x.remainingQuantity),[0,0]);eq(completed.deliveries.length,2);
 eq((await pool.query("select count(*)::int n from wallet_ledger where kind='purchase_debit'")).rows[0].n,charge);
 eq((await queue.wake()).units,0);
 // Both lines ready at payment; no all-or-nothing stock gate.
 await save('prime',1);const both=await listed(await buy([item('netflix'),item('prime')]));eq(both.status,'completed');eq(both.deliveries.map(x=>x.line).sort(),[0,1]);
 // Three units requested: deliver one now, just two later.
 await save('capcut',1);const multi=await buy([item('netflix'),item('capcut',3)]);
 const partial=await listed(multi);eq(partial.items.filter(x=>x.productId==='capcut').map(x=>[x.deliveredQuantity,x.remainingQuantity]),[[1,2]]);eq(partial.items.find(x=>x.productId==='netflix').remainingQuantity,0);eq(partial.fulfillmentStatus,'partial');
 await save('capcut',2);await Promise.all([queue.wake(),queue.wake()]);eq((await listed(multi)).items.find(x=>x.productId==='capcut').deliveredQuantity,3);
 // A three-month account is never used for a one-month paid line.
 await save('prime',1,1);const wrong=await buy([item('netflix'),item('prime')]);eq((await listed(wrong)).items[1].deliveredQuantity,0);eq((await queue.wake()).units,0);
 await save('prime',1);await queue.wake();eq((await listed(wrong)).status,'completed');
 const duplicates=await pool.query('select delivery_id from ready_stock_units where delivery_id is not null group by delivery_id having count(*)>1');eq(duplicates.rowCount,0);
 await fs.mkdir('outputs/multi-product-orders',{recursive:true});await fs.writeFile('outputs/multi-product-orders/server.json',JSON.stringify({checks,partial:before,bothReady:true,laterStock:true,partialQuantity:true,wrongPackage:true,parallel:true,replayedCheckout:true,productionWrites:0},null,2));
 console.log(JSON.stringify({checks,readyLineIndependent:true,bothReady:true,laterStock:true,partialQuantity:true,wrongPackage:true,parallel:true,replayedCheckout:true,productionWrites:0}));
}finally{await queue.stop();await f.close();}
