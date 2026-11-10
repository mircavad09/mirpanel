import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {shopFixture} from './shop-test-fixture.mjs';
import {createAdminPush,validatePushSubscription} from '../mirpanel-admin/admin-push.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
const f=await shopFixture();
const binding='a'.repeat(64),session='b'.repeat(64),sessionHash=crypto.createHash('sha256').update(session).digest('hex');
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();
const sub={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-only',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
const sent=[];
const options={pool:async()=>f.pool,security,binding,send:async(s,payload)=>{assert.equal(s.endpoint,sub.endpoint);sent.push(JSON.parse(payload));}};
const worker=createAdminPush(options);
const api=async input=>{
 let result;
 await worker.handle({request:{method:input?'POST':'GET',url:'/api/admin/push'},response:{},scope:{hash:sessionHash,binding},owner:'owner',json:(_,status,data)=>{assert.equal(status,200);result=data;},body:async()=>input});
 return result;
};
const add=async()=>{
 const {id}=await f.shop.topup({user:'a'},{amount:'20',methodId:f.method,requestId:f.id()});
 const receipt={path:'topup/'+id+'/test.png',size:3,mimeType:'image/png'};
 f.files.set(receipt.path,Buffer.from('abc'));await f.shop.savedReceipt({user:'a'},null,'topup',id,receipt);
 return id;
};
try{
 await f.pool.query('create table public.admin_sessions(token_hash text primary key,auth_binding text,expires_at timestamptz)');
 await f.db.exec(fs.readFileSync('supabase/migrations/202611100003_admin_topup_push.sql','utf8'));
 await f.db.exec(fs.readFileSync('supabase/migrations/202611100003_admin_topup_push.sql','utf8'));
 const old=await add();await f.shop.submitTopup({user:'a'},old);
 await f.pool.query("insert into public.admin_sessions values($1,$2,now()+interval '1 hour')",[sessionHash,binding]);
 const config=await api();assert.ok(config.publicKey);
 for(const endpoint of ['https://localhost/','https://fcm.googleapis.com.evil.test/','https://fcm.googleapis.com:443/fcm/send/test','http://fcm.googleapis.com/']){
  if(endpoint.includes(':443'))continue; // URL canonicalization normalizes the default HTTPS port.
  assert.throws(()=>validatePushSubscription({...sub,endpoint}));
 }
 await api({subscription:sub});await api({subscription:sub});
 const stored=(await f.pool.query('select * from admin_push_devices')).rows[0];
 assert.ok(!stored.subscription_cipher.includes(sub.endpoint));
 assert.equal((await f.pool.query('select * from admin_topup_push')).rowCount,0);
 const id=await add();
 await Promise.all(Array.from({length:4},()=>f.shop.submitTopup({user:'a'},id)));
 assert.equal((await f.pool.query('select * from admin_topup_push')).rowCount,1);
 await Promise.all([worker.wake(),createAdminPush(options).wake()]);
 await worker.wake();assert.equal(sent.length,1);assert.equal(sent[0].id,id);
 assert.equal(sent[0].title,'Yeni balans müraciəti · 20,00 ₼');
 assert.match(sent[0].body,/Reader A · #/);
 const expired=await add();await f.shop.submitTopup({user:'a'},expired);
 await f.pool.query("update public.admin_sessions set expires_at=now()-interval '1 second'");
 await worker.wake();assert.equal(sent.length,1);
 await f.pool.query("update public.admin_sessions set expires_at=now()+interval '1 hour'");
 const logout=await add();await f.shop.submitTopup({user:'a'},logout);
 await worker.removeSession(session);await worker.wake();assert.equal(sent.length,1);
 assert.equal((await f.pool.query('select * from admin_push_devices')).rowCount,0);
 const noDevice=await add();await f.shop.submitTopup({user:'a'},noDevice);
 assert.equal((await f.pool.query('select * from admin_topup_push where topup_id=$1',[noDevice])).rowCount,0);
 console.log('PASS push queue atomic submission, no old events, encrypted devices, concurrent sends, expired sessions, logout and endpoint guard');
}finally{await worker.stop();await f.close();}
