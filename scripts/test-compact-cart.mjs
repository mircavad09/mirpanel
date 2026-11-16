import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit,devices} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {shopShell} from '../functions/sebet.js';

const site='https://mirpanel.com',output='outputs/compact-cart';
await fs.mkdir(output,{recursive:true});
const header='<header id="mainHeader"><div class="site-header-tools"></div></header>';
const capcut={productId:'capcut',planIndex:1,quantity:1,draftId:'83ac2200-3173-4a2b-bab0-16cd1bda0001'};
const game={productId:'pubg_mobile',planIndex:0,quantity:1,draftId:'83ac2200-3173-4a2b-bab0-16cd1bda0002'};
const metadata={
 capcut:{title:'CapCut Pro',planName:'1 Ay (endirim)',unitCents:499,fields:[],image:'/assets/logo.png'},
 pubg_mobile:{title:'PUBG Mobile',planName:'60 UC',unitCents:165,termsMissing:true,fields:[{key:'player_id',required:true}],image:'/assets/logo.png'}
};
const documentPage=(body,script='')=>'<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>'+header+body+script+'</body></html>';
const store='<script defer src="/cart-store.js"></script>';
for(const [engine,label,device] of [[chromium,'Android Chrome',devices['Pixel 7']],[webkit,'iPhone WebKit',devices['iPhone 13']],[chromium,'Desktop Chrome',{viewport:{width:1440,height:900}}]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const context=await browser.newContext(device),page=await context.newPage();
  page.setDefaultTimeout(10000);
  await page.addInitScript(({capcut,metadata})=>{
   if(localStorage.getItem('cart-test-seeded'))return;
   localStorage.setItem('cart-test-seeded','1');
   const line={...capcut,lineId:capcut.draftId};
   localStorage.setItem('mirpanel.cart.v1',JSON.stringify([line]));
   localStorage.setItem('mirpanel.cart.preview.v1',JSON.stringify({[line.lineId]:metadata.capcut}));
  },{capcut,metadata});
  let failQuote=false,guest=false,delayQuote=0;const forbidden=[];
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   if(url.origin!==site)return route.abort();
   if(path==='/api/payments/shop/quote'){
    if(delayQuote)await new Promise(r=>setTimeout(r,delayQuote));
    if(failQuote)return route.fulfill({status:503,json:{error:'Test outage'}});
    const items=request.postDataJSON().items.map(x=>({...x,...metadata[x.productId]}));
    return route.fulfill({json:{items,balanceCents:guest?null:2000,totalCents:items.reduce((n,x)=>n+x.quantity*x.unitCents,0)}});
   }
   if(path==='/api/auth/confirm-email/status')return route.fulfill({json:{verified:false}});
   if(path==='/api/community/presence')return route.fulfill({json:{ok:true}});
   if(path==='/api/payments/shop/draft/remove')return route.fulfill({json:{removed:true}});
   if(request.method()!=='GET'){forbidden.push(path);return route.fulfill({status:403,json:{}});}
   if(path==='/api/community/state')return route.fulfill({json:{profile:{id:'test-owner',emailVerified:true}}});
   if(path.includes('/api/'))return route.fulfill({json:{items:[],products:[]}});
   if(path==='/sebet'){
    const response=await shopShell({request:new Request(url),next:async()=>new Response(header,{headers:{'Content-Type':'text/html'}})});
    return route.fulfill({status:response.status,contentType:'text/html',body:await response.text()});
   }
   if(path==='/odenis')return route.fulfill({contentType:'text/html',body:documentPage('<link rel="stylesheet" href="/community-assets/shop.css"><main id="shopApp" class="shop-page"></main>','<script type="module" src="/community-assets/shop-ui.js"></script>')});
   if(path==='/hesab')return route.fulfill({contentType:'text/html',body:documentPage('<main id="auth"></main>','<script type="module">import {mountAuth} from "/community-assets/auth-forms.js";mountAuth(document.querySelector("#auth"));</script>')});
   if(['/','/mehsul','/profil'].includes(path))return route.fulfill({contentType:'text/html',body:documentPage('<main><a data-browser-nav="cart" href="/sebet">Mobil səbət</a><a href="/profil">Profil</a><button id="added">Məhsul əlavə et</button></main>',store+'<script>document.querySelector("#added").onclick=()=>{const x='+JSON.stringify(game)+';MirpanelCart.commitDraft(x,{...x,edit:false});MirpanelCart.open()};</script>')});
   try{
    const file=path.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+path.slice(18):path.slice(1);
    const contentType=path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/javascript';
    return await route.fulfill({contentType,body:await fs.readFile(file)});
   }catch{return route.fulfill({status:404,body:''});}
  });
  const drawer=page.getByRole('dialog',{name:'Səbət',exact:true}),rows=drawer.locator('.mir-cart-item:not(.mir-cart-suggestion)');
  const next=drawer.getByRole('button',{name:'Ödənişə keç',exact:true});
  async function verifyCart(count=1){
   await drawer.waitFor();await page.locator('[data-cart-loading]').waitFor({state:'detached'});
   assert.equal(await drawer.count(),1);assert.equal(await page.getByRole('heading',{name:'Səbətim',exact:true}).count(),0);
   assert.equal(await rows.count(),count);
   if(count)await rows.getByText('CapCut Pro',{exact:true}).waitFor();
   const foot=await next.boundingBox(),view=await page.evaluate(()=>innerHeight);
   assert(foot&&foot.y+foot.height<=view);
  }
  await page.goto(site+'/');await page.locator('#cartHeaderLink').click();await verifyCart();
  await rows.getByText('1 Ay (endirim)',{exact:true}).waitFor();await rows.locator('img:not([hidden])').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
  assert.equal(await drawer.getByText('Məlumatları redaktə et',{exact:true}).count(),0);
  await rows.getByRole('button',{name:'Artır: CapCut Pro'}).click();
  await rows.getByText('9,98 ₼',{exact:true}).waitFor();
  await page.reload();await verifyCart();await rows.getByText('9,98 ₼',{exact:true}).waitFor();
  await page.goBack();await page.locator('[data-browser-nav="cart"]').click();await verifyCart();
  await page.goto(site+'/profil');await page.goBack();await verifyCart();
  await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
  await next.click();await page.getByRole('link',{name:'Ləğv et və səbətə qayıt',exact:true}).waitFor();
  await page.goBack();await verifyCart();await rows.getByText('9,98 ₼',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
  await next.click();await page.getByRole('link',{name:'Ləğv et və səbətə qayıt',exact:true}).click();await verifyCart();
  guest=true;await page.reload();await verifyCart();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
  await next.click();await page.getByRole('link',{name:'Bağla və səbətə qayıt'}).click();await verifyCart();
  guest=false;failQuote=true;delayQuote=500;
  await page.goto(site+'/sebet?checkout=1');await verifyCart();await drawer.getByText('Qiymət və stok yoxlanılır…',{exact:true}).waitFor();
  assert(await next.isDisabled());await drawer.getByRole('button',{name:'Yenidən yoxla'}).waitFor();
  failQuote=false;delayQuote=0;await drawer.getByRole('button',{name:'Yenidən yoxla'}).click();
  await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
  await page.screenshot({path:output+'/'+engine.name()+'-'+device.viewport.width+'.png'});
  await drawer.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await page.waitForURL(site+'/mehsul');
  assert.equal(await drawer.count(),0);
  await page.locator('#added').click();await verifyCart(2);
  await drawer.getByRole('button',{name:'Şərtləri təsdiqlə'}).waitFor();assert(await next.isDisabled());
  await drawer.getByRole('button',{name:'Sil: PUBG Mobile'}).click();
  await drawer.getByRole('button',{name:'Sil: CapCut Pro'}).click();await verifyCart(0);
  await drawer.getByText('Səbətiniz boşdur.',{exact:true}).waitFor();assert(await next.isDisabled());
  assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
  console.log(label+': header, bottom link, product add, direct, refresh, history, profile, login cancel, checkout cancel, slow quote/retry, multi-item, empty and close passed. No checkout calls.');
 }finally{await browser.close();}
}

