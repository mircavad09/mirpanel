import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {activeProductsWithSlugs} from '../mirpanel-admin/product-pages.mjs';
import {detailPlanMetrics,detailBestValueIndex} from '../product-detail-display.mjs';
const root=process.cwd(),live=process.env.MIRPANEL_TEST_LIVE==='1';
const app=live?await(await fetch('https://mirpanel.com/app.js',{cache:'no-store'})).text():fs.readFileSync('app.js','utf8');
const state=extractAdminState(app),active=activeProductsWithSlugs(state.products),widths=[320,390,430,768,1024,1366,1440,1920];
const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
const oldFiles=new Map(['product-page.js','product-page.css','mehsul/capcut-pro.page'].map(f=>[f,execFileSync('git',['show','3d3fb7c:'+f],{encoding:'utf8'})]));
let baseline=false,initialized=true;const counts=new Map(active.map(({product},i)=>[product.id,2188+i*37]));
const server=live?null:http.createServer((req,res)=>{
 let file=decodeURIComponent(new URL(req.url,'http://local').pathname.slice(1))||'index.html';if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';
 const name=path.resolve(root,file);if(!name.startsWith(root+path.sep)||!fs.existsSync(name)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.page':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(baseline&&oldFiles.has(file)?oldFiles.get(file):fs.readFileSync(name));
});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=live?'https://mirpanel.com':`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],writes=[],checks=[],before=[],apiValues=new Map();
try{
 for(const [price,months,expected] of [[12.99,3,4.33],[22.99,6,3.83],[29.99,6,5]])assert.equal(Number(detailPlanMetrics({price,months}).monthly.toFixed(2)),expected);
 assert.equal(detailPlanMetrics({price:12.99,label:'3 aylıq'}).monthly,null);assert.equal(detailPlanMetrics({price:5,months:1}).monthly,null);
 assert.equal(detailPlanMetrics({price:5,label:'6 ay zəmanət'}).warranty,'');assert.equal(detailPlanMetrics({price:5,warrantyMode:'guaranteed',warrantyDuration:6}).warranty,'6 ay zəmanət');
 assert.equal(detailBestValueIndex([{price:10,months:1,bestValue:true},{price:12,months:3},{price:24,months:6}]),2);assert.equal(detailBestValueIndex([{price:1,months:1}],true),-1);
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.addInitScript(()=>{window.__detailListeners=new WeakMap();const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,...args){if(this instanceof Element){const old=window.__detailListeners.get(this)||{};old[type]=(old[type]||0)+1;window.__detailListeners.set(this,old);}return add.call(this,type,...args);};});
 await context.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());if(u.pathname==='/cdn-cgi/rum')return route.fulfill({status:204});if(!['GET','HEAD'].includes(req.method())){writes.push(u.pathname);return route.abort();}
  if(!live&&u.pathname==='/api/product-sales')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({initialized,productId:u.searchParams.get('productId'),productTotal:counts.get(u.searchParams.get('productId'))||0,siteTotal:12741})});
  if(!live&&u.origin!==origin)return route.fulfill({status:200,contentType:'application/json',body:'{}'});return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 page.on('response',async r=>{if(new URL(r.url()).pathname==='/api/product-sales'){try{const j=await r.json();apiValues.set(j.productId,j);}catch{}}});
 async function open(slug,width){await page.setViewportSize({width,height:width===320?568:width<500?844:900});await page.goto(origin+'/mehsul/'+slug,{waitUntil:'networkidle'});await page.waitForSelector('.product-detail-summary');if(initialized)await page.waitForFunction(()=>!document.querySelector('.product-detail-sales').hidden);}
 const position=()=>page.evaluate(()=>({plansY:document.querySelector('.product-page-section-title').getBoundingClientRect().top+scrollY,imageHeight:document.querySelector('.product-page-media').getBoundingClientRect().height,summaryHeight:document.querySelector('.product-detail-summary').getBoundingClientRect().height}));
 for(const width of widths){
  if(!live){baseline=true;await open('capcut-pro',width);before.push({width,...await position()});if(visual)await page.screenshot({path:path.join(visual,`before-${width}.png`)});baseline=false;}
  for(const {product,slug} of active){
   await open(slug,width);await page.locator('#pp-main-img').evaluate(i=>i.decode());
   assert.equal(await page.locator('.product-page-card .product-page-status').count(),1);
   assert.equal(await page.locator('.product-page-availability-badge,.product-page-card .product-page-eyebrow,.product-page-card .product-page-category,.product-page-card .product-page-variant').count(),0);
   assert.equal(await page.locator('.product-detail-heading #pp-main-title').count(),1);
   assert.equal(await page.locator('.product-detail-heading .product-page-status').count(),1);
   const sales=await page.locator('.product-detail-sales').textContent();assert.ok(!sales.includes('təxminən'));
   const expected=apiValues.get(product.id);assert.ok(expected?.initialized);assert.ok(sales.includes(String(expected.productTotal).replace(/\B(?=(\d{3})+(?!\d))/g,' ')));
   const rows=page.locator('#pp-plans-container .pp-plan-label'),best=detailBestValueIndex(product.plans,product.soldOut===true||product.flow==='out_of_stock'||(product.stockEnabled===true&&product.stock!=null&&Number(product.stock)<=0));
   for(let i=0;i<product.plans.length;i++){
    if(product.plans[i].active===false)continue;const row=rows.nth(i);await row.click({position:{x:5,y:5}});
    assert.equal(await page.locator('#pp-plans-container [aria-checked="true"]').count(),1);assert.ok(await page.locator('.product-detail-plan-notes:not([hidden])').count()<=1);
    const m=detailPlanMetrics(product.plans[i]),notes=row.locator('.product-detail-plan-notes');
    assert.equal(await notes.locator('.product-detail-monthly').count(),m.monthly===null?0:1);
    if(m.monthly!==null)assert.equal(await notes.locator('.product-detail-monthly').textContent(),`Ayda cəmi ${m.monthly.toFixed(2)} ₼`);
    assert.equal(await notes.locator('.product-detail-best').count(),i===best?1:0);if(m.warranty)assert.ok((await notes.textContent()).includes(m.warranty));
    assert.equal(await page.locator('.product-detail-savings').count(),m.savings===null?0:1);if(m.savings!==null)assert.ok((await page.locator('.product-detail-savings').textContent()).includes(m.savings.toFixed(2)));
    const expanded=await row.getAttribute('aria-expanded');assert.equal(expanded,await notes.locator(':scope > *').count()>0?'true':'false');assert.equal(await row.getAttribute('aria-controls'),await notes.getAttribute('id'));
    if(visual&&width===390&&product.id==='capcut'&&[2,4].includes(i)){await row.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(visual,`${live?'live':'after'}-capcut-${i===2?'3month':'6month'}-390.png`)});}
   }
   const first=rows.nth(product.plans.findIndex(p=>p.active!==false));await first.focus();await page.keyboard.press('Enter');assert.equal(await first.getAttribute('aria-checked'),'true');
   const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,mainBroken:!document.getElementById('pp-main-img').naturalWidth,minTap:Math.min(...[...document.querySelectorAll('#pp-plans-container .pp-plan-label:not([hidden])')].map(e=>e.getBoundingClientRect().height)),containerListeners:window.__detailListeners.get(document.getElementById('pp-plans-container'))?.click,keyboard:[...document.querySelectorAll('.pp-plan-label')].map(e=>window.__detailListeners.get(e)?.keydown),columns:getComputedStyle(document.getElementById('pp-plans-container')).gridTemplateColumns.split(' ').length}));
   assert.equal(metrics.overflow,0,product.id+'@'+width);assert.equal(metrics.mainBroken,false);assert.ok(metrics.minTap>=44);assert.equal(metrics.containerListeners,1);assert.ok(metrics.keyboard.every(n=>n===1));if(product.id==='capcut'&&width>=1024)assert.equal(metrics.columns,2);
   const pos=await position();if(!live&&product.id==='capcut'&&width<768)assert.ok(pos.plansY<before.find(x=>x.width===width).plansY);
   if(visual&&width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(visual,`${live?'live':'after'}-${product.id}-390.png`)});}
   if(visual&&product.id==='capcut'&&width===1440){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(visual,`${live?'live':'after'}-capcut-1440.png`)});}
   checks.push({width,id:product.id,...pos,...metrics});
  }
 }
 if(!live){initialized=false;await open('capcut-pro',390);assert.equal(await page.locator('.product-detail-sales:not([hidden])').count(),0);}
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const report={mode:live?'live':'local',products:active.length,checks,before,errors,realOrders:0,realReservations:0,writes};if(visual)fs.writeFileSync(path.join(visual,`${live?'live':'local'}-results.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({mode:report.mode,products:active.length,checks:checks.length,capcut:checks.filter(x=>x.id==='capcut'),before,errors,writes,realOrders:0,realReservations:0},null,2));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
