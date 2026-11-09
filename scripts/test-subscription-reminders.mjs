import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {bakuDate,shiftCalendarDays} from '../mirpanel-admin/payment-order-lifecycle.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery,createCustomerOrderMailer} from '../mirpanel-admin/community/order-delivery.mjs';
import {queueSubscriptionReminders} from '../mirpanel-admin/community/subscription-reminders.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const {db,pool,shop,id,close}=await shopFixture();
const today=bakuDate(),day=offset=>shiftCalendarDays(today,offset);
const user={user:'a'},owner='a'.repeat(64),origin='https://mirpanel.com';
const security=createPaymentSecurity({
 encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')
});
let now=new Date(today+'T19:59:59Z');
const sent=[];
const send=async(kind,mail)=>{
 assert.equal(kind,'order');
 sent.push(mail);
 return {id:'synthetic-provider-'+sent.length};
};
const worker=()=>createCustomerOrderMailer(pool,send,origin,{subscriptionReminders:true,now:()=>now});
const query=(sql,params)=>pool.query(sql,params);
const delivered=orderId=>adminDelivery(pool,security,'synthetic-admin',orderId,{
 requestId:id(),line:0,quantity:1,message:'Şifrə: PRIVATE-9876. Otaq kodu: 0123.',
 ...(renewing?{renewalApplied:true}:{})
});
let renewing=false;
async function item(productId){
 const line={productId,planIndex:0,quantity:1};
 const quote=await shop.quote(user,[line],owner);
 return {...line,termsVersion:quote.items[0].termsVersion};
}
async function checkout(line){
 return shop.checkout(user,owner,{items:[line],mode:'wallet',requestId:id(),consentAccepted:true});
}
async function add(productId,expiresOn){
 const order=await checkout(await item(productId));
 await query('update payment_orders set service_expires_on=$2 where id=$1',[order.orderId,expiresOn]);
 await delivered(order.orderId);
 const entries=(await shop.subscriptions(user)).subscriptions;
 return entries.find(entry=>entry.orderCode===String(order.orderCode));
}
const reminders=async()=> (await query("select event_key,state,reason from customer_order_mail where event_key like 'subscription-reminder:%' order by event_key")).rows;

try{
 for(const file of ['ready-stock-migration.sql','subscriptions-migration.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 await db.exec(db.read('supabase/migrations/202611090904_topup_emails.sql'));
 await query("insert into wallet_accounts(user_id,cents) values('a',10000)");
 const first=await add('ordinary',day(6)),second=await add('unlimited',day(14));
 assert.equal(first.expiresOn,day(6));
 // Keep the unrelated payment/delivery messages out of the reminder assertions.
 await query("update customer_order_mail set next_at=now()+interval '1 year'");
 await worker().wake();assert.equal(sent.length,0);
 assert.equal(bakuDate(now),today);
 now=new Date(today+'T20:00:00Z');
 assert.equal(bakuDate(now),day(1));
 await Promise.all([worker().wake(),worker().wake()]);
 for(const [offset,expected] of [[4,2],[5,3]]){
  now=new Date(day(offset)+'T09:00:00+04:00');
  await Promise.all([worker().wake(),worker().wake()]);
  assert.equal(sent.length,expected);
 }
 assert.deepEqual(sent.map(mail=>mail.subject),[
  'Synthetic ordinary — abunəliyinizin bitməsinə 5 gün qalıb',
  'Vaxtında yeniləyin — Synthetic ordinary abunəliyiniz 2 gün sonra bitir',
  'Son xatırlatma — Synthetic ordinary abunəliyiniz sabah bitir'
 ]);
 assert.equal(new Set(sent.map(mail=>mail.idempotencyKey)).size,3);
 for(const mail of sent){
  assert.equal(mail.user.email,'a@example.test');
  assert.match(mail.textBody,/Salam, Reader A!/);
  assert.match(mail.htmlBody,/href="https:\/\/mirpanel\.com\/profil\?tab=subscriptions"[^>]*>[\s\S]*Abunəliklərimə bax<\/a>/);
  assert.doesNotMatch(mail.textBody+mail.htmlBody,/PRIVATE-9876|0123/);
 }
 assert.ok((await reminders()).every(row=>row.state==='accepted'));

 // A real renewal is fulfilled after an old reminder is queued, before a worker sends it.
 now=new Date(day(9)+'T09:00:00+04:00');
 await queueSubscriptionReminders(pool,bakuDate(now));
 assert.ok((await reminders()).some(row=>row.event_key.includes(second.id)&&row.state==='queued'));
 const line=await item('unlimited');
 const draft=await shop.saveDraft(user,owner,{id:id(),productId:line.productId,planIndex:line.planIndex,
  termsVersion:line.termsVersion,values:{},renewalId:second.id,renewalExpiresOn:second.expiresOn});
 const renewal=await checkout({...line,draftId:draft.draftId,lineId:draft.lineId});
 renewing=true;
 await delivered(renewal.orderId);
 const renewed=(await shop.subscriptions(user)).subscriptions.find(entry=>entry.id===second.id);
 assert.ok(renewed.expiresOn>second.expiresOn);
 await query("update customer_order_mail set next_at=now()+interval '1 year' where event_key not like 'subscription-reminder:%'");
 await worker().wake();assert.equal(sent.length,3);
 assert.ok((await reminders()).some(row=>row.event_key.includes(second.id)&&row.reason==='SUBSCRIPTION_REMINDER_STALE'));
 await query('update "user" set email=$1 where id=$2',['updated@example.test','a']);
 now=new Date(shiftCalendarDays(renewed.expiresOn,-5)+'T09:00:00+04:00');
 await Promise.all([worker().wake(),worker().wake()]);
 assert.equal(sent.length,4);
 assert.equal(sent[3].user.email,'updated@example.test');
 assert.ok(sent[3].idempotencyKey.includes(renewed.expiresOn));
 assert.ok(sent[3].subject.includes('Synthetic unlimited'));
 now=new Date(shiftCalendarDays(renewed.expiresOn,-2)+'T09:00:00+04:00');
 await queueSubscriptionReminders(pool,bakuDate(now));
 await query("update payment_orders set status='rejected' where order_code::text=$1",[second.orderCode]);
 await worker().wake();
 assert.equal(sent.length,4);
 assert.ok((await reminders()).some(row=>row.event_key.includes(renewed.expiresOn+':2')&&row.reason==='SUBSCRIPTION_REMINDER_STALE'));
 console.log('PASS 5/2/1 Baku dates, shared queue, duplicate workers, stale renewal blocked, current email and new cycle');
}finally{await close();}
