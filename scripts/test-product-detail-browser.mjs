import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {weightedAllocation} from '../mirpanel-admin/product-sales-repository.mjs';
import {planMetrics} from '../mirpanel-admin/public/product-plan-utils.mjs';
const root=path.resolve(import.meta.dirname,'..');
const catalog=extractAdminState(fs.readFileSync(path.join(root,'app.js'),'utf8'));
const pages=generateProductPageFiles(catalog.products,catalog.siteSections,catalog.cms,catalog.content);
const allocation=weightedAllocation(catalog.products);
const historical=new Map(allocation.map(r=>[r.product_id,r.count]));
const initialized={historicalTotal:10000,distributed:10000,initializedAt:'2026-10-10T08:00:00Z',version:1,realTotal:2,total:10002,
  products:catalog.products.map(p=>({productId:p.id,title:p.title,historical:historical.get(p.id)||0,real:p.id==='capcut'?2:0,total:(historical.get(p.id)||0)+(p.id==='capcut'?2:0)}))};
let initializedFlag=false,initializationRequests=0,adminSaves=0,forbidden=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local'),p=url.pathname;
  if(p==='/api/admin/state'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:catalog,sha:'a'.repeat(40),csrfToken:'test-csrf',loadedAt:new Date().toISOString()}));}
  if(p==='/api/admin/product-sales/initialize'&&req.method==='POST'){initializationRequests++;initializedFlag=true;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(initialized));}
  if(p==='/api/admin/product-sales'&&req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(initializedFlag?initialized:{...initialized,initializedAt:null,version:0,distributed:0,total:2}));}
  if(p==='/api/admin/product-sales'&&req.method==='PATCH'){adminSaves++;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(initialized));}
  if(req.method!=='GET'){forbidden++;res.writeHead(405);return res.end();}
  const html=pages.get(p.slice(1)+'.page');
  if(html){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
  let name=p==='/admin-test'?path.join(root,'mirpanel-admin/public/admin.html'):path.resolve(root,'.'+p);
  if(p.startsWith('/admin-asset/'))name=path.join(root,'mirpanel-admin/public',p.slice(13));
  if(!name.startsWith(root+path.sep)||!fs.existsSync(name)||!fs.statSync(name).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(name)]||'application/octet-stream');
  if(p==='/admin-test'){
    let content=fs.readFileSync(name,'utf8').replace(/(src|href)="(admin(?:\.js|\.css)|product-sales-admin\.js)([^\"]*)"/g,'$1="/admin-asset/$2$3"');
    // Isolate the requested product editor: other admin modules are not exercised.
    content=content.replace(/<script src="(?:admin-stock-save-fix|homepage-banners-admin|cms-admin|payment-admin|stories-admin)[^\"]*"><\/script>/g,'');
    return res.end(content);
  }
  return res.end(fs.readFileSync(name));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],checks=[],failedResources=new Set();
const viewports=[[320,568],[390,844],[768,900],[1024,768],[1440,900],[1920,1080]];
try{
 const context=await browser.newContext();
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin)return route.continue();
  if(url.pathname==='/api/product-sales'){
   const id=url.searchParams.get('productId');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({initialized:true,productId:id,productTotal:(historical.get(id)||0)+(id==='capcut'?2:0),siteTotal:10002})});
  }
  if(/\/api\/(payment|order|receipt)|wa\.me/.test(request.url())||!['GET','HEAD'].includes(request.method())){forbidden++;return route.fulfill({status:403,body:'Safety guard'});}
  if(url.pathname==='/api/stock')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  // Avoid analytics/external network; existing local assets are used unchanged.
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)failedResources.add(r.url());});
 for(const [width,height] of (process.env.MIRPANEL_DETAIL_QUICK ? [[390,844]] : viewports)){
  await page.setViewportSize({width,height});
  for(const id of (process.env.MIRPANEL_DETAIL_QUICK ? ['capcut'] : ['prime','capcut','spotify','netflix','google_ai','netflix_umumi','youtube','tiktok_jeton'])){
   const product=catalog.products.find(p=>p.id===id);
   await page.goto(`${origin}/mehsul/${product.seoSlug}`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('productPageView')?.dataset.detailEnhanced==='true');
   await page.waitForFunction(()=>!document.querySelector('.product-detail-sales').hidden);
   await page.waitForFunction(()=>{const s=document.getElementById('newSplashScreen');return !s||s.hidden||getComputedStyle(s).display==='none';});
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`${id} ${width} overflow`);
   assert.equal(await page.locator('.product-detail-trust').getByText('2024-dən fəaliyyət göstərir').count(),1);
   assert.match(await page.locator('.product-detail-trust').textContent(),/10[.,\s]002\+/u);
   assert.equal(await page.locator('.product-detail-best').filter({hasText:'Ən sərfəli'}).count(),product.soldOut || product.flow==='out_of_stock'?0:1);
   for(let index=0;index<product.plans.length;index++){
    const row=page.locator('#pp-plans-container .pp-plan-label').nth(index);await row.click();
    const summary=await page.locator('.product-detail-summary').textContent(),m=planMetrics(product.plans[index]);
    assert.ok(summary.includes(m.price.toFixed(2)),`${id} selected price`);
    if(m.savings!==null)assert.ok(summary.includes(m.savings.toFixed(2)),`${id} savings`);
    else assert.ok(!summary.includes('Qənaət:'));
    assert.equal(await row.getAttribute('aria-checked'),'true');
    assert.ok(await row.evaluate(e=>e.getBoundingClientRect().height>=44));
    assert.ok(await row.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${id} row text overflow`);
   }
   // Only open confirmation/form; never enter card selection or create an order.
   if(await page.locator('#pp-order-btn').isEnabled()) {
   await page.locator('#pp-order-btn').click();
   assert.ok((await page.locator('#mTitle').textContent()).includes(product.title.replace(/\s+almaq\s*$/i,'')));
   if((product.formFields||[]).some(f=>f.enabled!==false)){
    await page.check('#orderTermsAgreement');await page.click('#orderConfirmationConfirm');
    assert.equal(await page.locator('#spotifyEmail').count(),id==='spotify'?1:0);
    assert.equal(await page.locator('.netflixPinDigit').count(),id==='netflix'?4:0);
    if(id==='google_ai')assert.equal(await page.locator('.spotifyPasswordReset,#spotifyPassword,#spotifyPasswordConfirm').count(),0);
   }
   await page.keyboard.press('Escape');
   } else assert.ok(product.soldOut || product.flow==='out_of_stock');
   if(process.env.MIRPANEL_VISUAL_DIR){fs.mkdirSync(process.env.MIRPANEL_VISUAL_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`detail-${id}-${width}.png`),fullPage:true});}
   checks.push({product:id,viewport:`${width}x${height}`,overflow:0,selection:true,formIsolation:true});
  }
 }
 // Existing product editor plus the new independent sales controls, test fixtures only.
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/admin-test');
 await page.waitForFunction(()=>document.querySelectorAll('#plans .planMetadata').length>0);
 await page.click('#salesRefresh');await page.waitForFunction(()=>document.querySelector('#salesEditor .primary'));
 page.on('dialog',d=>d.accept());
 await page.locator('#salesEditor .primary').dblclick();await page.waitForFunction(()=>document.querySelector('#salesSave'));
 assert.equal(initializationRequests,1);
 const first=page.locator('[data-product-id]').first();await first.fill('0');
 assert.equal(await page.locator('#salesSave').isDisabled(),true);
 assert.ok((await page.locator('#salesSumStatus').textContent()).includes('Fərq'));
 await page.click('#salesRefresh');await page.waitForTimeout(100);assert.equal(await page.locator('#salesSave').isEnabled(),true);
 await page.locator('#salesSave').dblclick();await page.waitForTimeout(100);assert.equal(adminSaves,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'admin mobile overflow');
 assert.equal(await page.locator('#plans [data-planmeta=stockVisibility]').count(),4);
 assert.equal(await page.locator('#productDeliveryType').inputValue(),'manual');
 await page.locator('#plans [data-planmeta=warrantyMode]').first().selectOption('guaranteed');
 await page.locator('#plans [data-planmeta=warrantyText]').first().fill('20 gün zəmanət');
 await page.locator('#plans [data-planmeta=warrantyText]').first().dispatchEvent('change');
 assert.equal(await page.evaluate(()=>state.data.products[0].plans[0].warrantyText),'20 gün zəmanət');
 await page.locator('#plans [data-planmeta=bestValue]').nth(0).check();
 await page.locator('#plans [data-planmeta=bestValue]').nth(1).check();
 assert.equal(await page.evaluate(()=>state.data.products[0].plans.filter(p=>p.bestValue).length),1);
 await page.locator('#addPlanBtn').dblclick();
 assert.equal(await page.locator('#plans .planRow').count(),5,'double-click creates one plan');
 for(const [width,height] of viewports){
   await page.setViewportSize({width,height});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`admin ${width} overflow`);
   assert.ok(await page.locator('#plans input[data-field=price]').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
   if(process.env.MIRPANEL_VISUAL_DIR)await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`admin-detail-${width}.png`)});
 }
 if(failedResources.size)console.log('FAILED_RESOURCE_URLS',JSON.stringify([...failedResources]));
 assert.deepEqual(errors,[]);assert.equal(forbidden,0);
 console.log(JSON.stringify({checks,admin:{initializationRequests,adminSaves,invalidTotalBlocked:true,metadata:true,overflow:0},consoleErrors:errors,realOrders:0,realReservations:0},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
