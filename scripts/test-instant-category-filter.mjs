import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {patchHomeCatalog,generateProductListingPageFiles,generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {instantPlanIndices} from '../ready-delivery.mjs';
import cardRenderer from '../catalog-card.js';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const source=fs.readFileSync('app.js','utf8'),data=extractAdminState(source);
const capcut=data.products.find(p=>p.id==='capcut');
const monthProduct={id:'month-test',title:'Aylıq məhsul',plans:[{months:1,price:5.99}]};
assert(cardRenderer.render(monthProduct,0,'/mehsul/test?plan=0',monthProduct.title,5.99,'5.99 ₼').includes('Aylıq məhsul — 1 ay'));
assert(Number(capcut.plans[0].price)>Number(capcut.plans[1].price));
const proof=[{planKey:'0',canOrder:true,fulfillment:{ready:1,automatic:true}},{planKey:'1',canOrder:true,fulfillment:{ready:0,automatic:true}}];
assert.deepEqual(instantPlanIndices(capcut,proof),[0]);
assert.deepEqual(instantPlanIndices(capcut,proof.map(p=>({...p,fulfillment:{ready:1,automatic:true}}))),[1,0]);
assert.deepEqual(instantPlanIndices(capcut,proof,{valid:false}),[]);
assert.deepEqual(instantPlanIndices(capcut,proof.map(p=>({...p,fulfillment:{...p.fulfillment,automatic:false}}))),[]);
assert.deepEqual(instantPlanIndices({...capcut,active:false},proof),[]);
assert.deepEqual(instantPlanIndices({...capcut,supplier:{provider:'epinby'}},proof),[]);
data.products.push({...structuredClone(capcut),id:'future-test',seoSlug:'future-test',title:'Gələcək məhsul',category:'future',bestSeller:false});
data.categories.push({key:'future',name:'Yeni kateqoriya',active:true,order:20},{key:'empty',name:'Boş kateqoriya',active:true,order:21});
const pages=generateProductPageFiles(data.products,data.siteSections,data.cms,data.content);
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');let file=u.pathname.slice(1);
 if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
 try{let body,kind;
  if(!file){body=patchHomeCatalog(fs.readFileSync('index.html','utf8'),data.products,data.categories);kind='text/html';}
  else if(file==='app.js'){body=patchAppSource(source,data);kind='text/javascript';}
  else if(file==='mehsul'){body=generateProductListingPageFiles(data.products,data.siteSections,data.cms,data.categories).get('mehsul.page');kind='text/html';}
  else if(pages.has(file+'.page')){body=pages.get(file+'.page');kind='text/html';}
  else{body=fs.readFileSync(file);kind=({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'text/html';}
  res.setHeader('Content-Type',kind);res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const out='outputs/instant-category-filter';fs.mkdirSync(out,{recursive:true});
try{for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});page.setDefaultTimeout(12000);
  let ready=1,readyIndex=0,automatic=true,fail=false,delay=0;const drafts=[],quotes=[],errors=[];
  page.on('pageerror',e=>{if(!e.message.includes('ResizeObserver'))errors.push(e.message);});
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),json=j=>route.fulfill({json:j});
   if(u.pathname==='/api/payments/inventory'){if(delay)await new Promise(r=>setTimeout(r,delay));return fail?route.fulfill({status:503,json:{}}):json({products:data.products.map(p=>({productId:p.id,scope:'product',available:20,canOrder:true,plans:p.plans.map((_,i)=>({planKey:String(i),active:true,tracked:true,available:20,canOrder:true,fulfillment:{automatic,ready:p.id==='capcut'&&i===readyIndex?ready:0}}))}))});}
   if(u.pathname==='/api/product-sales')return json({productId:u.searchParams.get('productId'),initialized:true,productTotal:5});
   if(u.pathname==='/api/payments/shop/quote'){const body=req.postDataJSON();quotes.push(body);return json({items:body.items.map(x=>({...x,title:'CapCut Pro',planName:capcut.plans[x.planIndex].label,terms:'İzolyasiya edilmiş sınaq',termsVersion:'test',unitCents:Math.round(Number(capcut.plans[x.planIndex].price)*100),fields:[]}))});}
   if(u.pathname==='/api/payments/shop/draft'){const x=req.postDataJSON();drafts.push(x);return json({...x,draftId:x.id,lineId:x.id,quantity:1});}
   if(u.pathname==='/api/homepage-banners')return json({managed:true,banners:[{id:'instant-test-banner',active:true,placement:'side',url:'/mehsul?delivery=instant',linkType:'custom',image:'/assets/support.png',alt:'Hazır hesablar — Anında təhvil'}]});
   if(u.pathname.startsWith('/api/'))return json({});
   if(req.method()!=='GET')throw Error('Unexpected business write '+u.pathname);
   if(u.origin!==origin)return req.resourceType()==='stylesheet'?route.fulfill({contentType:'text/css',body:''}):route.abort();return route.continue();
  });
  await page.goto(origin);await page.waitForFunction(()=>window.MirpanelInventory?.instantValid());
  const tabs=page.locator('.home-filter-tabs'),grid=page.locator('#grid');
  assert.deepEqual((await tabs.locator('button').allTextContents()).slice(0,2),['Hamısı','⚡ Anında təhvil']);
  assert.equal(await tabs.getByText('Boş kateqoriya',{exact:true}).count(),0);
  await tabs.getByRole('tab',{name:'Yeni kateqoriya',exact:true}).click();
  assert.deepEqual(await grid.locator('[data-product-id]').evaluateAll(ns=>ns.map(n=>n.dataset.productId)),['future-test']);
  await tabs.getByRole('tab',{name:'Dizayn proqramları',exact:true}).click();
  assert.deepEqual(await grid.locator('[data-product-id]').evaluateAll(ns=>ns.map(n=>n.dataset.productId)),['capcut','canva']);
  await tabs.getByRole('tab',{name:'⚡ Anında təhvil',exact:true}).click();
  const card=grid.locator('[data-product-id="capcut"]');await card.waitFor();
  assert.equal(await grid.locator('[data-product-id]').count(),1);
  assert.equal(await card.getAttribute('data-instant-plan'),'0');
  assert((await card.locator('.homeCardPrices strong').innerText()).includes(Number(capcut.plans[0].price).toFixed(2)));
  assert((await card.locator('.homeCardOrder').getAttribute('href')).endsWith('?plan=0'));
  if(width>=768)await page.locator('#sortSelect').selectOption('price-desc');assert.equal(await grid.locator('[data-product-id]').count(),1);
  await page.reload();await card.waitFor();assert.equal(await tabs.locator('[aria-selected="true"]').innerText(),'⚡ Anında təhvil');
  ready=0;await page.evaluate(()=>MirpanelInventory.refresh());await grid.getByText('Hazırda anında təhvil verilən hesab yoxdur').waitFor();
  ready=1;await page.evaluate(()=>MirpanelInventory.refresh());await card.waitFor();
  automatic=false;await page.evaluate(()=>MirpanelInventory.refresh());await grid.getByText('Hazırda anında təhvil verilən hesab yoxdur').waitFor();
  automatic=true;fail=true;await page.evaluate(()=>MirpanelInventory.refresh());await grid.getByText('Stok yoxlanıla bilmir.',{exact:false}).waitFor();assert.equal(await grid.locator('[data-product-id]').count(),0);
  fail=false;await grid.getByRole('button',{name:'Yenidən cəhd et'}).click();await card.waitFor();
  if(width<768){await card.locator('.homeCardAdd').click();await page.locator('dialog.mir-cart-drawer[open]').waitFor();assert.equal(drafts.length,1);assert.equal(drafts[0].planIndex,0);assert.equal(await page.evaluate(()=>MirpanelCart.read()[0].planIndex),0);await page.getByRole('button',{name:'Səbəti bağla',exact:true}).click();}
  // Banner is a complete anchor using the same supported shareable route.
  await page.goto(origin);const banner=page.locator('a[data-banner-id="instant-test-banner"]');await banner.waitFor();await banner.click();await page.waitForURL('**/mehsul?delivery=instant');
  const listing=page.locator('.catalog-grid');await listing.locator('[data-instant-plan="0"]').waitFor();assert.equal(await listing.locator('[data-product-id]').count(),1);
  await page.reload();await listing.locator('[data-instant-plan="0"]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const before=await page.evaluate(()=>performance.now());ready=0;
  await page.evaluate(()=>window.dispatchEvent(new Event('mirpanel:catalog-stock-retry')));await listing.getByText('Hazırda anında təhvil verilən hesab yoxdur').waitFor();
  ready=1;await page.evaluate(()=>window.dispatchEvent(new Event('mirpanel:catalog-stock-retry')));await listing.locator('[data-instant-plan="0"]').waitFor();
  fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('mirpanel:catalog-stock-retry')));await listing.getByText('Stok yoxlanıla bilmir.',{exact:false}).waitFor();
  fail=false;await listing.getByRole('button',{name:'Yenidən cəhd et'}).click();await listing.locator('[data-instant-plan="0"]').waitFor();
  if(name==='chrome'&&[390,1440].includes(width))await page.screenshot({path:out+'/synthetic-listing-'+width+'.png'});
  await listing.locator('h3 a').click();await page.waitForURL('**/mehsul/capcut-pro?plan=0');try{await page.locator('#productPageView[data-detail-enhanced]').waitFor();}catch(e){console.log({errors,url:page.url(),body:(await page.locator('body').innerText()).slice(0,500)});throw e;}assert.equal(await page.evaluate(()=>currentPlanIdx),0);
  delay=700;await page.goto(origin+'/?delivery=instant');await grid.getByText('Hazır hesablar yoxlanılır…').waitFor();await card.waitFor();delay=0;await tabs.scrollIntoViewIfNeeded();
  if(name==='chrome'&&[390,1440].includes(width))await page.screenshot({path:out+'/synthetic-home-'+width+'.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  readyIndex=1;await page.evaluate(()=>MirpanelInventory.refresh());assert.equal(await card.getAttribute('data-instant-plan'),'1');assert((await card.locator('.homeCardPrices strong').innerText()).includes(Number(capcut.plans[1].price).toFixed(2)));
  await card.locator('h3 a').click();await page.waitForURL('**/mehsul/capcut-pro?plan=1');await page.locator('#productPageView[data-detail-enhanced]').waitFor();assert.equal(await page.evaluate(()=>currentPlanIdx),1);
  assert.deepEqual(errors,[]);assert.equal(drafts.length,width<768?1:0);
  console.log(JSON.stringify({name,width,category:true,emptyHidden:true,newCategory:true,exactPlan:true,stockRecovery:true,banner:true,directAndRefresh:true,errors,writes:0}));await page.close();
 }}finally{await browser.close();}
}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
