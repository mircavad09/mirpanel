import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out='payment-test-artifacts/shop-browser';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const catalog=[{id:'capcut',title:'CapCut Pro',category:'video',plans:[{label:'1 aylıq',price:4.99}],formFields:[]},{id:'extra',title:'Video montaj',category:'video',plans:[{label:'1 aylıq',price:3.25}],formFields:[]},{id:'netflix',title:'Netflix',category:'film',plans:[{price:9},{price:5.99}]},{id:'prime',title:'Prime Video',category:'film',plans:[{price:5}]},{id:'hbo',title:'HBO Max',category:'film',plans:[{price:6}]}];
try{
 for(const width of [390,1440]){
  const p=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
  let fail=false,calls=0;
  await p.route('https://cart.test/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/payments/shop/quote'){
    calls++;
    const items=route.request().postDataJSON().items.map(x=>({...x,title:catalog.find(p=>p.id===x.productId).title,planName:'1 aylıq',unitCents:x.productId==='capcut'?499:325,available:9}));
    await new Promise(r=>setTimeout(r,700));
    return route.fulfill({status:fail?503:200,json:{items,totalCents:items.reduce((s,x)=>s+x.quantity*x.unitCents,0)}}).catch(()=>{});
   }
   if(path==='/cart-store.js'||path==='/cart-store.css')return route.fulfill({path:path.slice(1),contentType:path.endsWith('.js')?'text/javascript':'text/css'});
   if(path!=='/')return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width"><meta charset="utf-8"><body style="background:#242424"><a id="cartHeaderLink" href="/sebet">Səbət</a><script>const DATA={products:${JSON.stringify(catalog)}};window.openProductPage=id=>document.body.dataset.selected=id;if(!localStorage.getItem('mirpanel.cart.v1'))localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'capcut',planIndex:0,quantity:1}]));</script><script src="/cart-store.js"></script></body>`});
  });
  await p.goto('https://cart.test/');
  const d=p.getByRole('dialog',{name:'Səbət'}),next=d.getByRole('button',{name:'Ödənişə keç'});
  const measure=()=>p.evaluate(async()=>{
   const t=performance.now();
   document.getElementById('cartHeaderLink').click();
   const row=document.querySelector('dialog[open] [data-cart-product]');
   if(!row?.textContent.includes('CapCut Pro'))throw Error('No cart content on click');
   await new Promise(r=>requestAnimationFrame(r));
   return Math.round((performance.now()-t)*10)/10;
  });
  const first=await measure();assert.ok(calls>=1);assert.equal(await next.isDisabled(),true);
  await d.getByText('Sifarişiniz hazırdır — ödənişi tamamlayın').waitFor();assert.equal(await next.isEnabled(),true);
  await d.getByRole('button',{name:'Səbəti bağla'}).click();
  const repeat=await measure();assert.equal(await next.isDisabled(),true);
  const suggestionNames=()=>d.locator('.mir-cart-suggestion strong').allTextContents();
  const previous=await suggestionNames();assert.equal(previous[0],'Video montaj');
  await d.getByRole('button',{name:'Artır: CapCut Pro'}).click();await d.getByText('9,98 ₼').first().waitFor();
  assert.deepEqual(await suggestionNames(),previous);
  await d.getByRole('button',{name:'Azalt: CapCut Pro'}).click();await d.getByRole('button',{name:'Video montaj seç'}).click();
  assert.equal(await p.locator('body').getAttribute('data-selected'),'extra');
  assert.equal(await p.evaluate(()=>MirpanelCart.read().length),1);
  await p.evaluate(()=>{MirpanelCart.add('extra',0);MirpanelCart.open();});
  await d.locator('[data-cart-product="extra"]').waitFor();await d.getByText('8,24 ₼',{exact:true}).waitFor();
  await d.getByRole('button',{name:'Sil: Video montaj'}).click();assert.equal(await d.locator('[data-cart-product="extra"]').count(),0);
  await d.getByText('Sifarişiniz hazırdır — ödənişi tamamlayın').waitFor();
  await p.screenshot({path:out+'/cart-speed-'+width+'.png',animations:'disabled'});
  await d.getByRole('button',{name:'Səbəti bağla'}).click();fail=true;await measure();
  await d.getByText('Yoxlama alınmadı. Səbətiniz qorunub.').waitFor();
  assert.equal(await d.locator('[data-cart-product="capcut"]').count(),1);assert.equal(await next.isDisabled(),true);
  fail=false;await d.getByRole('button',{name:'Yenidən yoxla'}).click();await d.getByText('Sifarişiniz hazırdır — ödənişi tamamlayın').waitFor();
  await d.getByRole('button',{name:'Səbəti bağla'}).click();
  await p.evaluate(()=>{MirpanelCart.clear();MirpanelCart.add('netflix',0);MirpanelCart.open();});
  const netflix=await suggestionNames();assert.deepEqual(netflix.slice(0,2).sort(),['HBO Max','Prime Video']);assert.ok(!netflix.includes('Netflix'));
  console.log(JSON.stringify({width,firstFrameMs:first,reopenFrameMs:repeat,quoteDelayMs:700,productionWrites:0}));
  await p.close();
 }
}finally{await browser.close();}
