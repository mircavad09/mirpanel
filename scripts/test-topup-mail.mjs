import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOrderMailTransport} from '../mirpanel-admin/community/order-mail-transport.mjs';
import {shopFixture} from './shop-test-fixture.mjs';
import {createCustomerOrderMailer} from '../mirpanel-admin/community/order-delivery.mjs';
import {paymentHistory} from '../mirpanel-admin/community/account-panel.mjs';
import {profileReturn} from '../mirpanel-admin/community/public/profile-shell.js';
import {authReturn} from '../mirpanel-admin/community/public-service.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,db,shop,id,method,files}=f;
const messages=[];
async function delivered(providerId){
 for(let n=0;n<30;n++){
  const response=await fetch('https://api.resend.com/emails/'+providerId,{
   headers:{Authorization:'Bearer '+process.env.ORDER_MAIL_RESEND_API_KEY},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('PROVIDER_READ_'+response.status);
  const {last_event}=await response.json();
  if(last_event==='delivered'){console.log('DELIVERED '+providerId);return;}
  if(['bounced','failed','suppressed'].includes(last_event))throw Error('PROVIDER_'+last_event);
  await new Promise(r=>setTimeout(r,2000));
 }
 throw Error('DELIVERY_CONFIRMATION_TIMEOUT');
}
try{
 await db.exec(db.read('mirpanel-admin/community/payment-history-number-migration.sql'));
 await db.exec(db.read('supabase/migrations/202611090904_topup_emails.sql'));
 await pool.query('update topup_mail_release set enabled=true');
 const request={user:'a'};
 const topup=(await shop.topup(request,{amount:'5',methodId:method,requestId:id()})).id;
 const receipt={path:'topup/'+topup+'/test.png',size:4,mimeType:'image/png'};
 files.set(receipt.path,Buffer.alloc(4));
 await shop.savedReceipt(request,null,'topup',topup,receipt);
 assert.equal((await pool.query('select * from customer_order_mail')).rowCount,0);
 await Promise.all([shop.submitTopup(request,topup),shop.submitTopup(request,topup)]);
 assert.equal((await pool.query('select * from customer_order_mail')).rowCount,1);
 await Promise.all([shop.admin(pool,{id:'owner'},{action:'approve',id:topup,amount:'4.50'}),
   shop.admin(pool,{id:'owner'},{action:'approve',id:topup,amount:'4.50'})]);
 assert.equal((await pool.query('select * from wallet_ledger where request_id=$1',[topup])).rowCount,1);
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),450);
 const real=process.env.MIRPANEL_TOPUP_REAL_MAIL==='1';
 const transport=real?createOrderMailTransport(process.env):null;
 const send=async(kind,message)=>{
  assert.equal(kind,'order');
  messages.push(message);
  if(!real)return {id:id()};
  assert.equal(process.env.MIRPANEL_TOPUP_TEST_RECIPIENT,'mircavad09@gmail.com');
  const result=await transport(kind,{...message,user:{email:process.env.MIRPANEL_TOPUP_TEST_RECIPIENT}});
  return result;
 };
 const worker=createCustomerOrderMailer(pool,send,'https://mirpanel.com',{requireDeliveryNotice:true});
 const parallel=createCustomerOrderMailer(pool,send,'https://mirpanel.com',{requireDeliveryNotice:true});
 await Promise.all([worker.wake(),parallel.wake()]);
 assert.equal(messages.length,1);
 assert.equal(messages[0].subject,'MirPanel — Ödəniş qəbziniz qəbul edildi');
 assert.match(messages[0].textBody,/5,00 ₼/);
 const first=(await pool.query("select provider_id from customer_order_mail where event_key=$1",['topup-received:'+topup])).rows[0];
 if(real)await delivered(first.provider_id);
 await worker.notice({providerId:first.provider_id,reason:'RESEND_DELIVERED',topup:true});
 await worker.wake();
 assert.equal(messages.length,2);
 assert.equal(messages[1].subject,'MirPanel — Ödənişiniz təsdiqləndi');
 assert.match(messages[1].textBody,/4,50 ₼/);
 await Promise.all([worker.wake(),parallel.wake()]);
 assert.equal(messages.length,2);
 if(real){
  const second=(await pool.query('select provider_id from customer_order_mail where event_key=$1',['topup-approved:'+topup])).rows[0];
  await delivered(second.provider_id);
  console.log('REAL_MAIL both accepted and delivered once to the controlled recipient.');
 }
 const target='/profil?tab=payments&topup='+topup;
 assert.equal(profileReturn(target.split('?')[1]),target);
 assert.equal(authReturn('https://mirpanel.com',target),'https://mirpanel.com'+target);
 assert.equal((await paymentHistory(pool,'a',new URLSearchParams('topup='+topup))).items[0].id,topup);
 assert.equal((await paymentHistory(pool,'b',new URLSearchParams('topup='+topup))).items.length,0);
 if(!real){
  const retryTopup=(await shop.topup(request,{amount:'3',methodId:method,requestId:id()})).id;
  const retryReceipt={...receipt,path:'topup/'+retryTopup+'/test.png'};
  files.set(retryReceipt.path,Buffer.alloc(4));
  await shop.savedReceipt(request,null,'topup',retryTopup,retryReceipt);
  await shop.submitTopup(request,retryTopup);
  let tries=0;
  const retryWorker=createCustomerOrderMailer(pool,async()=>{
   if(++tries===1)throw {deliveryDisposition:'retry',deliveryCode:'SEND_RATE_LIMITED'};
   return {id:id()};
  },'https://mirpanel.com');
  await retryWorker.wake();
  assert.equal((await pool.query('select state from customer_order_mail where topup_id=$1',[retryTopup])).rows[0].state,'queued');
  await pool.query('update customer_order_mail set next_at=now() where topup_id=$1',[retryTopup]);
  await retryWorker.wake();
  assert.equal(tries,2);
  assert.equal((await pool.query('select state from customer_order_mail where topup_id=$1',[retryTopup])).rows[0].state,'accepted');
 }
 if(!real){
  const ownerHash='a'.repeat(64),input=[{productId:'ordinary',planIndex:0,quantity:1}];
  const quote=await shop.quote({},input,ownerHash);
  const items=input.map((x,i)=>({...x,termsVersion:quote.items[i].termsVersion}));
  const checkout=await shop.checkout(request,ownerHash,{items,mode:'card',methodId:method,requestId:id(),consentAccepted:true});
  const receipt={path:'cart/'+checkout.id+'/test.png',size:4,mimeType:'image/png',sha256:'a'.repeat(64)};
  files.set(receipt.path,Buffer.alloc(4));
  await shop.savedReceipt(request,ownerHash,'cart',checkout.id,receipt);
  const order=await shop.submit(request,ownerHash,checkout.id);
  const sent=[];
  const orderWorker=createCustomerOrderMailer(pool,async(kind,message)=>{sent.push(message);return {id:id()};},'https://mirpanel.com');
  await orderWorker.wake();
  assert.match(sent[0].subject,/Çekiniz qəbul edildi/);
  await f.rpc('approve_payment_order_v7',[order.orderId,null,'synthetic-admin']);
  await orderWorker.wake();
  assert.match(sent[1].subject,/Sifarişiniz təsdiqləndi/);
 }
 console.log('PASS topup submission, concurrent approval, once-only ordered mail, amount snapshots, owner-scoped link and login return.');
}finally{await f.close();}
