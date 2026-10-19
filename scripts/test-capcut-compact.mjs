import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {planMetrics,formatPrice} from '../mirpanel-admin/public/product-plan-utils.mjs';
import {serviceHoursMilestone} from '../capcut-detail.mjs';
const live=process.env.MIRPANEL_TEST_LIVE==='1',root=process.cwd(),originLive='https://mirpanel.com';
const state=extractAdminState(live?await(await fetch(originLive+'/app.js',{cache:'no-store'})).text():fs.readFileSync('app.js','utf8'));
const product=state.products.find(p=>p.id==='capcut');assert.equal(product.plans.length,6);
const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
let baseline=false,initialized=true;const baselineFiles=new Map(['product-page.js','product-page.css','mehsul/capcut-pro.page'].map(file=>[file,execFileSync('git',['show','8d23780:'+file],{encoding:'utf8'})]));
const server=live?null:http.createServer((req,res)=>{
 let file=decodeURIComponent(new URL(req.url,'http://local').pathname.slice(1))||'index.html';if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';
 const name=path.resolve(root,file);if(!name.startsWith(root+path.sep)||!fs.existsSync(name)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.page':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
 res.end(baseline&&baselineFiles.has(file)?baselineFiles.get(file):fs.readFileSync(name));
});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=live?originLive:`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],writes=[],apiIds=new Set(),checks=[],beforeMetrics=[];
const expectedSales=live?await(await fetch('https://mirpanel.onrender.com/api/product-sales?productId=capcut')).json():{initialized:true,productId:'capcut',productTotal:2188,siteTotal:12741};
async function open(width,route='/mehsul/capcut-pro'){
 const context=await browser.newContext({viewport:{width,height:width===320?568:width===390?844:width===430?932:900},reducedMotion:'reduce'});
 await context.route('**/*',r=>{
  const req=r.request(),u=new URL(req.url());if(u.pathname==='/cdn-cgi/rum')return r.fulfill({status:204});
  if(!['GET','HEAD'].includes(req.method())){writes.push(u.pathname);return r.abort();}
  if(u.pathname==='/api/product-sales'){apiIds.add(u.searchParams.get('productId'));if(!live)return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...expectedSales,productId:u.searchParams.get('productId'),initialized})});}
  if(!live&&u.origin!==origin)return r.fulfill({status:200,contentType:'application/json',body:'{}'});
  return r.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(origin+route,{waitUntil:'networkidle'});await page.waitForSelector('.product-detail-summary');
 if(initialized)await page.waitForFunction(()=>!document.querySelector('.product-detail-sales').hidden);
 return page;
}
async function layout(page){return page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};const list=document.querySelector('#pp-similar-list');return{card:rect('.product-page-card'),similar:rect('.product-page-similar'),overflow:document.documentElement.scrollWidth-innerWidth,planColumns:getComputedStyle(document.getElementById('pp-plans-container')).gridTemplateColumns.split(' ').length,plans:[...document.querySelectorAll('#pp-plans-container .pp-plan-label')].map(e=>({height:e.getBoundingClientRect().height,scroll:e.scrollHeight>e.clientHeight+1})),similarScroll:list.scrollHeight>list.clientHeight+1,similarCount:list.children.length,similarColumns:getComputedStyle(list).gridTemplateColumns.split(' ').length,broken:[...document.querySelectorAll('.product-page-media img:not(.product-page-media-backdrop),#pp-similar-list img')].filter(e=>e.complete&&!e.naturalWidth).length,image:document.getElementById('pp-main-img').src};});}
try{
 const start=Date.parse('2024-01-01T00:00:00+04:00');
 assert.equal(serviceHoursMilestone(start+24552*3600000),24000);assert.equal(serviceHoursMilestone(start+24999*3600000),24000);assert.equal(serviceHoursMilestone(start+25000*3600000),25000);assert.equal(serviceHoursMilestone(start-1),null);assert.equal(serviceHoursMilestone(start,'invalid'),null);
 for(const width of [320,390,430,768,1024,1366,1440,1920]){
  let before;
  if(!live){baseline=true;const old=await open(width);before=await layout(old);beforeMetrics.push({width,...before});if(visual)await old.screenshot({path:path.join(visual,`before-${width}.png`)});await old.context().close();baseline=false;}
  const page=await open(width);
  await page.locator('.product-page-media img:not(.product-page-media-backdrop),#pp-similar-list img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode();})));
  const result=await layout(page);
  assert.equal(result.overflow,0,JSON.stringify({width,...result}));assert.equal(result.broken,0);assert.equal(result.similarScroll,false);assert.equal(result.similarCount,8);assert.equal(result.similarColumns,2);assert.equal(result.planColumns,width>=1024?2:1);
  assert.ok(result.plans.every(p=>p.height>=44&&!p.scroll));
  if(width>=1024){assert.ok(Math.abs(result.card.y-result.similar.y)<2);assert.ok(Math.abs(result.card.bottom-result.similar.bottom)<2);if(before)assert.ok(result.card.height<before.card.height*.85,`${width}: panel not compact enough ${result.card.height}/${before.card.height}`);}
  assert.equal(await page.locator('#pp-main-img').getAttribute('src'),'/'+product.image);
  assert.match(await page.locator('.product-detail-sales').textContent(),/təxminən/);assert.ok((await page.locator('.product-detail-sales').textContent()).includes(String(expectedSales.productTotal).replace(/\B(?=(\d{3})+(?!\d))/g,' ')));
  assert.ok((await page.locator('.product-detail-trust').textContent()).includes('10 000+ tamamlanmış sifariş'));assert.ok((await page.locator('.product-detail-trust').textContent()).includes('saat aktiv xidmət'));
  assert.ok(!(await page.locator('.product-detail-trust').textContent()).includes('avtomatik'));
  const links=await page.locator('#pp-similar-list a').evaluateAll(els=>els.map(e=>e.getAttribute('href')));assert.equal(new Set(links).size,8);assert.ok(!links.includes('/mehsul/capcut-pro'));
  for(const href of links)assert.ok(href.startsWith('/mehsul/'));
  for(let i=0;i<6;i++){
   const row=page.locator('#pp-plans-container .pp-plan-label').nth(i);await row.click();const m=planMetrics(product.plans[i]);
   assert.equal(await page.locator('.product-detail-summary-prices strong').textContent(),`${formatPrice(m.price)} ₼`);
   assert.equal(await page.locator('.product-detail-savings').count(),m.savings===null?0:1);
   if(m.savings!==null){assert.equal(await page.locator('.product-detail-savings').textContent(),`✓ Bu paketlə ${formatPrice(m.savings)} ₼ qənaət edirsiniz`);assert.equal(await page.locator('.product-detail-summary-prices del').textContent(),`${formatPrice(m.oldPrice)} ₼`);assert.equal(await page.locator('.product-detail-summary-prices .product-detail-best').textContent(),`-${m.discount}%`);}
  }
  await page.locator('#pp-plans-container .pp-plan-label').first().click();
  const tabs=await page.locator('.product-page-tab').allTextContents();assert.ok(tabs.includes('Məhsul haqqında'));assert.ok(!tabs.some(t=>/Necə sifariş|Rəylər/.test(t)));
  if(visual){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(visual,`${live?'live':'after'}-${width}.png`)});}
  const lines=await page.locator('.pp-plan-name').evaluateAll(names=>names.map(name=>{const r=document.createRange();r.selectNodeContents(name.firstChild);return r.getClientRects().length;}));assert.ok(lines.every(n=>n<=2),`${width}: plan name exceeds 2 lines: ${lines}`);
  if(width===1440){await page.locator('#pp-similar-list a').first().click();await page.waitForURL(origin+links[0]);assert.notEqual(await page.locator('body').getAttribute('data-product-id'),'capcut');await page.goBack({waitUntil:'networkidle'});await page.waitForSelector('.product-detail-summary');}
  await page.locator('#pp-order-btn').evaluate(button=>{button.click();button.click();});assert.equal(await page.locator('#orderConfirmationConfirm').count(),1);
  checks.push({width,...result});await page.context().close();
 }
 if(!live){
  initialized=false;const page=await open(390);assert.equal(await page.locator('.product-detail-sales:not([hidden])').count(),0);await page.context().close();initialized=true;
  for(const slug of ['spotify-premium','netflix-sexsi','google-ai-pro-v3','amazon-prime-video']){baseline=true;const old=await open(1440,'/mehsul/'+slug);const markup=await old.locator('#productPageView').innerHTML();await old.context().close();baseline=false;const current=await open(1440,'/mehsul/'+slug);assert.equal(await current.locator('#productPageView').innerHTML(),markup,slug+' changed');await current.context().close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.ok(apiIds.has('capcut'));
 const report={mode:live?'live':'local',before:beforeMetrics,checks,serviceHours:serviceHoursMilestone(),consoleErrors:errors,realOrders:0,realReservations:0,writes};
 if(visual)fs.writeFileSync(path.join(visual,`${live?'live':'local'}-results.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
