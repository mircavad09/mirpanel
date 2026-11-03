import assert from'node:assert/strict';import crypto from'node:crypto';import{createReceiptLiveProbe}from'../mirpanel-admin/receipt-live-probe.mjs';
const config={supabaseUrl:'https://test.invalid',supabaseSecretKey:'test-key-only',receiptsBucket:'private-test',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:['https://mirpanel.com'],maxReceiptBytes:5242880};let checks=0,calls=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const env={RECEIPT_PROBE_GATEWAY:'https://synthetic-test.trycloudflare.com',RECEIPT_PROBE_KEY:'a'.repeat(43),RECEIPT_PROBE_UNTIL:new Date(Date.now()+3600000).toISOString()},old=globalThis.fetch;globalThis.fetch=async()=>{calls++;return Response.json({value:{run:crypto.randomUUID()}});};
const make=env=>createReceiptLiveProbe({config,env,json:(r,status,b)=>{r.status=status;r.body=b;},readBody:async r=>r.body,readRawBody:async()=>Buffer.alloc(0),requireMutationAuth:(q,r)=>{if(!q.csrf){r.status=403;return false;}return q.role==='admin';},getSession:q=>({role:q.role})});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(s,h){this.status=s;Object.assign(this.headers,h);},end(s){this.html=s;}}),req=(url,body,headers={})=>({url,method:body?'POST':'GET',body,headers});
try{const off=make({});let r=response();eq(await off.handle(req('/api/payments/methods'),r),false);await off.handle(req('/api/payments/diagnostics/view'),r);eq(r.status,503);eq(calls,0);
const on=make(env);r=response();await on.handle(req('/api/payments/diagnostics/view'),r);eq(r.status,403);eq(calls,0);
r=response();await on.handle({...req('/api/admin/receipt-probe',{}),role:'admin'},r);eq(r.status,403);eq(calls,0);
r=response();await on.handle({...req('/api/admin/receipt-probe',{}),role:'admin',csrf:true},r);eq(r.status,200);eq(calls,1);const ticket=r.body.ticket;
r=response();await on.handle(req('/api/payments/diagnostics/start',{ticket},{origin:'https://evil.invalid'}),r);eq(r.status,403);
r=response();await on.handle(req('/api/payments/diagnostics/start',{ticket},{origin:'https://mirpanel.com'}),r);eq(r.status,200);const cookie=r.headers['Set-Cookie'];for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/'])eq(cookie.includes(flag),true);
r=response();await on.handle(req('/api/payments/diagnostics/start',{ticket},{origin:'https://mirpanel.com'}),r);eq(r.status,403);
r=response();await on.handle(req('/api/payments/methods',null,{cookie:'__Host-mirpanel_receipt_probe=forged'}),r);eq(r.status,403);eq(calls,1);
r=response();await on.handle(req('/api/payments/diagnostics/view',null,{cookie:cookie.split(';')[0]}),r);eq(r.status,200);eq(r.headers['Cache-Control'],'private, no-store');eq(r.html.includes('window.__probeOrder'),true);eq(calls,1);
console.log(JSON.stringify({checks,failures:0,defaultDisabled:true,csrfRequired:true,forgeryRejected:true,oneTimeTicket:true,productionWrites:0}));
}finally{globalThis.fetch=old;}
