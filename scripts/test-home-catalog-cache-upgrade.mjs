import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest} from '../functions/_middleware.js';
let upgraded=false,origin;
const changed=new Set(['app.js','stock-display-fix.js','catalog-card.js','catalog-card.css','page-navigation.js']);
const old=new Map([...changed,'index.html'].map(name=>[name,execFileSync('git',['show','21729b0:'+name])]));
const requests=[];
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local');requests.push({upgraded,path:u.pathname,query:u.search});
 if(u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({products:[],banners:[],stories:[]}));}
 const request=new Request(origin+req.url);
 const response=await onRequest({request,next:async(r=request)=>{
  let name=new URL(r.url).pathname.slice(1)||'index.html';
  if(name.startsWith('community-assets/'))name='mirpanel-admin/community/public/'+name.slice(17);
  let bytes;
  try{bytes=!upgraded&&old.has(name)?old.get(name):await fs.readFile(name);}catch{return new Response('',{status:404});}
  const ext=path.extname(name),isText=['.js','.mjs','.css','.html'].includes(ext);
  if(isText){
   let s=bytes.toString().replaceAll('https://mirpanel.onrender.com',origin);
   if(ext==='.html')s=s.replace('<head>','<head><script>window.MIRPANEL_ADMIN_BASE=location.origin;window.MIRPANEL_PAYMENT_API=location.origin;</script>');
   bytes=s;
  }
  return new Response(bytes,{headers:{'Content-Type':ext==='.html'?'text/html':ext==='.css'?'text/css':/\.m?js/.test(ext)?'text/javascript':'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=14400'}});
 }});
 let bytes=Buffer.from(await response.arrayBuffer()),headers=Object.fromEntries(response.headers);
 if(!upgraded){
  if(headers['content-type']?.includes('text/html'))bytes=Buffer.from(bytes.toString().replaceAll('home-catalog-1','product-transition-1'));
  else headers['cache-control']='public, max-age=14400';
 }
 res.writeHead(response.status,headers);res.end(bytes);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const c=await browser.newContext(),p=await c.newPage();
 await p.goto(origin,{waitUntil:'networkidle'});
 const baseline=await p.locator('#grid .card').count();
 await p.evaluate(()=>{localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'capcut',planIndex:0,quantity:1}]));document.cookie='session-upgrade-probe=synthetic-session; path=/';});
 // Prime the same URLs with a four-hour lifetime before the deployment changes.
 const before=await p.evaluate(async()=>{const r=await fetch('/app.js?v=old-profile');return {cache:r.headers.get('cache-control'),text:(await r.text()).includes('const homeCatalogState')};});
 assert.equal(before.text,false);
 upgraded=true;
 await p.goto(origin,{waitUntil:'networkidle'});
 await p.waitForFunction(()=>document.querySelector('#grid')?.dataset.catalogMounted==='1');
 assert.equal(await p.locator('#grid .card').count(),22);
 assert.equal(await p.locator('#tabs [aria-selected=true]').innerText(),'Hamısı');
 assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.v1'))),[{productId:'capcut',planIndex:0,quantity:1}]);
 assert((await c.cookies()).some(v=>v.name==='session-upgrade-probe'&&v.value==='synthetic-session'));
 const cold=await browser.newPage();await cold.goto(origin,{waitUntil:'networkidle'});
 assert.equal(await cold.locator('#grid .card').count(),22);
 const fetched=requests.filter(r=>r.upgraded&&changed.has(r.path.slice(1)));
 assert(fetched.some(r=>r.path==='/app.js'&&r.query.includes('home-catalog-1')));
 console.log(JSON.stringify({baseline,warmAfter:22,coldAfter:22,oldAssetCache:before.cache,storageAndSessionPreserved:true,forcedRefresh:false,upgradeRequests:fetched}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
