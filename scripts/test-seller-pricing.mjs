import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchAppSource,extractAdminState} from '../mirpanel-admin/core.mjs';
import {userPriceSignature} from '../mirpanel-admin/community/user-price-key.mjs';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {catalogPlans,saveUserControls,userControls} from '../mirpanel-admin/community/user-controls.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,catalog,id}=f,owner='a'.repeat(64),actor={id:'owner'};
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const set=(user,kind,data)=>saveUserControls(pool,actor,{userId:user,kind,...data},catalog);
const prices=async user=>(await shop.prices({user})).prices[0].cents;
const item={productId:'ordinary',planIndex:0,quantity:1};
const quote=user=>shop.quote({user},[item],owner);
try{
 await pool.query('insert into "user"(id,name,email,"emailVerified") values(\'c\',\'Ordinary\',\'c@example.test\',true)');
 const identities=async()=>(await pool.query("select to_jsonb(u) identity from \"user\" u where id in ('a','b') order by id")).rows;const beforeIdentities=await identities();
 const plan=catalogPlans(catalog)[0];
 for(const [user,amount] of [['a','3.00'],['b','3.50']]){
  await set(user,'seller',{enabled:true});await set(user,'price',{productId:plan.productId,planKey:plan.planKey,amount});
 }
 for(const [user,cents]of [['a',300],['b',350],['c',500]]){const row=(await pool.query('select reserve_user_price_v1($1,$2,$3,$4,$5,$6,5,$7,$8,null,10,false) value',[user,f.method,plan.productId,'0',plan.planKey,plan.signature,id(),id()])).rows[0].value;eq(Math.round(Number(row.amount)*100),cents,'legacy reservation path');}
 eq(await Promise.all(['a','b','c',null].map(prices)),[300,350,500,500],'private prices');
 eq(await Promise.all(['a','b','c',null].map(async u=>(await quote(u)).totalCents)),[300,350,500,500],'server quote');
 // A full cart is re-priced for the current account, never for its creator.
 const full=[{...item,quantity:2,unitCents:1,price:0,amount:0}];
 eq((await shop.quote({user:'b'},full,owner)).totalCents,700,'cart/tampering');
 eq((await shop.quote({user:'c'},full,owner)).totalCents,1000);
 const version=(await quote('a')).items[0].termsVersion;
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',10000),('b',10000),('c',10000)");
 const checkout=(user,extra={})=>shop.checkout({user},owner,{mode:'wallet',requestId:id(),consentAccepted:true,items:[{...item,termsVersion:version,price:0,unitCents:1}],...extra});
 await assert.rejects(checkout('a',{expectedTotalCents:1}),e=>e.status===409);checks++;
 const order=await checkout('a');eq(order.totalCents,300);
 eq((await checkout('b')).totalCents,350);eq((await checkout('c')).totalCents,500);
 eq(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),9700,'server debit');
 await set('a','price',{productId:plan.productId,planKey:plan.planKey,amount:'2.75'});
 eq(Number((await pool.query('select amount from payment_orders where id=$1',[order.orderId])).rows[0].amount),3,'order snapshot');
 // Base-price and stock edits keep the same package override.
 catalog.products[0].plans[0].price=8;catalog.products[0].plans[0].stock=7;
 eq(await prices('a'),275);eq(await prices('c'),800);
 await f.rpc('inventory_set_nullable_quantity',['ordinary',0,'synthetic-admin',id(),0,null]);
 eq((await quote('a')).items[0].available,0);eq(await prices('a'),275,'empty stock keeps the override');
 await assert.rejects(checkout('a'));checks++;
 const stock=(await f.rpc('inventory_snapshot')).find(p=>p.productId==='ordinary');
 await f.rpc('inventory_set_nullable_quantity',['ordinary',null,'synthetic-admin',id(),stock.version,null]);
 await set('a','seller',{enabled:false});eq(await prices('a'),800);eq((await userControls(pool,null,'a',catalog)).plans[0].special,'275');
 await set('a','seller',{enabled:true});eq(await prices('a'),275);
 // Identical labels at the same array index are a different newly created package.
 const original=catalog.products[0].plans[0];catalog.products[0].plans[0]={...original,pricingId:id()};
 eq(await prices('a'),800);catalog.products[0].plans[0]=original;
 // Migration keeps existing special-price accounts enabled, and does not re-enable revoked sellers.
 await pool.query("delete from user_seller_settings where user_id='b'");
 await f.db.exec(f.db.read('mirpanel-admin/community/seller-pricing-migration.sql'));
 eq(await prices('b'),350);await set('b','seller',{enabled:false});
 await f.db.exec(f.db.read('mirpanel-admin/community/seller-pricing-migration.sql'));eq(await prices('b'),800);
 await set('b','seller',{enabled:true});
 // Renewal list and a real renewal checkout use the same personal price.
 for(const file of ['ready-stock-migration.sql','subscriptions-migration.sql'])await f.db.exec(f.db.read('mirpanel-admin/community/'+file));
 const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
 await pool.query('update payment_orders set service_expires_on=$2 where id=$1',[order.orderId,shiftCalendarDays(bakuDate(),6)]);
 await adminDelivery(pool,security,'synthetic-admin',order.orderId,{requestId:id(),line:0,quantity:1,message:'Synthetic only'});
 const subscription=(await shop.subscriptions({user:'a'})).subscriptions[0];eq(subscription.options[0].cents,275);
 const nextVersion=(await quote('a')).items[0].termsVersion;
 const draft=await shop.saveDraft({user:'a'},owner,{id:id(),productId:item.productId,planIndex:0,values:{},termsVersion:nextVersion,renewalId:subscription.id,renewalExpiresOn:subscription.expiresOn});
 const renewal=await checkout('a',{items:[{...item,termsVersion:nextVersion,draftId:draft.draftId,lineId:draft.lineId}]});eq(renewal.totalCents,275);
 await assert.rejects(shop.get({user:'b'},owner,order.id),e=>e.status===404);checks++;
 const audits=(await pool.query("select actor_id,target_id,details from community_audit where action in ('user-price','user-seller')")).rows;
 eq(audits.every(r=>r.actor_id==='owner'&&r.target_id&&'before' in r.details&&'after' in r.details),true,'audit');
 eq(await identities(),beforeIdentities,'seller never alters account privileges');
 const source=fs.readFileSync('app.js','utf8'),base=extractAdminState(source),sample={id:'seller_test_product',title:'Synthetic',category:'all',plans:[{label:'1 month',months:1,price:5}]};
 const payload={...base,products:[...base.products,sample]},created=patchAppSource(source,payload),createdPlan=extractAdminState(created).products.at(-1).plans[0];assert.ok(createdPlan.pricingId);checks++;
 const changed=extractAdminState(created);changed.products.at(-1).plans[0].price=7;changed.products.at(-1).stock=9;
 eq(extractAdminState(patchAppSource(created,changed)).products.at(-1).plans[0].pricingId,createdPlan.pricingId,'base edit keeps identity');
 const deleted=patchAppSource(created,base),recreated=extractAdminState(patchAppSource(deleted,payload)).products.at(-1).plans[0];assert.notEqual(userPriceSignature(recreated),userPriceSignature(createdPlan));checks++;
 console.log(JSON.stringify({checks,failures:0,prices:[300,350,500],serverTamperingBlocked:true,orderSnapshot:true,renewal:true,roleRevoke:true,legacyPreserved:true,productionWrites:0}));
}finally{await f.close();}
