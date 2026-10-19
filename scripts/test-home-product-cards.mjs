import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const root=process.cwd(),catalog=extractAdminState(fs.readFileSync('app.js','utf8'));
const active=catalog.products.filter(p=>p.active!==false),counts=new Map(active.map((p,i)=>[p.id,1000+i*13]));
const originalJs=execFileSync('git',['show','10221ab:stock-display-fix.js'],{encoding:'utf8'}),originalCss=execFileSync('git',['show','10221ab:stock-display-fix.css'],{encoding:'utf8'});
let baseline=false,initialized=true,mismatched=false,writes=0;
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'){writes++;res.writeHead(405);return res.end();}
 const url=new URL(req.url,'http://local');let file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';
 const name=path.resolve(root,file);
 if(!name.startsWith(root+path.sep)||!fs.existsSync(name)||!fs.statSync(name).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.page':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(name)]||'application/octet-stream');
 res.end(baseline&&file==='stock-display-fix.js'?originalJs:baseline&&file==='stock-display-fix.css'?originalCss:fs.readFileSync(name));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
const errors=[],checks=[],apiIds=new Set();
async function open(width){
 const context=await browser.newContext({viewport:{width,height:width<500?844:900},reducedMotion:'reduce'});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(!['GET','HEAD'].includes(req.method())){writes++;return route.abort();}
  if(url.origin===origin)return route.continue();
  if(url.pathname==='/api/product-sales'){
   const id=url.searchParams.get('productId');apiIds.add(id);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({initialized,productId:mismatched?'unknown-other-id':id,productTotal:counts.get(id)||0,siteTotal:12000})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForSelector('#grid .card');
 await page.waitForTimeout(500);return page;
}
async function snapshot(page){return page.locator('#grid .card').evaluateAll(cards=>cards.map(c=>({id:c.dataset.productId,href:c.getAttribute('href')||c.querySelector('.homeCardOrder')?.getAttribute('href'),image:c.querySelector('img').getAttribute('src'),price:(c.querySelector('.cornerPrice')||c.querySelector('.homeCardPrices strong')).textContent})));}
async function scrollCards(page){await page.evaluate(()=>window.scrollTo(0,document.getElementById('grid').getBoundingClientRect().top+scrollY-document.querySelector('#mainHeader').getBoundingClientRect().height-12));}
try{
 for(const width of [320,390,430,768,1440]){
  baseline=true;const before=await open(width);const old=await snapshot(before);
  const protectedBefore=await before.locator('#homeHero,.stories-section,.site-header,.footer').evaluateAll(els=>els.map(e=>[e.id,e.className,e.innerHTML]));
  await scrollCards(before);if(visual)await before.screenshot({path:path.join(visual,`before-${width}.png`)});
  await before.context().close();baseline=false;const page=await open(width);
  await page.waitForFunction(()=>[...document.querySelectorAll('#grid .homeCardSales')].every(e=>!e.hidden));
  assert.deepEqual(await snapshot(page),old,'IDs/order/images/prices/links changed');
  const protectedAfter=await page.locator('#homeHero,.stories-section,.site-header,.footer').evaluateAll(els=>els.map(e=>[e.id,e.className,e.innerHTML]));
  assert.deepEqual(protectedAfter,protectedBefore,'Protected homepage DOM changed');
  assert.equal(await page.locator('#grid .cornerPrice,#grid .btn.primary').count(),0);
  for(const p of active){
   const card=page.locator(`#grid [data-product-id="${p.id}"]`);assert.equal(await card.count(),1);
   assert.equal(await card.locator('.homeCardSales').textContent(),`≈ ${String(counts.get(p.id)).replace(/\B(?=(\d{3})+(?!\d))/g,' ')}+ satılıb`);
   const amount=p.id==='tiktok_jeton'?10:Math.min(...p.plans.filter(v=>v.price>0).map(v=>v.price));
   const plan=p.plans.find(v=>Number(v.price)===amount),oldCents=Math.round(Number(plan?.regularPrice)*100),cents=Math.round(amount*100);
   const discounted=Number.isSafeInteger(oldCents)&&oldCents>cents&&cents>0;
   assert.equal(await card.locator('.homeCardPrices del').count(),discounted?1:0);
   assert.equal(await card.locator('.homeCardDiscount').count(),discounted?1:0);
   if(discounted)assert.equal(await card.locator('.homeCardDiscount').textContent(),`-${Math.round((oldCents-cents)/oldCents*100)}%`);
   assert.equal(await card.locator('.homeCardLabels').getByText('🔥 Ən çox satılan',{exact:true}).count(),p.bestSeller===true?1:0);
   assert.equal(await card.locator('.homeCardLabels').getByText('⚡ Anında',{exact:true}).count(),p.deliveryType==='automatic'?1:0);
   assert.ok(await card.evaluate(e=>{const r=e.getBoundingClientRect(),button=e.querySelector('.homeCardOrder').getBoundingClientRect(),image=e.querySelector('.imgWrap').getBoundingClientRect(),price=e.querySelector('.homeCardPrices').getBoundingClientRect();return button.width>=44&&button.height>=44&&button.right<=r.right+1&&price.top>=image.bottom&&e.scrollWidth<=e.clientWidth+1;}));
  }
  const arrow=page.locator('.homeCardOrder').first();await arrow.focus();
  assert.ok(await arrow.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
  const g=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,columns:getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length}));
  assert.equal(g.overflow,0);if(width<500)assert.equal(g.columns,2);
  await scrollCards(page);if(visual)await page.screenshot({path:path.join(visual,`after-${width}.png`)});
  checks.push({width,...g,cards:old.length,discounts:true,canonicalSales:true});
  // Compare the existing filter/sort/search results, not new filtering rules.
  await page.locator('.site-header-search input:visible').first().fill('Spotify');assert.ok((await snapshot(page)).every(c=>/spotify/.test(c.id)));
  await page.locator('.site-header-search input:visible').first().fill('');await page.selectOption('#sortSelect','price-asc',{force:true});
  baseline=true;const compare=await open(width);await compare.selectOption('#sortSelect','price-asc',{force:true});assert.deepEqual(await snapshot(page),await snapshot(compare));await compare.context().close();baseline=false;
  await page.locator('.homeCardOrder').first().click();await page.waitForURL('**/mehsul/**');assert.equal(await page.locator('#productPageView').count(),1);
  await page.context().close();
 }
 initialized=false;let page=await open(390);assert.equal(await page.locator('.homeCardSales:not([hidden])').count(),0);assert.ok(!(await page.locator('#grid').textContent()).includes('0+ satılıb'));await page.context().close();
 initialized=true;mismatched=true;page=await open(390);assert.equal(await page.locator('.homeCardSales:not([hidden])').count(),0);await page.context().close();mismatched=false;
 page=await open(390);
 const unit=await page.evaluate(()=>{const p=DATA.products[0];return [undefined,0,4,5,10].map(old=>{const doc=new DOMParser().parseFromString(cardHTML({...p,id:'unit',plans:[{price:5,regularPrice:old}]},0),'text/html');return{old:doc.querySelectorAll('del').length,discount:doc.querySelector('.homeCardDiscount')?.textContent||null};});});
 assert.deepEqual(unit,[{old:0,discount:null},{old:0,discount:null},{old:0,discount:null},{old:0,discount:null},{old:1,discount:'-50%'}]);await page.context().close();
 assert.equal(apiIds.size,active.length);assert.deepEqual(errors,[]);assert.equal(writes,0);
 console.log(JSON.stringify({checks,uninitializedHidden:true,wrongIdHidden:true,noInventedBadges:true,priceVariants:unit,appErrors:errors,realOrders:0,realReservations:0,protectedDataWrites:writes},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
