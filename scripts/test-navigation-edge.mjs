import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequest} from '../functions/_middleware.js';
let checks=0;
for(const p of ['/','/mehsul','/mehsul/capcut-pro']){
 const r=await onRequest({request:new Request('https://mirpanel.com'+p),next:async()=>new Response('<!doctype html><html><head></head><body><script src="/site-header.js?v=old"></script><script src="browser-nav.js?v=old"></script><script src="splash.js?v=old"></script></body></html>',{headers:{'Content-Type':'text/html'}})});
 const t=await r.text();assert.match(t,/<script defer src="\/page-navigation\.js\?v=order-result-actions-1" data-page-navigation-loader>/);
 assert.match(t,/\/splash\.js\?v=home-first-paint-1/);assert.equal(r.status,200);
 assert.equal(t.includes('mirpanel:navigation-ready'),p==='/'||p==='/mehsul');checks+=4;
}
const file='/uploads/products/capcut-1792446915889-2c0554fd.png',source=fs.statSync('.'+file).size;
const variant=fs.statSync('.'+file.replace('.png','.perf.webp')).size;
assert(variant<source*.15);
for(const [accept,suffix]of [['image/webp,image/png','.perf.webp'],['image/png','.png'],['image/webp;q=0,image/png','.png']]){
 let target;
 const request=new Request('https://mirpanel.com'+file,{headers:{Accept:accept}});
 const r=await onRequest({request,next:async(req=request)=>{target=new URL(req.url).pathname;return new Response('sample',{headers:{'Content-Type':target.endsWith('.webp')?'image/webp':'image/png'}});}});
 assert(target.endsWith(suffix));assert.match(r.headers.get('Vary'),/Accept/);checks+=2;
}
console.log(JSON.stringify({checks,capcutOriginalBytes:source,capcutWebpBytes:variant,networkCalls:0}));
