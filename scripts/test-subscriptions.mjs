import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
import {saveReadyStock} from '../mirpanel-admin/community/ready-stock.mjs';
import {signature} from '../mirpanel-admin/employee-security.mjs';
import {bakuDate,shiftCalendarDays,addCalendarMonthsMinusDay} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {subscriptionPeriod} from '../mirpanel-admin/community/subscriptions.mjs';
import {summarize,urgency} from '../mirpanel-admin/community/public/account-subscriptions.js';
import {onRequest as proxy} from '../functions/api/payments/[[path]].js';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{db,pool,shop,method,id}=f;
const a={user:'a'},b={user:'b'},hash='a'.repeat(64);
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const today=bakuDate(),day=n=>shiftCalendarDays(today,n),q=s=>pool.query(s);
const quote=async (productId,planIndex=0)=>({productId,planIndex,quantity:1,termsVersion:(await shop.quote(a,[{productId,planIndex,quantity:1}],hash)).items[0].termsVersion});
async function checkout(items,mode='wallet',requestId=id()){
 return shop.checkout(a,hash,{items,mode,methodId:method,requestId,consentAccepted:true});
}
async function fulfill(orderId,extra={}){
 const r={requestId:id(),line:0,quantity:1,message:'Sintetik təhvil',...extra};
 return adminDelivery(pool,security,'synthetic-admin',orderId,r);
}
async function draft(row,planIndex=0,req=a){
 const item=await quote(row.productId,planIndex),saved=await shop.saveDraft(req,hash,{id:id(),productId:item.productId,planIndex,values:{},termsVersion:item.termsVersion,renewalId:row.id,renewalExpiresOn:row.expiresOn});
 return {...item,draftId:saved.draftId,lineId:saved.lineId};
}
async function saveCard(g){
 const receipt={path:'cart/'+g.id+'/test.png',mimeType:'image/png',size:3,sha256:crypto.createHash('sha256').update('abc').digest('hex')};
 f.files.set(receipt.path,Buffer.from('abc'));await shop.savedReceipt(a,hash,'cart',g.id,receipt);
 return shop.submit(a,hash,g.id);
}
const denied=(p,status)=>assert.rejects(p,e=>e.status===status);
try{
 for(const file of ['order-delivery-migration.sql','ready-stock-migration.sql','subscriptions-migration.sql','subscriptions-migration.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 assert.deepEqual(await shop.subscriptions(a),{accountId:'a',subscriptions:[]});
 assert.deepEqual([11,10,8,7,6,4,3,0].map(urgency),['green','orange','orange','amber','amber','amber','red','red']);
 assert.deepEqual(subscriptionPeriod({label:'7 gün'}),{unit:'days',count:7});
 assert.equal(subscriptionPeriod({label:'7 gün zəmanət'}),null);
 await q("insert into wallet_accounts(user_id,cents) values('a',10000)");
 f.catalog.products.find(p=>p.id==='ordinary').plans.push({label:'7 gün',price:2,days:7});
 for(const [product,days] of [['ordinary',6],['unlimited',10]]){
  const order=await checkout([await quote(product)]);
  await pool.query('update payment_orders set service_expires_on=$2 where id=$1',[order.orderId,day(days)]);
  await fulfill(order.orderId);
 }
 const rows=async()=>(await shop.subscriptions(a)).subscriptions;
 const [first,second]=await rows();
 assert.deepEqual([first.days,second.days],[6,10]);
 assert.deepEqual(summarize(await rows()),{active:2,soon:2,week:1,unpriced:0,estimated:0,total:1100});
 assert.deepEqual(summarize([{days:10,renewalCents:null}]),{active:1,soon:1,week:0,unpriced:1,estimated:0,total:null});
 assert.deepEqual(await shop.subscriptions(b),{accountId:'b',subscriptions:[]});await denied(shop.subscriptions({}),401);
 await denied(draft(first,0,b),404);
 const [one,same]=await Promise.all([draft(first,1),draft(first,1)]);
 assert.equal(one.draftId,same.draftId);
 await denied(checkout([{...one,quantity:2}]),409);
 const plan=f.catalog.products.find(p=>p.id==='ordinary').plans[1];
 await saveReadyStock(pool,security,crypto.randomBytes(32).toString('base64'),f.catalog,'synthetic-admin',{productId:'ordinary',index:1,planSignature:signature(plan),requestId:id(),autoWallet:true,messages:['Synthetic ready account that must not be issued as renewal']});
 await q("update wallet_accounts set cents=0 where user_id='a'");
 await denied(checkout([one]),409);assert.equal((await rows()).find(x=>x.id===first.id).expiresOn,first.expiresOn);
 await q("update wallet_accounts set cents=8900 where user_id='a'");
 const repeat=id(),[wallet,again]=await Promise.all([checkout([one],'wallet',repeat),checkout([one],'wallet',repeat)]);
 assert.equal(wallet.orderId,again.orderId);
 assert.equal((await rows()).find(x=>x.id===first.id).renewalStatus,'preparing');
 assert.equal((await q('select count(*)::int n from ready_stock_units where delivery_id is null')).rows[0].n,1);
 assert.equal((await rows()).find(x=>x.id===first.id).expiresOn,first.expiresOn);
 await denied(checkout([one]),409);
 const op={renewalApplied:true,requestId:id()};
 await denied(fulfill(wallet.orderId),400);
 await fulfill(wallet.orderId,op);await fulfill(wallet.orderId,op);
 assert.equal((await rows()).find(x=>x.id===first.id).expiresOn,day(13));
 assert.equal((await rows()).length,2);
 await denied(checkout([one]),409); // The draft was made before the extension.
 const cardItem=await draft(second);
 const rejected=await saveCard(await checkout([cardItem],'card'));
 assert.equal((await rows()).find(x=>x.id===second.id).renewalStatus,'pending');
 await denied(fulfill(rejected.orderId,{renewalApplied:true}),409);
 await q("update payment_orders set status='rejected' where id='"+rejected.orderId+"'");
 assert.equal((await rows()).find(x=>x.id===second.id).renewalStatus,'failed');
 assert.equal((await rows()).find(x=>x.id===second.id).expiresOn,second.expiresOn);
 const card=await saveCard(await checkout([cardItem],'card'));
 await f.rpc('approve_payment_order_v7',[card.orderId,null,'synthetic-admin']);
 await f.rpc('approve_payment_order_v7',[card.orderId,null,'synthetic-admin']);
 assert.equal((await rows()).find(x=>x.id===second.id).renewalStatus,'preparing');
 assert.equal((await rows()).find(x=>x.id===second.id).expiresOn,second.expiresOn);
 await fulfill(card.orderId,{renewalApplied:true});
 assert.equal((await rows()).find(x=>x.id===second.id).expiresOn,addCalendarMonthsMinusDay(day(11),1));
 assert.equal((await q('select count(*)::int n from subscription_renewals where expires_on is not null')).rows[0].n,2);
 assert.equal((await q("select count(*)::int n from wallet_ledger where kind='purchase_debit'")).rows[0].n,3);
 // Two separately purchased units keep the old price even after that package is removed.
 const capcut={id:'capcut',title:'CapCut Pro',active:true,plans:[{id:'old-capcut',label:'Köhnə 1 aylıq paket',months:1,price:4.99}]};
 f.catalog.products.push(capcut);
 const originalOrders=[];
 for(const days of [28,30]){
  const order=await checkout([await quote(capcut.id)]);originalOrders.push(order.orderId);
  await pool.query('update payment_orders set service_expires_on=$2 where id=$1',[order.orderId,day(days)]);
  await fulfill(order.orderId);
 }
 capcut.plans=[{id:'new-capcut',label:'Yeni 1 aylıq paket',months:1,price:6.79}];
 const capRows=async()=>(await rows()).filter(r=>r.productId==='capcut');
 const old=await capRows();
 assert.deepEqual(old.map(r=>[r.plan,r.lastPurchaseCents,r.renewalCents,r.options[0].cents]),Array(2).fill(['Köhnə 1 aylıq paket',499,null,679]));
 assert.deepEqual(summarize(old),{active:2,soon:2,week:0,unpriced:0,estimated:2,total:998});
 const balance=async()=>(await q("select cents from wallet_accounts where user_id='a'")).rows[0].cents;
 const before=await balance();
 const renewalDraft=await draft(old[0]);
 assert.equal((await shop.quote(a,[renewalDraft],hash)).totalCents,679);
 assert.equal(await balance(),before);
 const updated=await checkout([renewalDraft]);
 assert.equal(updated.totalCents,679);
 assert.equal((await capRows()).find(r=>r.id===old[0].id).plan,old[0].plan);
 await fulfill(updated.orderId,{renewalApplied:true});
 assert.deepEqual((await capRows()).find(r=>r.id===old[0].id).options.map(p=>p.cents),[679]);
 const applied=(await capRows()).find(r=>r.id===old[0].id);
 assert.deepEqual([applied.plan,applied.lastPurchaseCents,applied.renewalCents],['Yeni 1 aylıq paket',679,679]);
 const historic=(await pool.query("select checkout_snapshot->'items'->0->>'planName' plan,amount::text from payment_orders where id=any($1::uuid[])",[originalOrders])).rows;
 assert.deepEqual(historic,Array(2).fill({plan:'Köhnə 1 aylıq paket',amount:'4.99'}));
 // New snapshots preserve the day unit even if the catalog also has a legacy months field.
 capcut.plans.push({id:'week-capcut',label:'7 gün',durationDays:7,months:7,price:1.12});
 const week=await checkout([await quote(capcut.id,1)]);
 const weekSnapshot=(await pool.query('select checkout_snapshot from payment_orders where id=$1',[week.orderId])).rows[0].checkout_snapshot;
 assert.equal(weekSnapshot.items[0].durationDays,7);
 assert.equal(weekSnapshot.items[0].durationMonths,null);
 const weeklyDelivery=await fulfill(week.orderId);
 assert.equal(weeklyDelivery.status,'completed');
 const weekly=async()=>(await capRows()).find(row=>row.orderCode===week.orderCode);
 assert.equal((await weekly()).expiresOn,day(7));
 assert.equal((await weekly()).days,7);
 assert.equal((await weekly()).progress,100);
 assert.equal(summarize([await weekly()]).week,1);
 assert.equal(summarize([await weekly()]).soon,1);
 // Reproduce the historic CapCut snapshot without rewriting production records.
 const legacy={...weekSnapshot,items:weekSnapshot.items.map(({durationDays,...line})=>({...line,durationMonths:7}))};
 await pool.query('update payment_orders set checkout_snapshot=$2 where id=$1',[week.orderId,legacy]);
 assert.equal((await weekly()).expiresOn,day(7));
 await pool.query('update payment_orders set service_expires_on=$2 where id=$1',[week.orderId,day(12)]);
 assert.equal((await weekly()).expiresOn,day(12));
 const monthly=await checkout([await quote(capcut.id)]);
 await fulfill(monthly.orderId);
 assert.equal((await capRows()).find(row=>row.orderCode===monthly.orderCode).expiresOn,addCalendarMonthsMinusDay(today,1));
 const originalFetch=globalThis.fetch;
 const subscriptionUrl='https://mirpanel.com/api/payments/shop/subscriptions';
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url.pathname,'/api/payments/shop/subscriptions');
   assert.equal(options.headers.get('cookie'),'__Secure-mirpanel_owner.session_token=synthetic');
   return Response.json({accountId:'a',subscriptions:[]});
  };
  const r=await proxy({request:new Request(subscriptionUrl,{headers:{cookie:'__Secure-mirpanel_owner.session_token=synthetic; mirpanel_session=admin'}})});
  assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private, no-store/);
  assert.equal((await proxy({request:new Request(subscriptionUrl,{method:'POST'})})).status,404);
  assert.equal((await proxy({request:new Request(subscriptionUrl,{headers:{Origin:'https://other.example'}})})).status,403);
 }finally{globalThis.fetch=originalFetch;}
 const netflix={id:'netflix',title:'Netflix Şəxsi',active:true,plans:[1,3,6].map(months=>({label:months+' ay',months,price:1}))};
 f.catalog.products.push(netflix);
 await q("update wallet_accounts set cents=10000 where user_id='a'");
 for(const [index,months] of [1,3,6].entries()){
  const order=await checkout([{...await quote(netflix.id,index),details:{name:'Sintetik',code_4:'0408'}}]);
  await fulfill(order.orderId);
  const sub=(await rows()).find(r=>r.orderCode===String(order.orderCode));
  assert.equal(sub?.plan,months+' ay');
  assert.equal(sub.expiresOn,addCalendarMonthsMinusDay(today,months));
 }
 console.log('PASS subscription ownership, two live prices, boundaries, unchanged expiry until manual fulfillment, early extension, failed payment, retry, duplicate prevention and Netflix 1/3/6-month order snapshots');
}finally{await f.close();}
