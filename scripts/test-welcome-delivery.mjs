import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {shopFixture} from './shop-test-fixture.mjs';
import {createAuthMailer} from '../mirpanel-admin/community/auth-mail.mjs';
import {createWelcomeDelivery} from '../mirpanel-admin/community/welcome-delivery.mjs';

const fixture=await shopFixture(),{pool}=fixture,original=fetch,workers=[],attempts=new Map();
let mode='ok',tokenFault=false,release;
const env={GMAIL_CLIENT_ID:'synthetic',GMAIL_CLIENT_SECRET:'synthetic',GMAIL_REFRESH_TOKEN:'synthetic',GMAIL_SENDER_EMAIL:'sender@example.test'};
const worker=(send=createAuthMailer(env))=>{const d=createWelcomeDelivery(pool,send,{backoff:[15,25],pollMs:10});workers.push(d);return d;};
const status=async id=>(await pool.query('select identifier,value from verification where id=$1',['mirpanel-welcome:'+id])).rows[0];
const state=async(id,expected)=>{
 for(let i=0;i<100;i++){
  const row=await status(id);
  if(row?.identifier==='mirpanel-welcome/'+expected)return JSON.parse(row.value);
  await delay(10);
 }
 throw Error('Missing welcome state: '+id+' '+expected);
};
const user=async id=>{const u={id,email:id+'@example.test',emailVerified:true};await pool.query('insert into "user"(id,name,email,"emailVerified") values($1,$1,$2,true)',[id,u.email]);return u;};
globalThis.fetch=async(url,opts)=>{
 if(url==='https://oauth2.googleapis.com/token'){
  if(tokenFault){tokenFault=false;throw Error('simulated network failure before send');}
  return Response.json({access_token:'synthetic',expires_in:3600});
 }
 assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
 const raw=Buffer.from(JSON.parse(opts.body).raw,'base64url').toString(),id=raw.match(/\r\nTo: ([a-z-]+)@example.test/)[1];
 const count=(attempts.get(id)||0)+1;attempts.set(id,count);
 if(mode==='gated')await new Promise(r=>{release=r;});
 if(mode==='retry'&&count===1||mode==='exhausted')return Response.json({error:{code:429}},{status:429,headers:{'Retry-After':'0'}});
 if(mode==='lost')throw Error('response lost after provider may have accepted');
 if(mode==='permanent')return Response.json({error:{code:400}},{status:400});
 return Response.json({id:'synthetic-provider-id'});
};
try{
 const retry=await user('retry'),a=worker();mode='retry';await a.enqueue(retry);
 await state(retry.id,'retry');await a.stop();
 const b=worker();b.start();
 assert.deepEqual(await state(retry.id,'accepted'),{attempt:2,providerId:'synthetic-provider-id'});assert.equal(attempts.get(retry.id),2);

 const parallel=await user('parallel');mode='gated';const c=worker();
 await Promise.all([a.enqueue(parallel),b.enqueue(parallel),c.enqueue(parallel)]);
 await state(parallel.id,'sending');assert.equal(attempts.get(parallel.id),1);
 release();release=null;await state(parallel.id,'accepted');
 await Promise.all([b.enqueue(parallel),c.enqueue(parallel)]);assert.equal(attempts.get(parallel.id),1);

 const lost=await user('lost');mode='lost';await b.enqueue(lost);
 assert.equal((await state(lost.id,'uncertain')).reason,'SEND_RESULT_UNKNOWN');await c.enqueue(lost);await c.wake();assert.equal(attempts.get(lost.id),1);

 const dead=await user('dead');mode='permanent';await b.enqueue(dead);
 assert.equal((await state(dead.id,'failed')).reason,'SEND_REJECTED');assert.equal(attempts.get(dead.id),1);

 const exhausted=await user('exhausted');mode='exhausted';await b.enqueue(exhausted);
 assert.equal((await state(exhausted.id,'failed')).attempt,3);assert.equal(attempts.get(exhausted.id),3);

 const token=await user('token');mode='ok';tokenFault=true;const d=worker();d.start();await d.enqueue(token);
 assert.equal((await state(token.id,'accepted')).attempt,2);assert.equal(attempts.get(token.id),1);

 const stale=await user('stale');
 await pool.query(`insert into verification(id,identifier,value,"expiresAt","updatedAt") values($1,'mirpanel-welcome/sending','{"attempt":1}','9999-12-31',now()-interval '3 minutes')`,['mirpanel-welcome:'+stale.id]);
 await b.wake();await state(stale.id,'uncertain');assert.equal(attempts.has(stale.id),false);
 const legacy=await user('legacy');await pool.query(`insert into verification(id,identifier,value,"expiresAt") values($1,$1,'claimed','9999-12-31')`,['mirpanel-welcome:'+legacy.id]);
 await b.enqueue(legacy);await b.wake();assert.equal((await status(legacy.id)).value,'claimed');assert.equal(attempts.has(legacy.id),false);
 console.log('PASS: retry after restart, concurrent enqueue, accepted receipt, response loss, permanent rejection, retry cap, pre-send failure, stale and legacy claims.');
}finally{release?.();await Promise.all(workers.map(d=>d.stop()));globalThis.fetch=original;await fixture.close();}
