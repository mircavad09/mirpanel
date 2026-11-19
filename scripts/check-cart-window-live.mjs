// Anonymous live visual check. Only quote POSTs are permitted; no draft,
// order, payment, stock or account writes can pass this browser's route guard.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='outputs/cart-window';fs.mkdirSync(out,{recursive:true});
const js=await fetch('https://mirpanel.com/cart-store.js?v=cart-viewport-3').then(r=>r.text());
assert(js.includes('mir-cart-savings')&&js.includes('inline=true'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const results=[];
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:620},deviceScaleFactor:1}),page=await context.newPage(),blocked=[];
  await page.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(!['GET','HEAD'].includes(req.method())&&!(req.method()==='POST'&&u.origin==='https://mirpanel.com'&&u.pathname==='/api/payments/shop/quote')){blocked.push(u.pathname);return r.abort();}return r.continue();});
  await page.goto('https://mirpanel.com/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.MirpanelCart&&typeof DATA!=='undefined',{timeout:30000});
  const quote=await page.evaluate(async()=>{
   const rows=['netflix','prime'].map(id=>{const p=DATA.products.find(p=>p.id===id);if(!p)throw Error('Missing product '+id);return {productId:p.id,planIndex:0,quantity:1};});
   const r=await fetch('/api/payments/shop/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:rows})});const q=await r.json();if(!r.ok)throw Error(JSON.stringify(q));
   // Local-only consent fixtures for visual QA. Nothing is committed to server.
   localStorage.setItem('mirpanel.cart.v1',JSON.stringify(q.items.map(x=>({productId:x.productId,planIndex:x.planIndex,quantity:1,termsVersion:x.termsVersion}))));
   window.dispatchEvent(new Event('mirpanel:cart'));return {items:q.items.map(x=>({productId:x.productId,unitCents:x.unitCents,oldUnitCents:x.oldUnitCents})),totalCents:q.totalCents};
  });
  assert(quote.items.every(x=>Object.hasOwn(x,'oldUnitCents')),'Render quote must expose deployed former-price metadata');
  const start=page.url();await page.evaluate(()=>MirpanelCart.open());const dialog=page.locator('.mir-cart-drawer[open]');await dialog.waitFor();
  await page.waitForFunction(()=>!document.querySelector('.mir-cart-notice').textContent.includes('yoxlanılır'),{timeout:30000});
  await page.waitForTimeout(800);
  const info=await dialog.evaluate(d=>{const r=d.getBoundingClientRect(),b=d.querySelector('.mir-cart-body');return {left:r.left,top:r.top,bottom:r.bottom,right:r.right,bodyScrollable:b.scrollHeight>b.clientHeight,savings:d.querySelector('.mir-cart-savings').textContent,total:d.querySelector('.mir-cart-sum').textContent,notice:d.querySelector('.mir-cart-notice').textContent,closeBackground:getComputedStyle(d.querySelector('header button')).backgroundColor};});
  assert(info.left>=10&&info.right<=width-10&&info.top>0&&info.bottom<(width===1440?1000:620)-10);assert(await dialog.evaluate(d=>d.matches(':modal')&&d.dataset.cartWindow==='viewport-3'));
  assert.equal(page.url(),start);await page.screenshot({path:out+'/live-'+width+'.png'});
  await dialog.getByRole('button',{name:'Artır: Netflix Şəxsi',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-notice').textContent.includes('yoxlanılır'));assert.match(await dialog.locator('header').innerText(),/Səbət \(3\)/);
  await dialog.getByRole('button',{name:'Sil: Amazon Prime Video',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-cart-product=prime]'));
  await dialog.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(page.url(),start);
  await page.goto('https://mirpanel.com/sebet',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1500);
  assert(await dialog.evaluate(d=>d.matches(':modal')&&d.parentElement===document.body));const direct=await dialog.evaluate(d=>({top:d.getBoundingClientRect().top,bottom:d.getBoundingClientRect().bottom,modal:d.matches(':modal')}));assert(direct.top>=20&&direct.bottom<(width===1440?1000:620)-20);
  await page.screenshot({path:out+'/live-direct-'+width+'.png'});
  results.push({width,quote,info,direct,blockedWrites:blocked.length,orderOrPaymentCreated:false});await context.close();
 }
 fs.writeFileSync(out+'/live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
