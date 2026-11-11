import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live-assets'),origin=live?'https://mirpanel.com':'https://cart.test';
const products=['first','second'].map((id,i)=>({id,title:i?'Tövsiyə məhsulu':'İlk məhsul',plans:[{label:'1 ay',price:5}]}));
const source=path=>path.replace(/^\/community-assets\//,'/mirpanel-admin/community/public/').slice(1);
for(const engine of live?[chromium]:[chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:width===390?'reduce':'no-preference',hasTouch:width===390});
   let fail=true,lastDraft,attempts=0;
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(url.origin!==origin)return route.abort();
    if(p==='/cart-notice-test')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><a id="cartHeaderLink" href="/sebet">Səbət</a><button id="product-add">Səbətə əlavə et</button><script>const DATA={products:${JSON.stringify(products)}};</script><script type="module">import {startCartEntry} from '/community-assets/cart-entry.js';window.openProductPage=id=>{const product=DATA.products.find(p=>p.id===id);return startCartEntry(product,product.plans[0]);};document.querySelector('#product-add').onclick=()=>openProductPage('first');</script>`});
    if(p==='/api/payments/shop/draft'&&req.method()==='POST'){
     attempts++;
     if(fail)return route.fulfill({status:503,json:{error:'Sintetik saxlama xətası'}});
     const input=req.postDataJSON();lastDraft={draftId:input.id,lineId:input.id,termsVersion:input.termsVersion};
     return route.fulfill({json:lastDraft});
    }
    if(p==='/api/payments/shop/quote'&&req.method()==='POST'){
     const items=req.postDataJSON().items.map(x=>({...x,title:products.find(y=>y.id===x.productId).title,planName:'1 ay',terms:'Sınaq şərtləri',fields:[],termsVersion:'synthetic',unitCents:500,available:20}));
     return route.fulfill({json:{items,totalCents:items.length*500,balanceCents:5000}});
    }
    if(p==='/api/payments/shop/drafts')return route.fulfill({json:{items:[]}});
    if(req.method()!=='GET')return route.abort();
    if(live)return route.continue();
    if(/\.(?:css|js)$/.test(p))return route.fulfill({path:source(p),contentType:p.endsWith('.js')?'text/javascript':'text/css'}).catch(()=>route.abort());
    return route.abort();
   });
   const page=await context.newPage();
   await page.goto(origin+'/cart-notice-test');
   const entry=page.locator('dialog.cart-entry'),drawer=page.locator('.mir-cart-drawer[open]'),notice=page.locator('.mir-cart-added');
   async function confirm(){await entry.getByRole('checkbox').check();await entry.getByRole('button',{name:'Təsdiqləyirəm'}).click();}
   await page.locator('#product-add').click();await confirm();
   await entry.getByText('Sintetik saxlama xətası').waitFor();assert.equal(await notice.count(),0);
   fail=false;await confirm();
   await drawer.getByRole('status').filter({hasText:'Məhsul səbətə əlavə edildi'}).waitFor();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.mir-cart-added')).display==='grid');
   const first=await notice.elementHandle();
   assert.equal(await notice.locator('path').evaluate(el=>getComputedStyle(el).animationName),width===390?'none':'mir-cart-check-draw');
   assert.equal(await notice.locator('.mir-cart-added-icon').evaluate(el=>getComputedStyle(el,'::after').animationName),width===390?'none':'mir-cart-check-glint');
   if(width!==390)assert.equal(await notice.locator('.mir-cart-added-bar').evaluate(el=>getComputedStyle(el).animationDuration),'5s');
   await drawer.getByRole('button',{name:'Tövsiyə məhsulu seç'}).click();await confirm();
   await drawer.locator('[data-cart-product="second"]').waitFor();
   await notice.waitFor();assert.equal(await notice.count(),1);assert.equal(await first.evaluate(el=>el.isConnected),false);
   assert.equal(await notice.evaluate(n=>n.getBoundingClientRect().bottom<=n.nextElementSibling.getBoundingClientRect().top),true);
   assert.equal(await drawer.getByRole('button',{name:'Ödənişə keç'}).isVisible(),true);
   if(width===390)await notice.getByRole('button',{name:'Bildirişi bağla'}).click();
   else{
    await page.waitForFunction(()=>{const n=document.querySelector('.mir-cart-added-bar');return n&&n.getBoundingClientRect().width<n.offsetWidth*.8;});
    assert.equal(await notice.isVisible(),true);
   }
   await notice.waitFor({state:'detached',timeout:5500});assert.equal(await drawer.isVisible(),true);
   await page.evaluate(d=>MirpanelCart.commitDraft(d,{productId:'second',planIndex:0,quantity:1}),lastDraft);
   assert.equal(await notice.count(),0);assert.equal(attempts,3);
   console.log(JSON.stringify({engine:engine.name(),width,liveAssets:live,product:true,suggestion:true,failureSilent:true,replaySilent:true,close:width===390?'manual':'auto',productionWrites:0}));
   await context.close();
  }
 }finally{await browser.close();}
}
