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
const out='outputs/compact-plan-rows';fs.mkdirSync(out,{recursive:true});
const baseline='a05ea8d',old=file=>execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',maxBuffer:4e6});
const oldModule=old('product-plan-view.mjs').replace("'./product-detail-display.mjs'",JSON.stringify(pathToFileURL(path.resolve('product-detail-display.mjs')).href)).replace("'./mirpanel-admin/public/product-plan-utils.mjs'",JSON.stringify(pathToFileURL(path.resolve('mirpanel-admin/public/product-plan-utils.mjs')).href));
const before=await import('data:text/javascript;base64,'+Buffer.from(oldModule).toString('base64'));
const state=extractAdminState(fs.readFileSync('app.js','utf8'));
const cases=['zoom','prime','netflix','hbomax','capcut'].map(id=>state.products.find(p=>p.id===id)).filter(Boolean);
assert.equal(cases.length,5);
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
const oldCss=old('product-page.css'),oldJs=old('product-page.js');
const types={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.page':'text/html','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
if(process.argv.includes('--live'))for(const f of ['product-page.css','product-page.js']){const r=await fetch('https://mirpanel.com/'+f+'?v=compact-plans-1');assert.equal(r.status,200);assert.ok((await r.text()).replaceAll('\r\n','\n')===fs.readFileSync(f,'utf8').replaceAll('\r\n','\n'),'Live asset differs: '+f);}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');let file=u.pathname.slice(1);if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';
 if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
 try{let body=file==='app.js'?app:pages.get(file)??fs.readFileSync(file);
  if(u.searchParams.has('before')&&file.endsWith('.page')){const p=cases.find(p=>file==='mehsul/'+p.seoSlug+'.page');if(p)body=String(body).replace(renderPlanRows(p),before.renderPlanRows(p));}
  if(u.searchParams.has('legacy')&&file.endsWith('.page'))body=String(body).replace(' data-server-plans','');
  res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404).end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const results=[];
try{for(const [engineName,engine] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(engineName==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440])for(const product of cases){
  const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(12000);let inventoryError=false;const writes=[],errors=[],browserWarnings=[];
  page.on('pageerror',e=>{if(e.message==='ResizeObserver loop completed with undelivered notifications.')browserWarnings.push(e.message);else errors.push(e.message);});
  await page.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.pathname==='/api/payments/inventory')return route.fulfill(inventoryError?{status:503,json:{}}:{json:{products:cases.map(p=>({productId:p.id,scope:'plan',plans:p.plans.map((_,i)=>({planKey:String(i),tracked:true,available:i===4?0:28}))}))}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   if(u.pathname==='/cdn-cgi/rum')return route.fulfill({status:204});
   if(r.method()!=='GET'){writes.push(u.pathname);return route.abort();}
   if(u.origin!==origin)return route.abort();return route.continue();
  });
  await page.goto(origin+'/mehsul/'+product.seoSlug);await page.locator('#productPageView[data-detail-enhanced]').waitFor();
  const rows=page.locator('#pp-plans-container .pp-plan-label');assert.equal(await rows.count(),6);
  await rows.first().locator('[data-inventory-plan]:not([hidden]),[data-plan-stock]:not([hidden])').waitFor();
  const original=await page.evaluate(()=>JSON.stringify(currentProduct.plans));
  for(let i=0;i<4;i++){
   await rows.nth(i).click();await page.waitForTimeout(80);
   assert.equal(await page.evaluate(()=>currentPlanIdx),i);
   const layout=await rows.nth(i).evaluate(row=>{
    const box=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    const meta=row.querySelector('.pp-plan-meta'),facts=[...meta.querySelectorAll('[data-inventory-plan],.plan-fact,.product-detail-rate')].filter(n=>n.getBoundingClientRect().height>0),name=row.querySelector('.pp-plan-name'),price=row.querySelector('.pp-plan-right');
    return{row:box(row),name:box(name),price:box(price),meta:box(meta),facts:facts.map(n=>({text:n.textContent,...box(n)})),font:getComputedStyle(facts[0]).fontSize,bottomGap:row.getBoundingClientRect().bottom-Math.max(...facts.map(n=>n.getBoundingClientRect().bottom),price.getBoundingClientRect().bottom),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(layout.overflow,false);assert.ok(layout.name.right<=layout.price.x,JSON.stringify(layout));
   assert.ok(layout.bottomGap>=8&&layout.bottomGap<=12,JSON.stringify(layout));
   assert.equal(layout.font,'11px');assert.ok(layout.meta.y>=layout.name.bottom&&layout.meta.y-layout.name.bottom<20,JSON.stringify(layout));
   assert.ok(layout.facts.every(f=>f.right<=layout.row.right&&f.bottom<layout.row.bottom));
   if(i===0)assert.ok(layout.row.height>=64&&layout.row.height<=72,JSON.stringify(layout));
   if(i===1)assert.ok(!layout.facts.some(f=>/stokda/.test(f.text)));
   if(i===2){assert.ok(await rows.nth(i).locator('.pp-old-price').isVisible());assert.ok(layout.row.height<=78);}
   results.push({engine:engineName,width,product:product.id,case:i,height:layout.row.height,bottomGap:layout.bottomGap});
   if(engineName==='chrome'&&product.id==='zoom'&&(width===390||width===1440)&&i===0){await rows.first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-after.png`});await page.locator('#pp-plans-container').screenshot({path:`${out}/${width}-rows.png`});}
  }
  assert.ok(await rows.nth(4).getByText('Stokda yoxdur',{exact:true}).isVisible());
  assert.equal(await rows.locator('.plan-fact-warranty:visible').count(),5);
  await rows.nth(5).click();assert.equal(await rows.nth(5).locator('.pp-plan-meta').isVisible(),false);
  assert.equal(await rows.nth(5).evaluate(n=>n.getBoundingClientRect().height),44);
  inventoryError=true;await page.evaluate(()=>MirpanelInventory.refresh());await page.getByText('Stok məlumatı hazırda alınmır.',{exact:false}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Yenidən cəhd et',exact:true}).isVisible());
  inventoryError=false;await page.evaluate(()=>MirpanelInventory.refresh());await rows.first().click();
  assert.equal(await page.evaluate(()=>JSON.stringify(currentProduct.plans)),original);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  if(browserWarnings.length)results.push({engine:engineName,width,product:product.id,browserWarnings});
  await page.close();console.log('PASS',engineName,width,product.id);
 }
 // Before measurements use the same synthetic data, browser, viewport and inventory.
 if(engineName==='chrome')for(const width of [390,1440]){
  const p=cases[0],page=await browser.newPage({viewport:{width,height:1000}});
  await page.route('**/product-page.css*',r=>r.fulfill({contentType:'text/css',body:oldCss}));await page.route('**/product-page.js*',r=>r.fulfill({contentType:'text/javascript',body:oldJs}));
  await page.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/inventory')?{products:[{productId:p.id,scope:'plan',plans:p.plans.map((_,i)=>({planKey:String(i),tracked:true,available:i===4?0:28}))}]}:{}}));
  await page.goto(origin+'/mehsul/'+p.seoSlug+'?before=1');await page.locator('#productPageView[data-detail-enhanced]').waitFor();await page.waitForTimeout(300);
  const rows=page.locator('#pp-plans-container');await rows.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-before.png`});
  results.push({engine:'chrome',width,product:p.id,before:true,heights:await rows.locator('.pp-plan-label').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height))});await page.close();
 }
 for(const mode of ['initial-html','legacy-client']){
  const p=cases[0],page=await browser.newPage({viewport:{width:390,height:1000},javaScriptEnabled:mode!=='initial-html'});
  await page.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/inventory')?{products:[{productId:p.id,scope:'plan',plans:p.plans.map((_,i)=>({planKey:String(i),tracked:true,available:i===4?0:28}))}]}:{}}));
  await page.goto(origin+'/mehsul/'+p.seoSlug+(mode==='legacy-client'?'?legacy=1':''));
  if(mode==='legacy-client')await page.locator('#productPageView[data-detail-enhanced]').waitFor();
  const first=page.locator('#pp-plans-container .pp-plan-label').first();await first.waitFor();
  assert.equal(await first.locator('.pp-plan-meta').count(),1);assert.ok(await first.locator('.plan-fact-warranty').isVisible());
  assert.ok(await first.evaluate(n=>n.getBoundingClientRect().height>=64&&n.getBoundingClientRect().height<=72));
  results.push({engine:engineName,mode,passed:true});await page.close();console.log('PASS',engineName,mode);
 }
 }finally{await browser.close();}
}fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
