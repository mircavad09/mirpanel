import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles,generateProductListingPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {termsInfo} from '../mirpanel-admin/cart-drafts.mjs';

const live=process.argv.includes('--live'), liveFixture=process.argv.includes('--live-fixture');
const origin=live||liveFixture?'https://mirpanel.com':'https://mirpanel.test';
const source=await fs.readFile('app.js','utf8'),state=extractAdminState(source);
const game=state.products.find(p=>p.id==='pubg_mobile'), legacy=state.products.find(p=>p.id==='epinby_3436');
if(!live&&!game.plans.length)game.plans.push({...legacy.plans[0],id:legacy.id,supplier:legacy.supplier,formFields:legacy.formFields,image:legacy.image});
if(!game.plans.length)throw Error('No active live PUBG Mobile package in the catalog');
assert.equal(game.plans[0].price,legacy.plans[0].price);
assert.equal(new URL(game.plans[0].image,origin).pathname,new URL(legacy.image,origin).pathname);
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
  for(const width of live||liveFixture?[390,1440]:[320,390,430,1440]){
   const page=await browser.newPage({viewport:{width,height:width<600?810:950},isMobile:width<600,hasTouch:width<600,ignoreHTTPSErrors:live||liveFixture});
   const quoted=new Set();
   let lookupIndex=-1;
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),p=url.pathname;
    if(p==='/api/payments/shop/quote'&&!live){
     const items=request.postDataJSON().items.map(item=>{
      quoted.add(item.planIndex);const plan=game.plans[item.planIndex];
      return {...item,unitCents:Math.round(plan.price*100),title:game.title,planName:plan.label,...termsInfo(game,plan,item.planIndex),accountCheck:true,available:100};
     });
     return route.fulfill({json:{items,totalCents:items[0].unitCents}});
    }
    if(p==='/api/payments/shop/epinby-account'&&!live){
     const {productId,planIndex,values,termsVersion}=request.postDataJSON();
     lookupIndex=planIndex;
     assert.equal(productId,game.id);
     assert.equal(termsVersion,termsInfo(game,game.plans[planIndex],planIndex).termsVersion);
     return route.fulfill({json:values.player_id==='000123'?{state:'verified',name:'Sintetik oyunçu',allowCheckout:true}:{state:'unavailable',message:'Hesab adı yoxlanmır.',allowCheckout:true}});
    }
    if(live&&p==='/api/payments/shop/quote'&&request.method()==='POST')return route.continue();
    if(request.method()!=='GET')return route.abort();
    if(!live&&p==='/api/payments/inventory')return route.fulfill({json:{products:[{productId:game.id,scope:'none',plans:[]}]}});
    if(!live&&p==='/app.js')return route.fulfill({contentType:mime['.js'],body:patchAppSource(source,state)});
    if(liveFixture&&p==='/mehsul/pubg-mobile')return route.fulfill({contentType:mime['.page'],body:files.get('mehsul/pubg-mobile.page')});
    if(liveFixture)return route.continue();
    if(live)return route.continue();
    if(p.startsWith('/api/'))return route.fulfill({json:{}});
    if(url.origin!==origin)return route.abort();
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
   for(const i of new Set([0,game.plans.length-1])){
    const plan=game.plans[i];await rows.nth(i).click();await button.click();
    const modal=page.getByRole('dialog',{name:'Sifariş şərtləri'});
    await modal.waitFor({timeout:16000});
    assert((await modal.locator('.cart-warning-product').innerText()).includes(plan.label+' · '+Number(plan.price).toFixed(2).replace('.',',')+' ₼'));
    assert.equal(await modal.locator('.cart-game-check').count(),6);
    assert.match(await modal.locator('.cart-game-warning').innerText(),/UC yalnız/);
    assert.equal(await page.getByLabel('Player ID',{exact:true}).count(),0);
    const next=modal.getByRole('button',{name:'Növbəti',exact:true});
    assert.equal(await next.isDisabled(),true);
    await modal.getByLabel('Oxudum və təsdiqlədim').check();
    await next.click();
    const details=page.getByRole('dialog',{name:'Oyunçu ID-ni daxil et'});
    const player=details.getByLabel('Player ID',{exact:true});
    await player.waitFor();
    assert((await details.locator('.cart-entry-note').innerText()).includes(plan.label));
    assert.equal(await player.getAttribute('placeholder'),'PUBG Mobile ID nömrənizi daxil edin');
    if(!live){
     assert(quoted.has(i));
     assert.equal(await details.getByRole('button',{name:'Hesab adını yoxla'}).count(),0);
     await player.fill('000123');
     await details.getByText('Sintetik oyunçu',{exact:true}).waitFor();
     assert.equal(lookupIndex,i);
     await player.fill('000124');
     assert.equal(await details.getByText(/Sintetik oyunçu/).count(),0);
     await details.getByText('Hesab adı yoxlanmır.',{exact:true}).waitFor();
    }
    await details.getByRole('button',{name:'Bağla'}).click();
   }
   await page.screenshot({path:out+'/pubg-'+(live?'live-':'')+engine.name()+'-'+width+'.png'});
   console.log(JSON.stringify({live,liveFixture,browser:engine.name(),width,packages:game.plans.length,termsAndPlayerId:true,businessWrites:0}));
   await page.close();
  }
 }finally{await browser.close();}
}
