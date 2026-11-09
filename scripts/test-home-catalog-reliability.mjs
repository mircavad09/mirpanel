import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {onRequest} from '../functions/_middleware.js';
import {patchHomeCatalog} from '../mirpanel-admin/product-pages.mjs';

const live=process.argv.includes('--live');
const {products}=extractAdminState(await fs.readFile('app.js','utf8'));
const active=products.filter(p=>p.active!==false);
const published=patchHomeCatalog(await fs.readFile('index.html','utf8'),products);
assert.equal(published.match(/data-home-catalog-status/g)?.length,1);
assert(published.includes('aria-busy="true" data-home-static="1"'));
assert.equal(patchHomeCatalog(published,products),published);
const types={'.html':'text/html','.page':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 const request=new Request('http://localhost'+req.url);
 try{
  const response=await onRequest({request,next:async(rewritten=request)=>{
   const u=new URL(rewritten.url);
   let file=u.pathname==='/'?'index.html':u.pathname.slice(1);
   if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
   if(/^mehsul\/[a-z0-9-]+$/.test(file))file+='.page';
   try{return new Response(await fs.readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream'}});}
   catch{return new Response('',{status:404});}
  }});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let checks=0;
const results=[];
async function count(page,n,label){
 await page.waitForFunction(n=>document.querySelectorAll('#grid .card').length===n&&document.querySelector('#grid')?.dataset.catalogMounted==='1',n,{timeout:20000});
 assert.equal(await page.locator('#grid .card').count(),n);checks++;
 results.push({label,expected:n,shown:n});
}
try{
 for(const width of [390,1440]){
  const c=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
  let failApp=false,slow=false,failStock=false,failed=0;
  await c.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),p=u.pathname;
   if(r.method()!=='GET')return route.abort();
   if(p==='/api/payments/inventory')return route.fulfill({json:{products:active.map(p=>({productId:p.id,unlimited:true}))}});
   if(p==='/api/product-sales')return route.fulfill({json:{initialized:true,productId:u.searchParams.get('productId'),productTotal:127}});
   if(u.origin!==origin||p.startsWith('/api/'))return route.fulfill({json:{items:[],stories:[],banners:[],products:[]}});
   if(p==='/app.js'&&failApp){failed++;return route.abort();}
   if(p==='/inventory-availability.mjs'&&failStock)return route.abort();
   if(slow&&/\.(js|css|mjs)$/.test(p))await new Promise(r=>setTimeout(r,450));
   return route.continue();
  });
  await c.addCookies([{name:'mirpanel-session-probe',value:'synthetic-session',url:origin,httpOnly:true}]);
  const p=await c.newPage();
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await count(p,active.length,width+' direct');
  await p.evaluate(()=>{localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'capcut',planIndex:0,quantity:1}]));});
  await p.locator('[data-home-filter=best]').click();
  await count(p,active.filter(p=>p.bestSeller===true).length,width+' best filter');
  const input=p.locator('.site-header-search input[type=search]').first();
  await input.fill('capcut');
  await count(p,1,width+' filtered search');
  await p.locator('#grid .title a').click();
  await p.waitForURL('**/mehsul/capcut-pro');
  await p.goBack();
  await count(p,1,width+' browser back search preserved');
  assert.equal(await input.inputValue(),'capcut');checks++;
  await input.fill('');
  await count(p,4,width+' clear search preserves best');
  await p.locator('[data-home-filter=all]').click();
  await count(p,active.length,width+' all filter');
  await p.locator('#sortSelect').selectOption('price-desc',{force:width<600});
  await p.locator('#grid').evaluate(grid=>[...grid.querySelectorAll('.card')].slice(4).forEach(card=>card.remove()));
  assert.equal(await p.locator('#grid .card').count(),4);checks++;
  await p.evaluate(()=>window.MirpanelNavigation.go('/mehsul/capcut-pro'));
  await p.evaluate(()=>window.MirpanelNavigation.go('/'));
  await count(p,active.length,width+' SPA return');
  assert.equal(await p.locator('#sortSelect').inputValue(),'price-desc');checks++;
  slow=true;
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await count(p,active.length,width+' weak network');
  assert.equal(await p.locator('#sortSelect').inputValue(),'price-desc');checks++;
  slow=false;failStock=true;
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await count(p,active.length,width+' inventory module failed');
  failStock=false;failApp=true;
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await p.locator('[data-home-catalog-status] button').waitFor({state:'visible',timeout:10000});
  assert(failed);checks++;
  failApp=false;
  await p.locator('[data-home-catalog-status] button').click();
  await count(p,active.length,width+' retry without reload');
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.v1'))),[{productId:'capcut',planIndex:0,quantity:1}]);
  assert.equal((await c.cookies()).find(v=>v.name==='mirpanel-session-probe')?.value,'synthetic-session');checks+=2;
  console.log(JSON.stringify({width,checks,results:results.filter(v=>v.label.startsWith(width))}));
  await c.close();
 }
 console.log(JSON.stringify({checks,results,scope:live?'live page + synthetic read-only APIs':'actual files + middleware + synthetic read-only APIs'}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
