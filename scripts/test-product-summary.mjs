import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {detailPlanMetrics} from '../product-detail-display.mjs';
const live=process.argv.includes('--live');
const source=await fs.readFile('app.js','utf8'),state=extractAdminState(source);
const ids=['spotify','capcut','netflix'],out='outputs/mobile-product-flow';
await fs.mkdir(out,{recursive:true});
const fixturePlans=[
 {label:'1 aylıq — şəxsi hesab və bütün imkanlarla uzun paket adı',months:1,price:5.49,regularPrice:11},
 {label:'2 aylıq',months:2,price:10},
 {label:'3 aylıq',months:3,price:15,regularPrice:24},
 {label:'6 aylıq',months:6,price:9999.99},
 {label:'7 gün',durationDays:7,price:1.12},
 {label:'1 gün',durationDays:1,price:1}
];
for(const id of ids){
 const p=state.products.find(p=>p.id===id);
 p.active=true;p.inStock=true;p.formFields=[];p.plans=structuredClone(fixturePlans);
 p.deliveryType=id==='capcut'?'automatic':undefined;
 p.deliveryText=id==='spotify'?'2 saat':'';
}
const pages=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content);
const assets=new Map();
if(live)for(const file of ['product-page.js','product-page.css','stock-display-fix.js','order-confirmation.js','cart-ready.js','cart-store.js','product-detail-display.mjs','mirpanel-admin/public/product-plan-utils.mjs','mirpanel-admin/community/public/cart-entry.js']){
 const route=file.startsWith('mirpanel-admin/community/public/')?'/community-assets/'+path.basename(file):'/'+file;
 const response=await fetch('https://mirpanel.com'+route+'?v=mobile-product-flow-1',{signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok,route);
 const text=await response.text();
 const normal=s=>s.replaceAll(String.fromCharCode(13),'');
 assert.equal(normal(text),normal(await fs.readFile(file,'utf8')),route);
 assets.set(route,text);
}
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),p=u.pathname;
 try{
  if(p==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(patchAppSource(source,state));}
  if(assets.has(p)){res.setHeader('Content-Type',mime[path.extname(p)]);return res.end(assets.get(p));}
  if(p.startsWith('/mehsul/')){
   const html=pages.get(p.slice(1)+'.page');
   if(html){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html);}
  }
  const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
  if(file.includes('..'))throw Error('path');
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   for(const width of [320,390,430,1440])for(const id of ids){
    const p=state.products.find(p=>p.id===id),quotes=[];
    const page=await browser.newPage({viewport:{width,height:1000}});
    page.setDefaultTimeout(10000);
    let unavailable=false;
    await page.route('**/*',route=>{
     const request=route.request(),u=new URL(request.url());
     if(u.pathname==='/api/product-sales')return route.fulfill({json:{initialized:true,productId:id,productTotal:2119,siteTotal:13533,completedTotal:3533}});
     if(u.pathname==='/api/payments/inventory')return route.fulfill({json:{products:ids.map(productId=>({productId,scope:'plan',plans:fixturePlans.map((_,i)=>({planKey:String(i),tracked:true,available:unavailable?0:100}))}))}});
     if(u.pathname==='/api/payments/shop/quote'){
      const items=request.postDataJSON().items.map(item=>({...item,unitCents:Math.round(p.plans[item.planIndex].price*100),title:p.title,planName:p.plans[item.planIndex].label,terms:'Sintetik alış şərtləri',termsVersion:'synthetic',available:100,fields:[]}));
      quotes.push(items[0]);return route.fulfill({json:{items,totalCents:items[0].unitCents}});
     }
     if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
     if(u.origin!==origin)return route.abort();
     return route.continue();
    });
    await page.goto(origin+'/mehsul/'+p.seoSlug);
    const summary=page.locator('.product-detail-summary');
    await summary.waitFor();
    await page.locator('#pp-order-btn:not(:disabled)').waitFor();
    const rows=page.locator('#pp-plans-container .pp-plan-label');
    const order=page.locator('#pp-order-btn'),cart=page.locator('#cartAddProduct');
    assert.equal(await order.textContent(),'İndi al');
    assert.equal((await cart.textContent()).trim(),'Səbətə at');
    const positions=await Promise.all([order.boundingBox(),cart.boundingBox()]);
    if(width<768){
     assert.ok(Math.abs(positions[0].x-positions[1].x)<2&&positions[0].y+positions[0].height<=positions[1].y);
     const image=page.locator('#pp-main-img'),media=page.locator('.product-page-media'),card=page.locator('.product-page-card');
     await image.evaluate(node=>node.decode());
     const geometry=await Promise.all([image.boundingBox(),media.boundingBox(),card.boundingBox()]);
     assert.ok(geometry[2].width-geometry[1].width<=20,'image fills card');
     const ratio=await image.evaluate(n=>n.naturalWidth/n.naturalHeight);
     assert.ok(Math.abs(geometry[0].width/geometry[0].height-ratio)<.02,'image keeps original ratio');
     const elements=['.product-page-media','.product-detail-heading','.product-detail-sales','.product-detail-summary','.product-page-section-title','#pp-plans-container','.product-page-actions','.product-detail-trust','.product-page-similar'];
     const vertical=await page.evaluate(selectors=>selectors.map(s=>document.querySelector(s).getBoundingClientRect().top),elements);
     assert.ok(vertical.every((top,index)=>index===0||top>=vertical[index-1]),'mobile reading order');
     assert.equal(await page.locator('.product-detail-sales').innerText(),'2 119+ dəfə satılıb');
    }else assert.ok(positions[0].x<positions[1].x&&Math.abs(positions[0].y-positions[1].y)<2);
    assert.ok(positions.every(b=>b.height>=44));
    for(let i=0;i<fixturePlans.length;i++){
     await rows.nth(i).click();
     const plan=fixturePlans[i],metrics=detailPlanMetrics(plan),price=plan.price.toFixed(2).replace('.',',')+' ₼';
     assert.equal(await summary.locator('.product-detail-summary-prices strong').textContent(),price);
     assert.equal(await summary.locator('del').count(),plan.regularPrice?1:0);
     assert.equal(await summary.locator('.product-detail-savings').count(),plan.regularPrice?1:0);
     if(plan.regularPrice){
      assert.equal(await summary.locator('.product-detail-savings').textContent(),(plan.regularPrice-plan.price).toFixed(2).replace('.',',')+' ₼ qənaət edirsiniz');
      assert.equal(await summary.locator('.product-detail-savings').evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
     }
     const rate=rows.nth(i).locator('.product-detail-rate');
     if(plan.months===1)assert.equal(await rate.count(),0);
     else assert.equal(await rate.textContent(),(plan.durationDays?'Gündə ':'Ayda ')+metrics.rate.toFixed(2).replace('.',',')+' ₼');
     if(width<768&&plan.regularPrice){
      const savings=summary.locator('.product-detail-savings');
      const a=await savings.boundingBox(),b=await summary.locator('.product-detail-summary-prices').boundingBox();
      assert.ok(a.y>=b.y+b.height-1||a.x>=b.x+b.width-1,'summary savings never overlaps prices');
     }
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
     assert.ok(await rows.nth(i).evaluate(n=>n.querySelector('.pp-plan-name').getBoundingClientRect().right<=n.querySelector('.pp-plan-right').getBoundingClientRect().left));
     await (i%2?order:cart).click();
     const dialog=page.locator('dialog.cart-entry[open]');
     await dialog.getByText('Sintetik alış şərtləri',{exact:true}).waitFor();
     assert.equal(quotes.at(-1).planIndex,i);
     assert.equal(quotes.at(-1).unitCents,Math.round(plan.price*100));
     await page.keyboard.press('Escape');
     await dialog.waitFor({state:'hidden'});
    }
    const facts=page.locator('.product-detail-trust');
    assert.equal(await facts.locator('svg').count(),4);
    await facts.getByText(/tamamlanmış sifariş/).waitFor();
    assert.equal((await facts.textContent()).replace('3,533','3.533'),'2024-dən fəaliyyət göstəririk3.533 tamamlanmış sifariş'+(id==='capcut'?'Anında, avtomatik təqdim olunur':id==='spotify'?'2 saat':'Ödəniş təsdiqindən sonra təqdim olunur')+'MirPanel əlavə komissiya tutmur');
    const related=page.locator('.product-page-similar');
    assert.ok(await related.locator('.product-page-similar-card').count()>0);
    assert.ok(await related.locator('.product-page-similar-card').first().evaluate(n=>n.querySelector('img').getBoundingClientRect().right<n.querySelector('.product-page-similar-title').getBoundingClientRect().left));
    await cart.focus();
    assert.equal(await cart.evaluate(n=>getComputedStyle(n).outlineColor),'rgb(255, 212, 0)');
    if(engine===chromium&&[390,1440].includes(width)){
     await rows.first().click();await page.mouse.move(0,0);
     await page.screenshot({path:out+'/'+(live?'live-assets-':'')+id+'-'+width+'.png',fullPage:true});
    }
    unavailable=true;
    await page.evaluate(()=>MirpanelInventory.refresh());
    assert.equal(await order.isDisabled(),true);assert.equal(await cart.isDisabled(),true);
    await page.close();
    console.log(engine.name(),width,id,'PASS');
   }
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
