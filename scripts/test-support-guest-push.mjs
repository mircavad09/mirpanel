import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {supportCustomer,supportStaff,newSupportGuest,adoptSupportGuest} from '../mirpanel-admin/community/private-support.mjs';
import {createSupportPush,ensureSupportPush} from '../mirpanel-admin/community/support-push.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
const f=await shopFixture(),p=f.pool;let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},reject=async(p,n)=>{await assert.rejects(p,e=>e.status===n);checks++;};
try{
 await p.query('create table customer_read_staff(user_id text primary key references "user"(id),active boolean,support boolean)');await p.query("insert into customer_read_staff values('a',true,true),('b',true,true)");
 const g=newSupportGuest().identity,t=(await supportCustomer(p,g,'start')).thread.id;
 await supportCustomer(p,g,'send',{threadId:t,clientId:crypto.randomUUID(),topic:'payment'});await supportCustomer(p,g,'send',{threadId:t,clientId:crypto.randomUUID(),handoff:true});eq((await supportCustomer(p,g,'session')).guestLimitReached,false);
 await reject(supportCustomer(p,g,'send',{threadId:t,clientId:crypto.randomUUID(),body:''}),400);
 const first={threadId:t,clientId:crypto.randomUUID(),body:'İlk qonaq mesajı'};await Promise.all([supportCustomer(p,g,'send',first),supportCustomer(p,g,'send',first)]);eq((await supportCustomer(p,g,'session')).guestLimitReached,true);
 await reject(supportCustomer(p,g,'send',{...first,clientId:crypto.randomUUID(),body:'İkinci qonaq mesajı'}),403);eq((await p.query('select count(*)::int n from support_messages where thread_id=$1 and body=$2',[t,first.body])).rows[0].n,1);
 await reject(supportStaff(p,'owner','send',{threadId:t,clientId:crypto.randomUUID(),body:'Alınmadan cavab'}),409);
 await supportStaff(p,'owner','claim',{threadId:t,requestId:crypto.randomUUID()});const reply={threadId:t,clientId:crypto.randomUUID(),body:'Qonağa cavab'};await supportStaff(p,'owner','send',reply);eq((await supportCustomer(p,g,'session')).messages.some(m=>m.body===reply.body),true);
 const auth={userId:'a',guestHash:null};await supportCustomer(p,auth,'start');await adoptSupportGuest(p,'a',g.guestHash);await adoptSupportGuest(p,'a',g.guestHash);await reject(adoptSupportGuest(p,'b',g.guestHash),403);await reject(supportCustomer(p,g,'thread',{}, {id:t}),404);await supportCustomer(p,auth,'send',{threadId:t,clientId:crypto.randomUUID(),body:'Girişdən sonra davam'});eq((await supportCustomer(p,auth,'thread',{}, {id:t})).messages.at(-1).body,'Girişdən sonra davam');
 await ensureSupportPush(p);const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});let sent=[],fail=false;
 const service=createSupportPush({pool:p,security,send:async(sub,payload)=>{if(fail)throw Object.assign(Error('Expired'),{statusCode:410});sent.push(JSON.parse(payload));}});
 const dh=crypto.createECDH('prime256v1');dh.generateKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-not-real',keys:{p256dh:dh.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
 eq(typeof(await service.handle(auth,'config')).publicKey,'string');await reject(service.handle({userId:'b',guestHash:null},'subscribe',{threadId:t,subscription}),404);await service.handle(auth,'subscribe',{threadId:t,subscription});
 const r2={threadId:t,clientId:crypto.randomUUID(),body:'Push üçün sintetik cavab'};await supportStaff(p,'owner','send',r2);await Promise.all([service.drain(),service.drain()]);eq(sent.length,1);eq(sent[0].body,'MirPanel dəstəyi sizə cavab verdi');eq(JSON.stringify(sent).includes(r2.body),false);await service.drain();eq(sent.length,1);const msg=(await supportCustomer(p,auth,'thread',{}, {id:t})).messages.at(-1);eq((await service.handle(auth,'check',{}, {id:t,event:msg.id})).allowed,true);await reject(service.handle({userId:'b',guestHash:null},'check',{}, {id:t,event:msg.id}),404);
 fail=true;await supportStaff(p,'owner','send',{threadId:t,clientId:crypto.randomUUID(),body:'Expired endpoint'});await service.drain();eq((await p.query('select count(*)::int n from support_push_devices')).rows[0].n,0);eq((await p.query("select count(*)::int n from support_push_jobs where state='expired'")).rows[0].n,1);
 eq((await p.query('select count(*)::int n from wallet_ledger')).rows[0].n,0);eq((await p.query('select count(*)::int n from payment_orders')).rows[0].n,0);
 console.log(JSON.stringify({checks,realMessages:0,pushTransport:'injected fake gateway, no external send',scope:'guest limit, replay, adoption, auto-claim prerequisites, push ACL, one queue job, expiry cleanup'}));
}finally{await f.close();}
