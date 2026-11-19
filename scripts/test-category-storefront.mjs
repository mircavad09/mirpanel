import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {extractAdminState,patchAppSource,normalizeAdminPayload} from '../mirpanel-admin/core.mjs';
import {patchHomeCatalog,generateProductListingPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const original=fs.readFileSync('app.js','utf8'),home=fs.readFileSync('index.html','utf8');
let data=extractAdminState(original),stock=3;
const count=data.products.filter(p=>p.active!==false).length;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const file=url.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+url.pathname.slice(18):url.pathname.slice(1);
 try{
  let body,kind;
  if(url.pathname==='/'){body=patchHomeCatalog(home,data.products,data.categories);kind='text/html; charset=utf-8';}
  else if(url.pathname==='/app.js'){body=patchAppSource(original,data);kind='text/javascript';}
  else if(url.pathname==='/mehsul'){body=generateProductListingPageFiles(data.products,data.siteSections,data.cms,data.categories).get('mehsul.page');kind='text/html; charset=utf-8';}
  else{body=fs.readFileSync(file);kind=({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'text/html';}
  res.setHeader('Content-Type',kind);res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,out='outputs/category-storefront';fs.mkdirSync(out,{recursive:true});
try{for(const [engineName,engine] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch(engineName==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),drafts=[];
  page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
  await page.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url()),json=data=>route.fulfill({json:data});
   if(u.pathname==='/api/payments/inventory')return json({products:data.products.map(p=>({productId:p.id,scope:'product',available:stock,canOrder:true,plans:p.plans.map((_,i)=>({planKey:String(i),active:true,tracked:true,available:stock,canOrder:true,fulfillment:{automatic:true,ready:1}}))}))});
   if(u.pathname==='/api/product-sales')return json({productId:u.searchParams.get('productId'),initialized:true,productTotal:2319});
   if(u.pathname==='/api/payments/shop/quote')return json({items:req.postDataJSON().items.map(x=>({...x,title:'Zoom Pro',planName:'1 ay',terms:'Sınaq şərti',termsVersion:'fixture',unitCents:998,available:stock,fields:[]}))});
   if(u.pathname==='/api/payments/shop/draft'){const x=req.postDataJSON();drafts.push(x);return json({...x,draftId:x.id,lineId:x.id,quantity:1});}
   if(u.pathname.startsWith('/api/'))return json({});
   if(u.origin!==origin)return route.abort();
   return route.continue();
  });
  await page.goto(origin);await page.waitForFunction(()=>!!window.MirpanelInventory);
  const grid=page.locator('#grid'),sections=grid.locator('.home-product-section');
  assert.equal(await sections.count(),6);
  assert.equal(await sections.first().locator('.homeProductCard').first().evaluate(n=>getComputedStyle(n).opacity),'1');
  assert.equal(await grid.locator('.home-featured .homeProductCard').count(),4);
  const unique=await sections.locator('[data-product-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.productId));
  assert.equal(new Set(unique).size,count);assert.equal(unique.length,count);
  assert.equal(await grid.getByRole('heading',{name:'Steam oyunları',exact:true}).count(),0);
  assert.equal(await page.locator('.home-name-group:not([aria-hidden]) a').count(),count);
  const design=sections.filter({has:page.getByRole('heading',{name:'Dizayn proqramları',exact:true})});
  assert.deepEqual(await design.locator('[data-product-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.productId)),['capcut','canva']);
  assert.equal(await design.locator('.home-section-grid').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),width<768?2:5);
  await design.locator('[data-product-id="capcut"] .homeCardInstant').waitFor();
  await design.locator('[data-product-id="capcut"] .homeCardSales').getByText('2 319+ dəfə satılıb',{exact:true}).waitFor();
  await design.getByText('Son 3 ədəd',{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(engineName==='chrome'&&[390,1440].includes(width)){
   await grid.evaluate(n=>scrollTo(0,n.getBoundingClientRect().top+scrollY-130));
   await page.screenshot({path:out+'/preview-'+width+'.png'});
  }
  await design.getByRole('link',{name:'Hamısına bax →',exact:true}).click();
  await page.waitForURL('**/mehsul?category=design');
  try{await page.waitForFunction(()=>document.querySelector('.catalog-grid')&&[...document.querySelectorAll('.catalog-grid .homeProductCard')].filter(n=>!n.hidden).length===2,{},{timeout:7000});}
  catch(e){console.log(await page.evaluate(()=>({url:location.href,source:!!document.getElementById('catalogCartProducts'),ids:[...document.querySelectorAll('.catalog-grid [data-product-id]')].map(n=>[n.dataset.productId,n.hidden]),body:document.body.textContent.slice(-800)})));throw e;}
  assert.deepEqual(await page.locator('.catalog-grid .homeProductCard:not([hidden])').evaluateAll(nodes=>nodes.map(n=>n.dataset.productId)),['capcut','canva']);
  await page.goto(origin+'/?search=CapCut');
  await page.waitForFunction(()=>document.querySelector('#grid .homeProductCard'));
  assert.equal(await grid.locator('.homeProductCard').count(),1);
  await page.goto(origin);await page.waitForFunction(()=>!!window.MirpanelInventory);
  const zoom=grid.locator('.home-featured [data-product-id="zoom"]');
  await page.evaluate(()=>{
   const previous=MirpanelInventory.refresh;
   MirpanelInventory.refresh=async(...args)=>{const result=await previous(...args);renderGrid();return result;};
  });
  await zoom.locator('.homeCardAdd').click();
  const consent=page.locator('dialog.cart-entry[open]');await consent.waitFor();
  await consent.getByRole('button',{name:'Bağla',exact:true}).click();
  // The publisher and admin normalization must support new and reordered categories.
  const previous=data;
  const additions=Array.from({length:12},(_,i)=>({...structuredClone(previous.products[0]),id:'steam-fixture-'+i,_stableId:'steam-fixture-'+i,seoSlug:'steam-fixture-'+i,category:'steam',title:'Sınaq Steam '+i,bestSeller:i===0}));
  data=normalizeAdminPayload({...previous,products:[...previous.products,...additions]});
  data.categories.find(c=>c.key==='steam').name='Steam sınaq';
  data.categories.find(c=>c.key==='steam').order=0;
  await page.goto(origin);
  await grid.getByRole('heading',{name:'Steam sınaq',exact:true}).waitFor();
  const steam=sections.filter({has:page.getByRole('heading',{name:'Steam sınaq',exact:true})});
  assert.equal(await steam.locator('.homeProductCard:visible').count(),width<768?4:10);
  assert.equal(await sections.first().getByRole('heading',{level:2}).textContent(),'Steam sınaq');
  data.categories.find(c=>c.key==='steam').active=false;
  await page.reload();assert.equal(await grid.getByRole('heading',{name:'Steam sınaq',exact:true}).count(),0);
  data=previous;
  console.log('PASS '+engineName+' '+width+' category mapping, featured, real SKU facts, search, link, cart, empty/add/hide/order and two-row limit');
  await page.close();
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
