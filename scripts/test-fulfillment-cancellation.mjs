import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {cancelFulfillment} from '../mirpanel-admin/community/fulfillment-cancellation.mjs';
import {adminDelivery,adminPendingDeliveries,createCustomerOrderMailer,deliveryRecords,ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';
import {approveCardWithReadyStock} from '../mirpanel-admin/community/ready-stock.mjs';
import {createOrderMailTransport} from '../mirpanel-admin/community/order-mail-transport.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,db,shop,method,id}=f;
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const buyer={user:'a'},hash='a'.repeat(64),actor='test-admin';
const sql=(text,args=[])=>pool.query(text,args);
const balance=async()=>Number((await sql("select cents from wallet_accounts where user_id='a'")).rows[0].cents);
const pending=()=>adminPendingDeliveries(pool);
const quote=order=>cancelFulfillment(pool,actor,order,null);
const fullReason='Məhsul tükənib <sınaq>.\nİkinci sətir.';
const partialReason='Yalnız qalan vahidlər mövcud deyil.';
const cancel=(order,p,reason='Sınaq səbəbi')=>cancelFulfillment(pool,actor,order,{previewToken:p.previewToken,reason});
const deliver=(order,line=0)=>adminDelivery(pool,security,actor,order,{requestId:id(),line,quantity:1,message:'Synthetic only'});
async function purchase(mode,lines){
 const quoted=await shop.quote(buyer,lines,hash);
 const group=await shop.checkout(buyer,hash,{mode,methodId:method,items:lines.map((l,i)=>({...l,termsVersion:quoted.items[i].termsVersion})),requestId:id(),consentAccepted:true});
 if(mode==='wallet')return group.orderId;
 const receipt={path:'cart/'+group.id+'/test.png',size:3,mimeType:'image/png',sha256:crypto.createHash('sha256').update('abc').digest('hex')};
 f.files.set(receipt.path,Buffer.from('abc'));
 await shop.savedReceipt(buyer,hash,'cart',group.id,receipt);
 const order=(await shop.submit(buyer,hash,group.id)).orderId;
 await approveCardWithReadyStock(pool,security,order,null,actor,false);
 return order;
}
const ordinary={productId:'ordinary',planIndex:0,quantity:1};
try{
 const migration=db.read('supabase/migrations/202611090911_fulfillment_cancellation.sql');
 await db.exec(migration);await db.exec(migration);
 await db.exec(db.read('mirpanel-admin/community/ready-stock-migration.sql'));
 await db.exec(db.read('supabase/migrations/202611090904_topup_emails.sql'));
 await sql("insert into wallet_accounts(user_id,cents) values('a',5000)");
 const full=await purchase('wallet',[ordinary]);
 assert.equal(await balance(),4500);
 assert.deepEqual(await pending(),[full]);
 const preview=await quote(full);
 assert.deepEqual([preview.full,preview.refundCents,preview.method],[true,500,'MirPanel balansı']);
 assert.equal(await balance(),4500);
 await sql("update public.payment_orders set created_at='2026-11-09 21:00:00+00' where id=$1",[full]);
 await assert.rejects(cancel(full,preview,'   '),{status:400});
 assert.equal(await balance(),4500);
 const replay=await Promise.all(Array.from({length:5},()=>cancel(full,preview,fullReason)));
 await cancel(full,preview,'Təkrar fərqli səbəb');
 assert.equal(replay.filter(x=>!x.idempotent).length,1);
 assert.equal(await balance(),5000);
 assert.deepEqual(await pending(),[]);
 assert.equal((await sql('select status from public.payment_orders where id=$1',[full])).rows[0].status,'cancelled');
 const partial=await purchase('wallet',[{...ordinary,quantity:2},{productId:'unlimited',planIndex:0,quantity:1}]);
 assert.equal(await balance(),3400);
 const stale=await quote(partial);
 await deliver(partial);
 await assert.rejects(cancel(partial,stale),{status:409});
 const rest=await quote(partial);
 assert.deepEqual([rest.full,rest.refundCents],[false,1100]);
 await cancel(partial,rest,partialReason);
 assert.equal(await balance(),4500);
 await assert.rejects(deliver(partial,1),{status:409});
 assert.equal((await ownerCodes(pool,'a')).length,1);
 assert.equal((await ownerCodes(pool,'b')).length,0);
 assert.deepEqual(await pending(),[]);
 const race=await purchase('wallet',[ordinary]),raceQuote=await quote(race);
 const results=await Promise.allSettled([deliver(race),cancel(race,raceQuote)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.ok([4000,4500].includes(await balance()));
 assert.deepEqual(await pending(),[]);
 const card=await purchase('card',[ordinary]);
 const before=await balance();
 await sql('create table mirpanel_community.api_dispatches(order_id uuid,line_index int,state text,external_id text)');
 await sql("insert into mirpanel_community.api_dispatches values($1,0,'checking','synthetic-id')",[card]);
 await assert.rejects(quote(card),{status:409,message:/Təchizatçı/});
 await sql("update mirpanel_community.api_dispatches set state='failed' where order_id=$1",[card]);
 const cardQuote=await quote(card);
 assert.equal(cardQuote.refundStatus,'card_pending');
 await cancel(card,cardQuote);
 assert.equal(await balance(),before);
 assert.equal((await sql('select count(*)::int n from community_refunds where order_id=$1',[card])).rows[0].n,0);
 const account=createAccountOrders({security,store:{},resolve:async()=>({userId:'a',page:async()=> (await sql('select * from public.payment_orders where id=any($1::uuid[])',[[full,partial,card]])).rows,deliveries:ids=>deliveryRecords(pool,ids)})});
 const history=(await account.list({})).orders;
 assert.equal(history.find(x=>x.id===full).status,'cancelled');
 assert.equal(history.find(x=>x.id===card).cancellation.refundStatus,'card_pending');
 assert.equal(history.find(x=>x.id===partial).deliveries.length,1);
 assert.equal(history.find(x=>x.id===full).cancellation.reason,fullReason);
 assert.equal(history.find(x=>x.id===partial).cancellation.reason,partialReason);
 const orderCode=history.find(x=>x.id===full).orderCode;
 const deepLink=createAccountOrders({security,store:{},resolve:async()=>({
  userId:'a',page:async()=>[],deliveries:ids=>deliveryRecords(pool,ids),
  byCode:async code=>(await sql("select o.* from public.payment_orders o join mirpanel_community.community_order_owners u on u.order_id=o.id where u.user_id=$1 and o.order_code::text=$2",['a',code])).rows[0]
 })});
 const opened=await deepLink.list({}, null, String(orderCode));
 assert.ok(opened.orders.some(x=>x.orderCode===orderCode&&x.id===full));

 // Run the real mail queue and transport with an isolated provider.
 const sent=[];
 const send=createOrderMailTransport({ORDER_MAIL_PROVIDER:'resend',ORDER_MAIL_FROM:'orders@mirpanel.com',ORDER_MAIL_RESEND_API_KEY:'synthetic'},null,{
  fetcher:async(url,request)=>{
   assert.equal(url,'https://api.resend.com/emails');
   sent.push({...JSON.parse(request.body),key:request.headers['Idempotency-Key']});
   return Response.json({id:'synthetic-'+sent.length});
  }
 });
 await sql("update mirpanel_community.customer_order_mail set next_at=now()+interval '1 day' where not(event_key=any($1::text[]))",[[full,partial,card].map(order=>'cancellation:'+order)]);
 const mailer=createCustomerOrderMailer(pool,send,'https://mirpanel.com',{requireDeliveryNotice:true});
 await Promise.all([mailer.wake(),mailer.wake()]);
 await mailer.wake();
 assert.equal(sent.length,3);
 for(const order of [full,partial,card]){
  const key='cancellation:'+order, messages=sent.filter(m=>m.key===key);
  assert.equal(messages.length,1);
  assert.deepEqual(messages[0].to,['a@example.test']);
  const code=history.find(x=>x.id===order).orderCode;
  const link='https://mirpanel.com/profil?tab=orders&order='+code;
  assert.ok(messages[0].text.includes('Sifarişlərimə bax: '+link));
  assert.ok(messages[0].html.includes(link.replace('&','&amp;')));
  assert.deepEqual((await sql('select state,attempts from mirpanel_community.customer_order_mail where event_key=$1',[key])).rows,[{state:'accepted',attempts:1}]);
 }
 const fullMail=sent.find(m=>m.key==='cancellation:'+full),partialMail=sent.find(m=>m.key==='cancellation:'+partial),cardMail=sent.find(m=>m.key==='cancellation:'+card);
 assert.equal(fullMail.subject,'MirPanel — Sifarişiniz ləğv olundu');
 assert.ok(fullMail.text.includes('Salam, Reader A!'));
 assert.ok(fullMail.text.includes('10.11.2026 tarixində verdiyiniz № '+orderCode));
 assert.ok(fullMail.text.includes('Səbəb — '+fullReason));
 assert.ok(fullMail.html.includes('&lt;sınaq&gt;.<br>İkinci sətir.'));
 assert.match(fullMail.text,/5,00 ₼ MirPanel balansınıza qaytarıldı/);
 assert.equal(partialMail.subject,'MirPanel — Sifarişiniz qismən ləğv olundu');
 assert.ok(partialMail.text.includes('Səbəb — '+partialReason));
 assert.match(partialMail.text,/Synthetic ordinary · .* · 1 ədəd/);
 assert.match(partialMail.text,/Synthetic unlimited · .* · 1 ədəd/);
 assert.match(cardMail.text,/Kart üzrə 5,00 ₼ geri ödəniş gözlənilir/);
 console.log('PASS: three cancellation messages accepted by synthetic provider; one send per order; full/partial subjects, escaped reason, Baku date, amounts and links verified.');
 console.log('PASS: full/partial cancellation, exact-once balance refunds, stale preview, concurrent delivery, supplier guard, card pending and customer history.');
}finally{await f.close();}
