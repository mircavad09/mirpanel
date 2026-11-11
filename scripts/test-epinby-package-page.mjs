import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles,generateProductListingPageFiles} from '../mirpanel-admin/product-pages.mjs';

const live=process.argv.includes('--live'), origin=live?'https://mirpanel.com':'https://mirpanel.test';
const source=await fs.readFile('app.js','utf8'),state=extractAdminState(source);
const game=state.products.find(p=>p.id==='pubg_mobile'), legacy=state.products.find(p=>p.id==='epinby_3436');
assert.equal(game.plans[0].price,legacy.plans[0].price);
assert.equal(game.plans[0].image,legacy.image);
assert.equal(game.plans[0].supplier.productId,3436);
assert.equal(legacy.active,false);
const amounts=[325,660,1800,3850,8100];
if(!live){
 for(const [i,uc] of amounts.entries()){
  const id=3437+i,image='uploads/products/pubg-'+uc+'-uc.png';
  await fs.access(image);
  game.plans.push({...game.plans[0],id:'epinby_'+id,pricingId:'fixture-'+id,label:uc+' UC',image,price:2+i,supplier:{...game.plans[0].supplier,productId:id}});
 }
}
const files=new Map([...generateProductPageFiles(state.products,state.siteSections,state.cms,state.content),...generateProductListingPageFiles(state.products,state.siteSections,state.cms,state.content)]);
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.page':'text/html;charset=UTF-8'};
const out='outputs/game-products';
await fs.mkdir(out,{recursive:true});
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const width of live?[390,1440]:[320,390,430,1440]){
   const page=await browser.newPage({viewport:{width,height:950},isMobile:width<600,hasTouch:width<600});
   let quoteIndex=-1;
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),p=url.pathname;
    if(p==='/api/payments/shop/quote'&&!live){
     const items=request.postDataJSON().items.map(item=>{
      quoteIndex=item.planIndex;const plan=game.plans[quoteIndex];
      return {...item,unitCents:Math.round(plan.price*100),title:game.title,planName:plan.label,terms:'Sintetik alış şərtləri',termsVersion:'synthetic',available:100,fields:plan.formFields};
     });
     return route.fulfill({json:{items,totalCents:items[0].unitCents}});
    }
    if(request.method()!=='GET')return route.abort();
    if(live)return route.continue();
    if(p==='/api/payments/inventory')return route.fulfill({json:{products:[{productId:game.id,scope:'none',plans:[]}]}});
    if(p.startsWith('/api/'))return route.fulfill({json:{}});
    if(url.origin!==origin)return route.abort();
    if(p==='/app.js')return route.fulfill({contentType:mime['.js'],body:patchAppSource(source,state)});
    const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
    try {
     if(files.has(file+'.page'))return route.fulfill({contentType:mime['.page'],body:files.get(file+'.page')});
     return route.fulfill({contentType:mime[path.extname(file)]||'text/plain',body:await fs.readFile(file)});
    }catch{return route.fulfill({status:404});}
   });
   await page.goto(origin+'/mehsul/pubg-mobile',{waitUntil:'domcontentloaded'});
   const rows=page.locator('#pp-plans-container .pp-plan-label:visible');
   await rows.first().waitFor();
   assert.equal(await rows.count(),game.plans.length);
   for(const [i,plan] of game.plans.entries()){
    const row=rows.nth(i);await row.click();
    assert((await row.innerText()).includes(plan.label));
    assert.equal(await row.locator('button').count(),0);
    assert(await row.locator('.epinby-package-thumb').evaluate(async el=>{await el.decode();return el.naturalWidth>0;}));
    assert(await row.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));
   }
   const hero=page.locator('#pp-main-img');
   assert.equal(await hero.evaluate(el=>getComputedStyle(el).objectFit),'contain');
   const button=page.getByRole('button',{name:'İndi al',exact:true});
   await button.waitFor();
   if(!live){
    await button.click();
    await page.getByRole('dialog').filter({hasText:game.plans.at(-1).label}).waitFor({timeout:12000});
    assert.equal(quoteIndex,game.plans.length-1);
   }
   await page.screenshot({path:out+'/pubg-'+(live?'live-':'')+engine.name()+'-'+width+'.png'});
   console.log(JSON.stringify({live,browser:engine.name(),width,packages:game.plans.length,selectedQuote:quoteIndex,images:true,businessWrites:0}));
   await page.close();
  }
 }finally{await browser.close();}
}
