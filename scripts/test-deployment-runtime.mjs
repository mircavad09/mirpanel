import assert from 'node:assert/strict';
import {deploymentRuntime} from '../mirpanel-admin/deployment-runtime.mjs';
const token='synthetic-probe-token-'.repeat(3),active=deploymentRuntime({}),standby=deploymentRuntime({MIRPANEL_RUNTIME_ROLE:'standby',MIRPANEL_STANDBY_TOKEN:token,SUPABASE_URL:'https://synthetic.supabase.co'});
assert(active.workers);assert(!standby.workers);assert.throws(()=>deploymentRuntime({MIRPANEL_RUNTIME_ROLE:'typo'}));assert.throws(()=>deploymentRuntime({MIRPANEL_RUNTIME_ROLE:'standby'}));
function request(method,url,secret){let status,body;const handled=standby.guard({method,url,headers:secret?{'x-mirpanel-standby':secret}:{}},{writeHead(s){status=s;},end(b){body=JSON.parse(b);}});return {handled,status,body};}
assert.equal(request('GET','/__deployment/health').body.workers,false);
for(const path of ['/api/payments/inventory','/api/homepage-banners','/api/stories','/api/product-sales?productId=capcut','/__deployment/probe']){
 assert.equal(request('GET',path).status,404);assert.equal(request('GET',path,token).handled,false);
 assert.equal(request('POST',path,token).status,503);
}
for(const path of ['/api/auth/get-session','/api/auth/callback/google','/api/login','/api/payments/shop/wallet/pay','/api/payments/reservations','/api/webhooks/epinby','/api/community/order-mail-webhook','/api/admin/payment-ready-stock']){
 for(const method of ['GET','POST','PUT','DELETE','HEAD','OPTIONS'])assert.equal(request(method,path,token).status,503);
 assert.equal(active.guard({url:path,method:'POST',headers:{}},{}),false);
}
assert.equal(request('GET','/api/stories','ə'.repeat(token.length)).status,404);
let sent=0;const send=standby.readOnlyFetch(async()=>{sent++;return new Response('{}');});
for(const path of ['inventory_snapshot','employee_system_ready'])await send('https://synthetic.supabase.co/rest/v1/rpc/'+path,{method:'POST'});
for(const url of ['https://synthetic.supabase.co/rest/v1/rpc/payment_method_queue_snapshot','https://synthetic.supabase.co/storage/v1/object/sign/receipt','https://sheets.googleapis.com/v4/spreadsheets/test','https://epinby.com/api/orders','https://api.resend.com/emails'])await assert.rejects(send(url,{method:'POST'}),/STANDBY_OUTBOUND_WRITE_BLOCKED/);
await assert.rejects(send(new Request('https://synthetic.supabase.co/rest/v1/rpc/inventory_set_quantity',{method:'POST'})),/STANDBY_OUTBOUND_WRITE_BLOCKED/);
assert.equal(sent,2);console.log('PASS: standby private read allowlist, no customer/auth/webhook/mutation routes, no background workers or outbound writes; active behavior preserved');
await send('https://synthetic.supabase.co/storage/v1/object/sign/mirpanel-stories/synthetic.webp',{method:'POST'});
await assert.rejects(send('https://synthetic.supabase.co/storage/v1/object/mirpanel-stories/synthetic.webp',{method:'POST'}),/STANDBY_OUTBOUND_WRITE_BLOCKED/);
assert.equal(sent,3);
