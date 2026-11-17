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
const out='outputs/selected-package';fs.mkdirSync(out,{recursive:true});
const state=extractAdminState(fs.readFileSync('app.js','utf8'));
const cases=['netflix','prime','capcut'].map(id=>state.products.find(p=>p.id===id)).filter(Boolean);
assert.equal(cases.length,3);
for(const product of cases){product.deliveryText='';product.deliveryType='manual';product.soldOut=false;product.stockEnabled=true;product.epinbyGroup=false;product.plans=[
 {label:'1 ay',months:1,price:9.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'3 ay',months:3,price:19.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:25},
 {label:'Endirimli paket',months:1,price:9.98,regularPrice:29.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Uzun adlı şəxsi hesab — bütün cihazlarda istifadə üçün geniş imkanlar və əlavə üstünlüklər',months:1,price:1299.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Hazırda bitmiş paket',months:1,price:9.98,warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:28},
 {label:'Əlavə məlumatsız paket',months:1,price:9.98,stockVisibility:'hide'}
 ];}
const game=structuredClone(cases[0]);game.id='free_fire';game.title='Free Fire';game.seoSlug='free-fire';
game.supplier=undefined;game.epinbyGroup=true;game.plans=game.plans.map((p,i)=>({...p,id:String(684+i),supplier:{provider:'epinby',productId:684+i,type:'TOPUP',fields:[{key:'player_id',required:true}]}}));game.deliveryText='';cases.push(game);
const gameIndex=state.products.findIndex(p=>p.id===game.id);
if(gameIndex<0)state.products.push(game);else state.products[gameIndex]=game;
for(const p of cases)p.formFields=[];
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
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
  let failed=false,ready=1,auto=true;const errors=[],drafts=[],forbidden=[];
  page.on('pageerror',e=>{if(!e.message.includes('ResizeObserver'))errors.push(e.message);});
  const fulfillment=i=>({ready:i===0?ready:i===2?1:0,automatic:i===0?auto:i!==2,allowWaiting:i===0||i===1});
  await page.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.pathname==='/sebet')return route.fulfill({contentType:'text/html',body:'<h1>Sintetik səbət</h1>'});
   if(u.pathname==='/api/payments/inventory')return route.fulfill(failed?{status:503,json:{}}:{json:{products:cases.map(p=>({productId:p.id,scope:'plan',plans:p.plans.map((_,i)=>({planKey:String(i),tracked:true,available:i===4?0:50,canOrder:i!==4,...(p.id==='free_fire'?{}:{fulfillment:fulfillment(i)})}))}))}});
   if(u.pathname==='/api/payments/shop/quote'){
    const {items}=JSON.parse(r.postData()),p=cases.find(p=>p.id===items[0].productId),index=items[0].planIndex,plan=p.plans[index];
    return route.fulfill({json:{totalCents:Math.round(plan.price*100),balanceCents:5000,items:[{productId:p.id,planIndex:index,title:p.title,planName:plan.label,unitCents:Math.round(plan.price*100),standardCents:Math.round(plan.price*100),fields:[],terms:'Sintetik paket şərtləri.',termsVersion:'fixture-terms-'+index,available:50,note:'',accountCheck:false}]}});
   }
   if(u.pathname==='/api/payments/shop/draft'&&r.method()==='POST'){
    const input=JSON.parse(r.postData());drafts.push(input);
    return route.fulfill({json:{draftId:input.id,lineId:input.id,productId:input.productId,planIndex:input.planIndex,termsVersion:input.termsVersion,matchingDraftIds:[],maskedDetails:[],unitCents:Math.round(product.plans[input.planIndex].price*100),title:product.title,planName:product.plans[input.planIndex].label}});
   }
   if(u.pathname==='/api/payments/shop/drafts')return route.fulfill({json:{items:[]}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   if(r.method()!=='GET'){forbidden.push(u.pathname);return route.abort();}
   if(u.origin!==origin)return route.abort();return route.continue();
  });
  await page.goto(origin+'/mehsul/'+product.seoSlug);
  await page.locator('#productPageView[data-detail-enhanced]').waitFor();
  const rows=page.locator('#pp-plans-container .pp-plan-label');
  const expected=product.id==='free_fire'?'Ödənişdən sonra avtomatik icra olunur':'Anında təqdim olunur';
  await rows.first().getByText(expected,{exact:true}).waitFor();
  const original=await page.evaluate(()=>JSON.stringify(currentProduct.plans));
  async function assertSelection(index){
   assert.equal(await rows.filter({has:page.locator('.pp-plan-meta:visible')}).count(),1);
   assert.equal(await rows.locator('.pp-plan-meta:visible').count(),1);
   assert.equal(await rows.nth(index).getAttribute('aria-expanded'),'true');
   assert.equal(await rows.filter({has:page.locator('.pp-plan-meta:visible')}).getAttribute('aria-checked'),'true');
   for(const other of [0,1,2,3,5].filter(i=>i!==index)){
    assert.equal(await rows.nth(other).locator('.pp-plan-meta').isVisible(),false);
    assert.equal(await rows.nth(other).locator('.pp-plan-price-meta').isVisible(),false);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const layout=await rows.nth(index).evaluate(n=>{const name=n.querySelector('.pp-plan-name').getBoundingClientRect(),price=n.querySelector('.pp-plan-right').getBoundingClientRect();return{nameRight:name.right,priceLeft:price.left};});
   assert.ok(layout.nameRight<=layout.priceLeft+1,JSON.stringify({width,...layout}));
   assert.ok((await page.locator('.product-detail-summary').textContent()).includes((await rows.nth(index).locator('.pp-new-price').textContent())));
  }
  await assertSelection(0);
  assert.ok((await rows.nth(1).boundingBox()).height<=50);
  for(const index of [1,2,3,0]){
   await rows.nth(index).locator('.pp-new-price').click();
   await assertSelection(index);
   const text=await rows.nth(index).locator('.plan-fact-delivery').textContent();
   assert.equal(await page.locator('.product-page-delivery strong').textContent(),text);
  }
  if(product.id!=='free_fire'){
   ready=0;await page.evaluate(()=>MirpanelInventory.refresh());await rows.first().getByText('15–30 dəqiqə ərzində tamamlanır',{exact:true}).waitFor();
   ready=1;auto=false;await page.evaluate(()=>MirpanelInventory.refresh());assert.equal(await rows.first().locator('.is-instant').count(),0);
   auto=true;await page.evaluate(()=>MirpanelInventory.refresh());await rows.first().getByText('Anında təqdim olunur',{exact:true}).waitFor();
  }
  failed=true;await page.evaluate(()=>MirpanelInventory.refresh());await rows.first().getByText('Təhvil məlumatı yoxlanılır…',{exact:true}).waitFor();
  assert.equal(await rows.first().locator('.plan-fact-stock:visible').count(),0);
  failed=false;await page.evaluate(()=>MirpanelInventory.refresh());await rows.first().getByText(expected,{exact:true}).waitFor();
  await assertSelection(0);
  if(engineName==='chrome'){
   await page.locator('#pp-plans-container').screenshot({path:out+'/'+product.id+'-'+width+'.png'});
   if([390,1440].includes(width)&&product.id==='prime'){
    await page.locator('.product-detail-summary').evaluate(n=>scrollBy(0,n.getBoundingClientRect().top-150));
    await page.screenshot({path:out+'/page-'+width+'.png'});
   }
  }
  // Exercise the normal warning -> confirmed draft -> cart path with local API data.
  assert.equal(await page.evaluate(()=>JSON.stringify(currentProduct.plans)),original);
  await rows.nth(1).click();
  await page.locator('#cartAddProduct').click();
  const dialog=page.locator('dialog.cart-entry');await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();
  await page.waitForURL('**/sebet');
  assert.equal(drafts.length,1);assert.equal(drafts[0].productId,product.id);assert.equal(drafts[0].planIndex,1);
  const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.v1')||'[]'));assert.equal(cart.length,1);assert.equal(cart[0].planIndex,1);
  const preview=await page.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.preview.v1')||'{}'));
  const line=Object.values(preview)[0];assert.equal(line.unitCents,1998);
  assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
  await page.close();console.log(JSON.stringify({engine:engineName,width,product:product.id,oneExpanded:true,stockTransitions:true,cartPlan:1,cartCents:1998,passed:true}));
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
