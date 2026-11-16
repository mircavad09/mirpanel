import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {renderPlanRows} from '../product-plan-view.mjs';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='outputs/ready-delivery';fs.mkdirSync(out,{recursive:true});
const state=extractAdminState(fs.readFileSync('app.js','utf8'));
const cases=['netflix','hbomax','capcut'].map(id=>state.products.find(p=>p.id===id)).filter(Boolean);
assert.equal(cases.length,3);
for(const product of cases){product.deliveryText='';product.deliveryType='manual';product.soldOut=false;product.stockEnabled=true;product.epinbyGroup=false;product.plans=[
 {label:'1 ay',months:1,price:9.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Yalnız zəmanətli',months:1,price:19.98,stockVisibility:'hide',warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Endirimli paket',months:1,price:9.98,regularPrice:29.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Uzun adlı şəxsi hesab — bütün cihazlarda istifadə üçün geniş imkanlar və əlavə üstünlüklər',months:1,price:1299.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Hazırda bitmiş paket',months:1,price:9.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Əlavə məlumatsız paket',months:1,price:9.98,stockVisibility:'hide'}
 ];}
const generated=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content),pages=new Map(generated);
const app=patchAppSource(fs.readFileSync('app.js','utf8'),state);

const types={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.page':'text/html','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');let file=u.pathname.slice(1);if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';
 if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
 try{let body=file==='app.js'?app:pages.get(file)??fs.readFileSync(file);
  res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404).end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const [engineName,engine]of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(engineName==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440])for(const product of cases){
  const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(15000);
  let failed=false,ready=1;const errors=[],writes=[];page.on('pageerror',e=>{if(e.message!=='ResizeObserver loop completed with undelivered notifications.')errors.push(e.message);});
  const fulfillment=i=>({ready:i===0?ready:i===1?0:i===2?1:0,automatic:i!==2,allowWaiting:i===0||i===1});
  await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
   if(u.pathname==='/api/payments/inventory')return route.fulfill(failed?{status:503,json:{}}:{json:{products:cases.map(p=>({productId:p.id,scope:'plan',plans:p.plans.map((_,i)=>({planKey:String(i),tracked:true,available:i===4?0:50,fulfillment:fulfillment(i)}))}))}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   if(r.method()!=='GET'){writes.push(u.pathname);return route.abort();}
   if(u.origin!==origin)return route.abort();return route.continue();
  });
  await page.goto(origin+'/mehsul/'+product.seoSlug);await page.locator('#productPageView[data-detail-enhanced]').waitFor();
  const rows=page.locator('#pp-plans-container .pp-plan-label');
  await rows.first().getByText('Anında təqdim olunur',{exact:true}).waitFor();
  assert.equal(await rows.nth(1).locator('.plan-fact-delivery').textContent(),'15–30 dəqiqə ərzində tamamlanır');
  assert.equal(await rows.nth(2).locator('.plan-fact-delivery').textContent(),'Ödəniş təsdiqindən sonra təqdim olunur');
  assert.equal(await rows.nth(4).locator('.plan-fact-delivery').textContent(),'Stokda yoxdur');
  const box=await rows.first().boundingBox();assert.ok(box.height<=82,JSON.stringify({width,box}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const style=await rows.first().locator('.plan-fact-stock').evaluate(n=>({border:getComputedStyle(n).borderTopWidth,background:getComputedStyle(n).backgroundColor,animation:getComputedStyle(n).animationName}));
  assert.equal(style.border,'0px');assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.animation,'planStockTextShine');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await rows.first().locator('.plan-fact-stock').evaluate(n=>getComputedStyle(n).animationName),'none');
  assert.equal(await rows.first().locator('.plan-fact-stock').evaluate(n=>getComputedStyle(n).color),'rgb(100, 230, 165)');
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Click anywhere on the row, including its price; no informational buttons.
  await rows.nth(1).locator('.pp-new-price').click();assert.equal(await page.evaluate(()=>currentPlanIdx),1);
  assert.equal(await page.locator('.product-detail-summary-delivery').textContent(),'15–30 dəqiqə ərzində tamamlanır');
  ready=0;await page.evaluate(()=>MirpanelInventory.refresh());assert.equal(await rows.first().locator('.plan-fact-delivery').textContent(),'15–30 dəqiqə ərzində tamamlanır');
  ready=1;await page.evaluate(()=>MirpanelInventory.refresh());assert.equal(await rows.first().locator('.plan-fact-delivery').textContent(),'Anında təqdim olunur');
  failed=true;await page.evaluate(()=>MirpanelInventory.refresh());assert.equal(await rows.first().locator('.plan-fact-delivery').textContent(),'Təhvil məlumatı yoxlanılır…');
  failed=false;await page.evaluate(()=>MirpanelInventory.refresh());await rows.first().getByText('Anında təqdim olunur',{exact:true}).waitFor();assert.equal(await page.locator('#inventoryServiceStatus').count(),0);
  await rows.first().click();
  if(engineName==='chrome')await page.locator('#pp-plans-container').screenshot({path:`${out}/${product.id}-${width}-plans.png`});
  if(engineName==='chrome'&&product.id==='capcut'&&[390,1440].includes(width))await page.screenshot({path:`${out}/local-${width}.png`,fullPage:true});
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await page.close();console.log(JSON.stringify({engine:engineName,width,product:product.id,passed:true}));
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
