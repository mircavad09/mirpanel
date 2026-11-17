import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductListingPageFiles,generateProductPageFiles,patchHomeCatalog} from '../mirpanel-admin/product-pages.mjs';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const state=extractAdminState(fs.readFileSync('app.js','utf8'));
state.products=state.products.filter(p=>p.id==='capcut');
const product=state.products[0];assert.equal(product.plans.length,2);
const detail=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content).get('mehsul/capcut-pro.page');
assert.ok(detail.includes('<div class="product-page-delivery" hidden>'));
assert.ok(detail.includes('<p class="product-detail-summary-delivery" hidden></p>'));
assert.ok(!/<strong>Ödəniş təsdiqindən sonra təqdim olunur<\/strong>/.test(detail));
assert.ok(!/class="plan-fact plan-fact-delivery"/.test(detail),'Initial HTML must not promise delivery before inventory');
assert.ok(product.plans[0].price>product.plans[1].price,'Card price belongs to the 7-day plan');
const listing=generateProductListingPageFiles(state.products,state.siteSections,state.cms).get('mehsul.page');
const home=patchHomeCatalog(fs.readFileSync('index.html','utf8'),state.products);
const app=patchAppSource(fs.readFileSync('app.js','utf8'),state);
const types={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');let file=u.pathname.slice(1);
 if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
 try{const body=file===''?home:file==='mehsul'?listing:file==='app.js'?app:fs.readFileSync(file);
 res.setHeader('content-type',file===''||file==='mehsul'?'text/html':types[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404).end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,out='outputs/ready-delivery';fs.mkdirSync(out,{recursive:true});
try{for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440])for(const routePath of ['/','/mehsul']){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.clock.install();
  let ready=[2,0],automatic=true,failed=false,reads=0;
  await page.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.method()!=='GET')throw Error('Unexpected write '+u.pathname);
   if(u.pathname==='/api/payments/inventory'){reads++;return route.fulfill(failed?{status:503,json:{}}:{json:{products:[{productId:'capcut',scope:'product',available:24,canOrder:true,plans:product.plans.map((_,i)=>({planKey:String(i),active:true,tracked:true,available:24,canOrder:true,fulfillment:{ready:ready[i],automatic,allowWaiting:true}}))}]}});}
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   if(u.origin!==origin)return route.abort();return route.continue();
  });
  await page.goto(origin+routePath);const card=page.locator('.homeProductCard[data-product-id="capcut"]').first();await card.waitFor();
  await page.waitForFunction(()=>!!window.MirpanelInventory||location.pathname==='/mehsul'&&window.mirpanelCatalogSales);
  await page.waitForFunction(()=>document.querySelector('.homeProductCard .homeCardAdd')?.disabled===false);
  const refresh=async()=>{
   if(routePath==='/')await page.evaluate(()=>MirpanelInventory.refresh());
   else{const before=reads;await page.clock.fastForward(11000);await page.waitForFunction(()=>true);for(let i=0;i<50&&reads===before;i++)await new Promise(r=>setTimeout(r,20));assert.ok(reads>before);}
   await new Promise(r=>setTimeout(r,150));
  };
  const absent=async()=>assert.equal(await card.locator('.homeCardDelivery').count(),0);
  await refresh();await absent(); // Monthly stock must not promise instant 7-day delivery.
  ready=[2,1];await refresh();assert.equal(await card.locator('.homeCardDelivery').textContent(),'Anında təqdim olunur');
  const bolt=await card.locator('.homeCardDelivery').evaluate(n=>getComputedStyle(n,'::before').clipPath);assert.notEqual(bolt,'none');
  automatic=false;await refresh();await absent();
  automatic=true;ready=[2,0];await refresh();await absent(); // Last matching account assigned/sold.
  ready=[2,1];await refresh();failed=true;await refresh();await absent();
  failed=false;await refresh();assert.equal(await card.locator('.homeCardDelivery').textContent(),'Anında təqdim olunur');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(name==='chrome')await card.screenshot({path:out+'/synthetic-'+(routePath==='/'?'home':'listing')+'-'+width+'.png'});
  console.log(JSON.stringify({engine:name,width,route:routePath,exactPricePlan:true,autoOff:true,lastSold:true,failedThenRecovered:true,passed:true}));await page.close();
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
