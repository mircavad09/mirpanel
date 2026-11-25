import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {scheduleResendMail} from '../mirpanel-admin/community/resend-mail-scheduler.mjs';
import {createOrderMailTransport} from '../mirpanel-admin/community/order-mail-transport.mjs';
import {createCustomerOrderMailer} from '../mirpanel-admin/community/order-delivery.mjs';
import {createSellerRouting,ensureSellerRouting} from '../mirpanel-admin/community/seller-routing.mjs';
const f=await shopFixture(),{pool,db,shop,id,method,files}=f;
try{
 const marker='mirpanel-resend-sending-gate';let sent=0;
 const send=async()=>({id:'synthetic-'+(++sent)});
 const first=scheduleResendMail(pool,send),parallel=scheduleResendMail(pool,send);
 const race=await Promise.allSettled([first('order',{}),parallel('order',{})]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(sent,1);
 assert.equal(race.find(r=>r.status==='rejected').reason.deliveryCode,'SEND_RATE_LIMITED');
 await pool.query('delete from verification where id=$1',[marker]);
 const quotaSend=scheduleResendMail(pool,async()=>{throw Object.assign(Error(),{deliveryDisposition:'retry',deliveryCode:'SEND_DAILY_QUOTA',retryAfterMs:86400000});});
 await assert.rejects(()=>quotaSend('order',{}),e=>e.deliveryCode==='SEND_DAILY_QUOTA');
 const restarted=scheduleResendMail(pool,send);
 await assert.rejects(()=>restarted('order',{}),e=>e.deliveryCode==='SEND_DAILY_QUOTA'&&e.retryAfterMs>86000000);assert.equal(sent,1);
 await pool.query('delete from verification where id=$1',[marker]);
 const env={ORDER_MAIL_PROVIDER:'resend',ORDER_MAIL_FROM:'orders@mirpanel.com',ORDER_MAIL_RESEND_API_KEY:'synthetic'};
 for(const [name,code] of [['daily_quota_exceeded','SEND_DAILY_QUOTA'],['monthly_quota_exceeded','SEND_MONTHLY_QUOTA'],['rate_limit_exceeded','SEND_RATE_LIMITED']]){
  const t=createOrderMailTransport(env,null,{fetcher:async()=>Response.json({name},{status:429})});
  await assert.rejects(()=>t('order',{user:{email:'test@example.test'}}),e=>e.deliveryCode===code&&e.retryAfterMs>=2000);
 }
 await db.exec(db.read('mirpanel-admin/community/payment-history-number-migration.sql'));
 await db.exec(db.read('supabase/migrations/202611090904_topup_emails.sql'));
 await pool.query('update topup_mail_release set enabled=true');
 const topup=(await shop.topup({user:'a'},{amount:'5',methodId:method,requestId:id()})).id;
 const receipt={path:'topup/'+topup+'/test.png',size:4,mimeType:'image/png'};files.set(receipt.path,Buffer.alloc(4));
 await shop.savedReceipt({user:'a'},null,'topup',topup,receipt);await shop.submitTopup({user:'a'},topup);
 const event='topup-received:'+topup;let attempts=0;const keys=[];
 // A persisted provider pause defers both queues without consuming an attempt.
 await ensureSellerRouting(pool);
 let quotaCalls=0;
 const quotaGate=scheduleResendMail(pool,async()=>{quotaCalls++;throw Object.assign(Error(),{deliveryDisposition:'retry',deliveryCode:'SEND_DAILY_QUOTA',retryAfterMs:86400000});});
 await assert.rejects(()=>quotaGate('order',{}));
 const sellerQueue=createSellerRouting({pool,send:quotaGate,origin:'https://mirpanel.com'});
 for(let i=0;i<4;i++)await Promise.all([createCustomerOrderMailer(pool,scheduleResendMail(pool,send),'https://mirpanel.com').wake(),sellerQueue.drainMail()]);
 const deferred=(await pool.query('select * from customer_order_mail where event_key=$1',[event])).rows[0];
 assert.equal(deferred.state,'queued');assert.equal(deferred.attempts,0);assert.equal(deferred.reason,'SEND_DAILY_QUOTA');assert(deferred.next_at-Date.now()>86000000);assert.equal(quotaCalls,1);assert.equal(sent,1);
 await pool.query('delete from verification where id=$1',[marker]);
 const blocked=async(_kind,msg)=>{attempts++;keys.push(msg.idempotencyKey);throw Object.assign(Error(),{deliveryDisposition:'retry',deliveryCode:attempts===4?'SEND_DAILY_QUOTA':'SEND_RATE_LIMITED',retryAfterMs:attempts===4?86400000:1000});};
 for(let i=0;i<4;i++){
  await pool.query('update customer_order_mail set next_at=now() where event_key=$1',[event]);
  await createCustomerOrderMailer(pool,blocked,'https://mirpanel.com').wake();
  const q=(await pool.query('select * from customer_order_mail where event_key=$1',[event])).rows[0];
  assert.equal(q.state,'queued');assert.equal(q.attempts,i+1);assert.equal(q.provider_id,null);
  if(i===3){assert.equal(q.reason,'SEND_DAILY_QUOTA');assert(q.next_at-Date.now()>86000000);}
 }
 assert(keys.every(k=>k===event));
 await pool.query("update customer_order_mail set state='failed',reason='SEND_RATE_LIMITED',next_at=now() where event_key=$1",[event]);
 let accepted=0;const acceptedKeys=[];const success=async(_kind,msg)=>{accepted++;acceptedKeys.push(msg.idempotencyKey);return {id:'synthetic-final'};};
 await Promise.all([createCustomerOrderMailer(pool,success,'https://mirpanel.com').wake(),createCustomerOrderMailer(pool,success,'https://mirpanel.com').wake()]);
 await createCustomerOrderMailer(pool,success,'https://mirpanel.com').wake();assert.equal(accepted,1);assert.deepEqual(acceptedKeys,[event]);
 const dates=(await pool.query('select created_at,accepted_at from customer_order_mail where event_key=$1',[event])).rows[0];assert(dates.created_at);assert(dates.accepted_at);assert(dates.accepted_at>=dates.created_at);
 await pool.query("update customer_order_mail set state='uncertain',reason='STALE_SENDING',provider_id=null where event_key=$1",[event]);
 await createCustomerOrderMailer(pool,success,'https://mirpanel.com').wake();assert.equal(accepted,1);
 console.log(JSON.stringify({parallelProviderPacing:true,persistedCooldownAcrossRestart:true,dailyAndMonthlyClassified:true,moreThanThreeRetriesPreserved:true,dailyQueueRetained:true,legacyExplicitRejectRecovered:true,stableIdempotency:true,oneAcceptedNotification:true,unknownNotReplayed:true,realEmailsSent:0}));
}finally{await f.close();}
