import assert from 'node:assert/strict';
import {createAuthMailer} from '../mirpanel-admin/community/auth-mail.mjs';
const original=globalThis.fetch,env={GMAIL_CLIENT_ID:'synthetic',GMAIL_CLIENT_SECRET:'synthetic',GMAIL_REFRESH_TOKEN:'synthetic',GMAIL_SENDER_EMAIL:'sender@example.test'};
try{
 for(const [status,reason,expected,delay] of [[429,'rateLimitExceeded','SEND_RATE_LIMITED',120000],[403,'dailyLimitExceeded','SEND_RATE_LIMITED',120000],[400,'invalidArgument','SEND_REJECTED',0],[503,'backendError','SEND_RESULT_UNKNOWN',0]]){
  globalThis.fetch=async url=>url.endsWith('/token')?Response.json({access_token:'synthetic',expires_in:3600}):Response.json({error:{errors:[{reason}]}},{status,headers:{'Retry-After':'120'}});
  await assert.rejects(()=>createAuthMailer(env)('code',{user:{email:'recipient@example.test'},code:'123456'}),e=>e.deliveryCode===expected&&(!delay||e.retryAfterMs===delay));
 }
 globalThis.fetch=async url=>url.endsWith('/token')?Response.json({access_token:'synthetic',expires_in:3600}):Response.json({});
 await assert.rejects(()=>createAuthMailer(env)('code',{user:{email:'recipient@example.test'},code:'123456'}),e=>e.deliveryCode==='SEND_RESULT_UNKNOWN');
 globalThis.fetch=async url=>url.endsWith('/token')?Response.json({error:'invalid_grant'},{status:400}):Response.json({});
 await assert.rejects(()=>createAuthMailer(env)('code',{user:{email:'recipient@example.test'},code:'123456'}),e=>e.deliveryCode==='TOKEN_REJECTED');
 let sends=0;
 globalThis.fetch=async url=>url.endsWith('/token')?Response.json({access_token:'synthetic',expires_in:3600}):++sends===1?Response.json({error:{errors:[{reason:'rateLimitExceeded'}]}},{status:429}):Response.json({id:'synthetic-retry'});
 assert.equal((await createAuthMailer(env)('code',{user:{email:'recipient@example.test'},code:'123456',isCurrent:async()=>true})).id,'synthetic-retry');assert.equal(sends,2);
 sends=0;let current=true;
 globalThis.fetch=async url=>url.endsWith('/token')?Response.json({access_token:'synthetic',expires_in:3600}):(++sends,current=false,Response.json({error:{errors:[{reason:'rateLimitExceeded'}]}},{status:429}));
 await assert.rejects(()=>createAuthMailer(env)('code',{user:{email:'recipient@example.test'},code:'123456',isCurrent:async()=>current}),e=>e.deliveryCode==='SEND_SUPERSEDED');assert.equal(sends,1);
 sends=0;
 globalThis.fetch=async url=>url.endsWith('/token')?Response.json({access_token:'synthetic',expires_in:3600}):(++sends,Promise.reject(Error('Synthetic lost response')));
 await assert.rejects(()=>createAuthMailer(env)('code',{user:{email:'recipient@example.test'},code:'123456'}),e=>e.deliveryCode==='SEND_RESULT_UNKNOWN');assert.equal(sends,1);
 console.log(JSON.stringify({checks:9,providerFailuresClassified:true,boundedRetry:true,staleRetryBlocked:true,unknownSendNotRepeated:true,realEmailsSent:0}));
}finally{globalThis.fetch=original;}
