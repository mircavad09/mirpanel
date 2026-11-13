import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createShop} from '../mirpanel-admin/shop.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {signature} from '../mirpanel-admin/employee-security.mjs';
import {saveReadyStock,readyStockView} from '../mirpanel-admin/community/ready-stock.mjs';
import {saveProductMessage} from '../mirpanel-admin/community/ready-stock-product-messages.mjs';
import {ensureReadyStockManagement,manageReadyAccount,readyAccountList} from '../mirpanel-admin/community/ready-stock-management.mjs';
import {withLegacyHistory} from '../mirpanel-admin/community/netflix-room-legacy.mjs';
import {ownerCodes,deliveryRecords} from '../mirpanel-admin/community/order-delivery.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {customerSubscriptions} from '../mirpanel-admin/community/subscriptions.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,db,catalog,id,rpc}=f;
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},security=createPaymentSecurity(config);
const call=x=>manageReadyAccount(pool,security,catalog,'synthetic:owner',x),date=days=>shiftCalendarDays(bakuDate(),days);
try{
 for(const name of ['ready-stock-migration.sql','ready-stock-product-messages-migration.sql','subscriptions-migration.sql'])await db.exec(db.read('mirpanel-admin/community/'+name));
 await ensureReadyStockManagement(pool);await ensureReadyStockManagement(pool);
 const privateTables=(await pool.query("select bool_and(relrowsecurity) ok from pg_class where oid in ('mirpanel_community.ready_stock_management'::regclass,'mirpanel_community.ready_stock_account_revisions'::regclass)")).rows[0].ok;assert.equal(privateTables,true);
 for(const role of ['anon','authenticated'])assert.equal((await pool.query("select has_table_privilege($1,'mirpanel_community.ready_stock_management','SELECT') present",[role])).rows[0].present,false);
 const capcut=catalog.products[0],spotify=catalog.products[1];capcut.title='CapCut Pro';capcut.plans[0]={label:'7 günlük',days:7,price:5};spotify.title='Spotify Premium';
 for(const p of [capcut,spotify]){
  await saveProductMessage(pool,security,catalog,{productId:p.id,message:'Sintetik məhsul qaydası\nİkinci sətir'});
  await rpc('inventory_set_nullable_quantity',[p.id,50,'synthetic-admin',id(),(await rpc('inventory_snapshot')).find(x=>x.productId===p.id)?.version||0,null]);
  await saveReadyStock(pool,security,config.tokenSecret,catalog,'synthetic-admin',{productId:p.id,index:0,planSignature:signature(p.plans[0]),requestId:id(),autoWallet:true,accounts:Array.from({length:p===capcut?5:1},(_,i)=>({email:p.id+i+'@example.test',password:'Synthetic-'+i}))});
 }
 const view=()=>readyStockView(pool,catalog,[],security),units=()=>readyAccountList(pool,security,catalog);
 let rows=(await units()).filter(r=>r.productId===capcut.id);assert.equal(rows.length,5);
 const first=rows[0],open=await call({action:'open',id:first.id});assert.ok(open.password.startsWith('Synthetic-'));
 await call({action:'edit',id:first.id,revision:open.revision,email:'updated@example.test',password:'Synthetic-edited',message:'Əlavə sintetik məlumat'});
 assert.equal((await call({action:'open',id:first.id})).password,'Synthetic-edited');
 await assert.rejects(call({action:'edit',id:first.id,revision:0,email:'old@example.test',password:'wrong'}),{status:409});
 await pool.query("update ready_stock_units set created_at=clock_timestamp()-interval '4 days' where id=$1",[rows[1].id]);
 await call({action:'delete',id:rows[1].id,revision:0});await call({action:'delete',id:rows[1].id,revision:0});
 assert.equal((await units()).filter(r=>r.productId===capcut.id).length,4);
 assert.equal((await view()).products.find(p=>p.id===capcut.id).readyTotal,4);
 const before=await pool.query('select count(*)::int orders from public.payment_orders');
 const bind={action:'bind',id:first.id,revision:1,userId:'a',paidUntil:date(3),planSignature:first.planSignature};
 await call(bind);assert.equal((await call(bind)).replayed,true);await assert.rejects(call({...bind,userId:'b'}),{status:409});
 assert.equal((await pool.query('select count(*)::int orders from public.payment_orders')).rows[0].orders,before.rows[0].orders);
 assert.equal((await pool.query('select count(*)::int n from wallet_ledger')).rows[0].n,0);
 const linked=(await units()).find(r=>r.id===first.id);assert.equal(linked.status,'sold');assert.equal(linked.customer.name,'Reader A');assert.ok(linked.customer.assignedAt);
 const api=user=>createAccountOrders({security,store:f.store,resolve:async()=>withLegacyHistory(pool,user,{userId:user,catalog:async()=>catalog,page:async()=>[],owned:async()=>null,byCode:async()=>null,deliveries:ids=>deliveryRecords(pool,ids),codes:id=>ownerCodes(pool,user,id)})});
 const list=await api('a').list(null),order=list.orders[0];assert.equal(order.status,'completed');assert.equal(order.amount,null);
 const delivered=await api('a').codes(null,order.id);assert.equal(delivered.email,'updated@example.test');assert.equal(delivered.password,'Synthetic-edited');assert.ok(delivered.text.includes('Əlavə sintetik məlumat'));
 await assert.rejects(api('b').codes(null,order.id),{status:404});
 const subs=(await customerSubscriptions(pool,'a',async()=>catalog,async()=>[])).subscriptions;assert.equal(subs.find(s=>s.id===order.id).expiresOn,date(3));
 await assert.rejects(call({action:'delete',id:first.id,revision:2}),{status:409});
 await call({action:'edit',id:first.id,revision:2,email:'new@example.test',password:'Synthetic-current',message:'Yenilənmiş hesab qeydi'});
 assert.equal((await api('a').codes(null,order.id)).password,'Synthetic-current');
 assert.equal((await pool.query('select count(*)::int n from ready_stock_account_revisions where unit_id=$1',[first.id])).rows[0].n,2);
 assert.equal((await customerSubscriptions(pool,'a',async()=>catalog,async()=>[])).subscriptions.find(s=>s.id===order.id).expiresOn,date(3));
 const contested=rows[2];const parallel=await Promise.allSettled(['a','b'].map(userId=>call({action:'bind',id:contested.id,revision:0,userId,paidUntil:date(12),planSignature:contested.planSignature})));assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);
 const shop=createShop({context:async req=>({pool,user:req.user}),catalog:async()=>catalog,snapshot:()=>rpc('inventory_snapshot'),store:f.store,config});
 const request=async(product,who='a',mode='wallet')=>{const items=[{productId:product.id,quantity:1,planIndex:0}],hash=who.repeat(64),q=await shop.quote({user:who},items,hash);return shop.checkout({user:who},hash,{mode,...(mode==='card'?{methodId:f.method}:{}),items:items.map((x,i)=>({...x,termsVersion:q.items[i].termsVersion})),requestId:id(),consentAccepted:true});};
 // Exact-SKU reservation prevents an admin from taking a unit out of its ready pool.
 const reserved=await request(capcut,'a','card'),free=(await units()).find(r=>r.productId===capcut.id&&r.status==='ready');
 assert.equal((await call({action:'open',id:free.id})).reserved,true);
 await assert.rejects(call({action:'delete',id:free.id,revision:free.revision}),{status:409});
 await assert.rejects(call({action:'bind',id:free.id,revision:free.revision,userId:'a',paidUntil:date(5),planSignature:free.planSignature}),{status:409});
 await shop.cancel({user:'a'},'a'.repeat(64),reserved.id);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000),('b',100000)");
 // One ready Spotify account, two real synthetic wallet checkouts. Only one delivery.
 const bought=await Promise.all([request(spotify,'a'),request(spotify,'b')]);
 const d=(await pool.query('select * from customer_order_deliveries where order_id=any($1::uuid[])',[bought.map(x=>x.orderId)])).rows;assert.equal(d.length,1);
 const sold=(await units()).find(r=>r.productId===spotify.id);assert.equal(sold.status,'sold');assert.ok(sold.customer.id);
 await assert.rejects(call({action:'delete',id:sold.id,revision:0}),{status:409});
 // A bind racing a confirmed purchase shares checkout's transaction lock.
 const beforeCapcut=(await units()).filter(r=>r.productId===capcut.id&&r.status==='ready');
 for(const extra of beforeCapcut.slice(1))await call({action:'delete',id:extra.id,revision:extra.revision});
 const raceUnit=beforeCapcut[0];
 const raced=await Promise.allSettled([call({action:'bind',id:raceUnit.id,revision:raceUnit.revision,userId:'b',paidUntil:date(9),planSignature:raceUnit.planSignature}),request(capcut,'a')]);
 const unitState=(await pool.query('select u.delivery_id,m.assignment_id from ready_stock_units u left join ready_stock_management m on m.unit_id=u.id where u.id=$1',[raceUnit.id])).rows[0];
 assert.equal(Number(!!unitState.delivery_id)+Number(!!unitState.assignment_id),1);
 assert.ok(raced.some(x=>x.status==='fulfilled'));
 // Ready-count changes never consume the separately configured sales limit.
 const inv=await rpc('inventory_snapshot');assert.equal(inv.find(p=>p.productId===capcut.id).available,raced[1].status==='fulfilled'?49:50);assert.equal(inv.find(p=>p.productId===spotify.id).available,48);
 const logs=(await pool.query("select metadata from public.payment_audit_log where action like 'ready.account_%'")).rows;
 assert.ok(logs.length>=4);assert.ok(!JSON.stringify(logs).includes('Synthetic-edited'));assert.ok(!JSON.stringify(logs).includes('updated@example.test'));
 // Package recreation is deliberately not matched to old private stock.
 capcut.plans[0]={label:'Yeni 7 gün',days:7,price:9};await assert.rejects(call({action:'bind',id:free.id,revision:free.revision,userId:'a',paidUntil:date(4),planSignature:free.planSignature}),{status:409});
 console.log(JSON.stringify({edit:true,delete:true,bindWithoutCharge:true,historyAndCodes:true,subscriptionDate:true,ownerIsolation:true,reservedBlocked:true,parallelBindSingle:true,twoPurchasesOneDelivery:true,salesLimitSeparate:true,auditNoSecrets:true,packageIdentityProtected:true,syntheticOnly:true}));
}finally{await f.close();}
