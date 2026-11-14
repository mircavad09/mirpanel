import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequest as wallet} from '../functions/balans.js';
import {onRequest as cart} from '../functions/sebet.js';
const header=fs.readFileSync('customer-header.html','utf8');
for(const [handler,path,name] of [[wallet,'/balans','wallet'],[wallet,'/balans?returnTo=%2Fsebet','wallet'],[cart,'/sebet','cart']]){
 let assets=0;const r=await handler({request:new Request('https://mirpanel.com'+path,{headers:{Cookie:'mirpanel_owner.session=synthetic-only'}}),next:async request=>{assets++;assert.equal(new URL(request.url).pathname,'/customer-header.html');return new Response(header,{headers:{'Content-Type':'text/html'}});}});
 assert.equal(r.status,200);assert.equal(assets,1);assert.match(r.headers.get('Server-Timing'),new RegExp('^'+name+'-shell'));
 const html=await r.text();assert(!html.includes('synthetic-only'));assert(html.includes('shop-ui.js?v=customer-perf-2'));
 assert.equal(html.includes('shop-wallet-loading'),name==='wallet');assert.match(r.headers.get('Cache-Control'),/no-store/);
}
const forbidden=await wallet({request:new Request('https://mirpanel.com/balans',{headers:{Origin:'https://untrusted.test'}})});assert.equal(forbidden.status,403);
console.log('PASS edge wallet/cart shells: public-only markup, no session/DB dependency, preserved return URL, cross-origin denial.');
