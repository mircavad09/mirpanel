import assert from 'node:assert/strict';
import {createOrderMailTransport} from '../mirpanel-admin/community/order-mail-transport.mjs';

let calls=0, fallbackCalls=0;
const fallback=async()=>{fallbackCalls++;};
const env={ORDER_MAIL_PROVIDER:'resend',ORDER_MAIL_FROM:'orders@mirpanel.com',ORDER_MAIL_RESEND_API_KEY:'synthetic'};
const mail={user:{email:'synthetic@example.test'},subject:'Sifarişiniz təsdiqləndi',textBody:'Sifarişə bax',htmlBody:'<p>Sifarişə bax</p>'};
const make=(response,config=env)=>createOrderMailTransport(config,fallback,{fetcher:async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(options.redirect,'error');
  assert.deepEqual(JSON.parse(options.body),{from:'MirPanel <orders@mirpanel.com>',to:['synthetic@example.test'],subject:mail.subject,text:mail.textBody,html:mail.htmlBody});
  return response();
}});
assert.equal(createOrderMailTransport({},fallback),fallback);
const sender=make(()=>Response.json({id:'synthetic-id'}));
assert.deepEqual(await sender('order',mail),{id:'synthetic-id'});
await assert.rejects(()=>sender('code',mail),/ORDER_MAIL_KIND_DENIED/);
await assert.rejects(()=>make(()=>{}, {...env,ORDER_MAIL_FROM:'orders@gmail.com'})('order',mail),{deliveryDisposition:'failed',deliveryCode:'AUTH_CONFIGURATION'});
await assert.rejects(()=>make(()=>new Response('{}',{status:429,headers:{'Retry-After':'45'}}))('order',mail),{deliveryDisposition:'retry',deliveryCode:'SEND_RATE_LIMITED',retryAfterMs:45000});
await assert.rejects(()=>make(()=>new Response('{}',{status:403}))('order',mail),{deliveryDisposition:'failed',deliveryCode:'SEND_REJECTED'});
for(const response of [()=>{throw Error('synthetic network loss');},()=>new Response('{}',{status:503}),()=>Response.json({})]){
  await assert.rejects(()=>make(response)('order',mail),{deliveryDisposition:'uncertain',deliveryCode:'SEND_RESULT_UNKNOWN'});
}
assert.equal(calls,6);
assert.equal(fallbackCalls,0);
console.log('Order mail: opt-in, message integrity, domain guard, retries and ambiguous outcomes passed');
