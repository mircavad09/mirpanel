import assert from 'node:assert/strict';
import {onRequest as proxy} from '../functions/api/payments/[[path]].js';
import {onRequest as page} from '../functions/odenis/epoint/[[path]].js';
const original=globalThis.fetch;let calls=0;
try{
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).pathname,'/api/payments/epoint/apple-checkout');assert.equal(options.headers.get('Cookie'),'mirpanel_owner.session_token=synthetic');assert.equal(options.headers.get('Origin'),'https://mirpanel.com');return Response.json({error:'Login required'},{status:401});};
 const url='https://mirpanel.com/api/payments/epoint/apple-checkout?ref=11111111-1111-4111-8111-111111111111';
 const response=await proxy({request:new Request(url,{headers:{Cookie:'mirpanel_owner.session_token=synthetic; mirpanel_session=admin-not-forwarded; unrelated=x'}})});
 assert.equal(response.status,401);assert.match(response.headers.get('Cache-Control'),/private.*no-store/);assert.equal(calls,1);
 assert.equal((await proxy({request:new Request(url,{method:'POST'})})).status,404);assert.equal(calls,1);
 assert.equal((await proxy({request:new Request(url,{headers:{Origin:'https://untrusted.invalid'}})})).status,403);assert.equal(calls,1);
 const html=page({request:new Request('https://mirpanel.com/odenis/epoint/apple-pay?amount=999')});
 assert.equal(html.status,200);assert.match(html.headers.get('Content-Security-Policy'),/frame-src https:\/\/epoint.az/);assert.match(html.headers.get('Permissions-Policy'),/payment=/);assert.match(html.headers.get('X-Robots-Tag'),/noindex/);assert(!(await html.text()).includes('999'));
 assert.equal(page({request:new Request('https://mirpanel.com/odenis/epoint/apple-pay',{method:'POST'})}).status,405);
 const generic=page({request:new Request('https://mirpanel.com/odenis/epoint/odeme?amount=999')});assert.equal(generic.status,200);assert(!(await generic.text()).includes('999'));
 globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).pathname,'/api/payments/epoint/checkout');assert.equal(options.headers.get('Cookie'),'mirpanel_owner.session_token=synthetic');return Response.json({error:'Login required'},{status:401});};
 assert.equal((await proxy({request:new Request('https://mirpanel.com/api/payments/epoint/checkout?ref=x',{headers:{Cookie:'mirpanel_owner.session_token=synthetic'}})})).status,401);
 assert.equal((await proxy({request:new Request('https://mirpanel.com/api/payments/epoint/checkout?ref=x',{method:'POST'})})).status,404);
 console.log('PASS Apple payment page: no URL amount interpolation, noindex/CSP, narrow GET-only owner-session proxy, admin cookie stripped, cross-origin rejected');
}finally{globalThis.fetch=original;}
