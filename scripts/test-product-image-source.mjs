import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {activeProductsWithSlugs,generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
const live=process.env.MIRPANEL_TEST_LIVE==='1',root=process.cwd();
const source=live?await(await fetch('https://mirpanel.com/app.js',{cache:'no-store'})).text():fs.readFileSync('app.js','utf8');
const state=extractAdminState(source),active=activeProductsWithSlugs(state.products);
const generated=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content);
const oldApp=execFileSync('git',['show','1bd0761:app.js'],{encoding:'utf8'});
const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
// Simulate an existing browser retaining the old, permanently versioned catalog.
const server=live?null:http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');let file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';
 const absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)){res.writeHead(404);return res.end();}
 const type=({'.html':'text/html','.page':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream';
 res.setHeader('Content-Type',type);res.end(file==='app.js'&&url.searchParams.get('v')==='20260804-mobile-layout-1'?oldApp:fs.readFileSync(absolute));
});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],writes=[],checks=[],audit=[],failedResources=new Set();
const canonicalImage=value=>new URL(value,origin+'/').href;
const version=html=>html.match(/src="\/app\.js\?v=([^"]+)/)?.[1];
try{
 if(!live){
  const html=[...generated.values()][0],again=[...generateProductPageFiles(state.products,state.siteSections,state.cms,state.content).values()][0];
  assert.equal(version(html),version(again),'Same catalog must have stable cache key');
  const edited=structuredClone(state.products);edited.find(p=>p.active!==false).image='uploads/products/test-new-version.png?v=2';
  const changed=[...generateProductPageFiles(edited,state.siteSections,state.cms,state.content).values()][0];
  assert.notEqual(version(html),version(changed),'Admin image changes must invalidate detail JS');
  assert.ok(changed.includes('/uploads/products/test-new-version.png?v=2'));
  assert.ok(version(html).startsWith('catalog-'));
 }
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/cdn-cgi/rum')return route.fulfill({status:204});
  if(!['GET','HEAD'].includes(req.method())){writes.push(url.pathname);return route.abort();}
  if(url.pathname.startsWith('/api/')&&!live)return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  if(!live&&url.origin!==origin)return route.fulfill({status:200,body:''});
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failedResources.add(new URL(r.url()).pathname);});
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 for(const width of [320,390,430,768,1440]){
  await page.setViewportSize({width,height:width===320?568:width<500?844:900});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#grid .homeProductCard');
  const home=await page.locator('#grid .homeProductCard').evaluateAll(cards=>Object.fromEntries(cards.map(c=>[c.dataset.productId,{image:c.querySelector('img').src,href:c.querySelector('.homeCardOrder').getAttribute('href')}])));
  assert.equal(Object.keys(home).length,active.length);
  if(visual&&[390,1440].includes(width))await page.screenshot({path:path.join(visual,`${live?'live':'local'}-home-${width}.png`)});
  // Follow the actual homepage action, including the canonical navigation handler.
  await page.locator('#grid [data-product-id="capcut"] .homeCardOrder').click();await page.waitForURL('**/mehsul/capcut-pro');
  for(const {product,slug} of active){
   if(product.id!=='capcut')await page.goto(origin+home[product.id].href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(id=>document.body.dataset.productId===id&&document.getElementById('pp-main-img')?.complete&&document.getElementById('pp-main-img')?.naturalWidth>0&&document.querySelector('.product-detail-summary'),product.id);
   const img=page.locator('#pp-main-img');
   const result=await page.evaluate(()=>{const i=document.getElementById('pp-main-img'),r=i.getBoundingClientRect(),frame=i.closest('.product-page-media').getBoundingClientRect();return{id:document.body.dataset.productId,image:i.src,width:r.width,height:r.height,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,overflow:document.documentElement.scrollWidth-innerWidth,broken:!i.complete||!i.naturalWidth,frameGap:Math.abs(frame.width-r.width),title:document.getElementById('pp-main-title').textContent};});
   assert.equal(result.id,product.id);assert.equal(result.image,home[product.id].image,`${product.id}@${width} homepage/detail mismatch`);assert.equal(result.image,canonicalImage(product.image));
   assert.equal(result.overflow,0,`${product.id}@${width} overflow`);assert.equal(result.broken,false);assert.ok(result.frameGap<=2.1,JSON.stringify({width,...result}));
   assert.ok(Math.abs(result.width/result.height-result.naturalWidth/result.naturalHeight)<.02,`${product.id} image stretched/cropped`);
   if(width===390)audit.push({id:product.id,name:product.title,home:product.image,detail:new URL(result.image).pathname+new URL(result.image).search,canonicalMatch:true});
   if(visual&&[390,1440].includes(width))await page.screenshot({path:path.join(visual,`${live?'live':'local'}-${product.id}-${width}.png`)});
   const button=page.locator('#pp-order-btn');assert.ok(await button.isVisible());
   if(await button.isEnabled()){
    await button.click();await page.waitForFunction(()=>{const m=document.getElementById('modal');return m&&getComputedStyle(m).display!=='none';});
    assert.equal(await page.locator('#orderConfirmationConfirm').count(),1,'Original confirmation step missing');
    await page.keyboard.press('Escape');
    // Reload closes the existing modal without proceeding or creating a reservation.
    await page.goto(origin+home[product.id].href,{waitUntil:'domcontentloaded'});
   }
   checks.push({width,id:product.id,imageMatch:true,overflow:0,broken:0});
  }
 }
 if(!live){
  await page.goto(origin+'/mehsul/capcut-pro',{waitUntil:'networkidle'});
  await page.route('**/missing-product-image.png',r=>r.fulfill({status:404,body:''}));
  // A deliberately failed image has one expected resource error; application errors remain forbidden.
  const start=errors.length;await page.locator('#pp-main-img').evaluate(i=>i.src='/missing-product-image.png');
  await page.locator('[data-product-image-fallback]').waitFor();assert.equal(await page.locator('#pp-main-img').isVisible(),false);
  assert.ok(errors.slice(start).every(e=>e.startsWith('Failed to load resource:')));errors.splice(start);
 }
 if(failedResources.size)console.log('FAILED_RESOURCES',JSON.stringify([...failedResources]));
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 if(visual){const table=['| Canonical ID | Məhsul | Ana səhifə şəkli | Detal şəkli | 5 ölçü |','|---|---|---|---|---|',...audit.map(r=>`| ${r.id} | ${r.name} | ${r.home} | ${r.detail} | Uyğundur |`)].join('\n');fs.writeFileSync(path.join(visual,`${live?'live':'local'}-22-products.md`),table);}
 console.log(JSON.stringify({mode:live?'live':'local',products:active.length,checks:checks.length,widths:[320,390,430,768,1440],canonicalMatch:true,broken:0,overflow:0,consoleErrors:errors,realOrders:0,realReservations:0,writes,audit},null,2));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
