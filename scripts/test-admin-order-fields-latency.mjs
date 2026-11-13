import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const before=process.argv.includes('--before'),live=process.argv.includes('--live');
const baseline=before?execFileSync('git',['-c','safe.directory=*','show','72a59b9:mirpanel-admin/public/payment-admin.js']):null;
const state=extractAdminState(await readFile('app.js','utf8')),origin='http://mirpanel.test';
const directory=new URL('../mirpanel-admin/public/',import.meta.url);
const fieldLines=[{index:0,fields:[{label:'E-poçt',value:'qa@example.test'},{label:'Şifrə',value:'Synthetic-only'}]}];
const endpoint='/api/admin/payment-orders';
for(const [engine,width] of [[chromium,390],[chromium,1440],[webkit,390]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const delay of [180,900]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<650});
   let detailRequests=0,listRequests=0,failed=false,sessionExpired=false,updated=false;
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin!==origin)return route.abort();
    if(u.pathname==='/api/session')return route.fulfill({status:sessionExpired?401:200,json:sessionExpired?{error:'Expired'}:{csrfToken:'fixture',expiresAt:Date.now()+60000}});
    if(u.pathname===endpoint){
     listRequests++;
     const stage=u.searchParams.get('pendingStage')||'payment';
     const responseFields=structuredClone(fieldLines);
     if(updated)responseFields[0].fields[0].value='updated@example.test';
     await new Promise(resolve=>setTimeout(resolve,delay));
     const orders=Array.from({length:5},(_,index)=>({id:stage+'-'+index,orderCode:String(index),productTitle:'Synthetic product',status:stage==='delivery'?'preparing':'reviewing',amount:5,currency:'AZN',fieldLines:index===4?[]:responseFields,...(failed&&index===2?{fieldLines:undefined,fieldError:'Sintetik açma xətası'}:{})}));
     return route.fulfill({json:{orders,permissions:{fields:true,manage:true},counts:{pending:5,delivery:stage==='delivery'?5:0,pendingTotal:10},pagination:{page:1,totalPages:1,total:5}}});
    }
    if(u.pathname.endsWith('/details')){
     detailRequests++;
     await new Promise(resolve=>setTimeout(resolve,delay));
     return route.fulfill({json:{lines:fieldLines}});
    }
    if(u.pathname==='/api/admin/state')return route.fulfill({json:{data:state,sha:'fixture',csrfToken:'fixture'}});
    if(u.pathname.startsWith('/api/'))return route.fulfill({json:{products:[],orders:[],items:[],methods:[],settings:{}}});
    try{
     const name=u.pathname.slice(1);
     let body=baseline&&name==='payment-admin.js'?baseline:live&&name==='payment-admin.js'
      ?await(await fetch('https://mirpanel.onrender.com/payment-admin.js?v=order-fields-batch-1')).text()
      :await readFile(new URL(name,directory));
     if(name==='admin.html')body=String(body).replace('</body>','<script src="/admin-session.js"></script></body>');
     return route.fulfill({body,contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')||name.endsWith('.mjs')?'text/javascript':'text/html'});
    }catch{return route.fulfill({status:404});}
   });
   const page=await context.newPage();
   const nav=async view=>{
    if(width<650)await page.locator('.mobileMenuToggle').click();
    await page.locator('.navBtn[data-view="'+view+'"]').click();
   };
   const show=async()=>{
    const card=page.locator('[data-payment-order-id="delivery-0"]');
    await card.waitFor();
    if(await card.locator('.paymentOrderCardDetails').getAttribute('hidden')!==null)await card.locator('[data-order-toggle]').click();
    await card.getByText('qa@example.test',{exact:true}).waitFor({state:'visible'});
   };
   await page.goto(origin+'/admin.html#dashboard');
   await nav('paymentOrders');
   await page.locator('[data-payment-order-id="payment-0"]').waitFor();
   let start=performance.now();
   await page.locator('[data-payment-pending-stage="delivery"]').click();
   await show();
   const firstMs=Math.round(performance.now()-start);
   await nav('products');
   start=performance.now();
   await nav('paymentOrders');await show();
   const returnMs=Math.round(performance.now()-start);
   const startTab=performance.now();
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   if(!before)assert.equal(await page.locator('[data-order-field-value]').filter({hasText:'qa@example.test'}).count(),4);
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
   await show();
   const tabMs=Math.round(performance.now()-startTab);
   start=performance.now();
   await page.reload();
   await nav('paymentOrders');
   await page.locator('[data-payment-order-id="payment-0"]').waitFor();
   await page.locator('[data-payment-pending-stage="delivery"]').click();await show();
   const reloadMs=Math.round(performance.now()-start);
   if(!before){
    assert.equal(detailRequests,0);
    assert.equal(await page.getByText('Sifariş sahələri yüklənir…',{exact:true}).count(),0);
    assert.equal(await page.locator('[data-payment-order-id="delivery-4"] [data-order-field-value]').count(),0);
    updated=true;
    const previousReads=listRequests;
    await page.locator('#paymentOrdersRefresh').evaluate(button=>{button.click();button.click();button.click();});
    assert.ok(await page.locator('[data-payment-order-id="delivery-0"]').getByText('qa@example.test',{exact:true}).isVisible());
    assert.equal(await page.getByText('Sifariş sahələri yüklənir…',{exact:true}).count(),0);
    await page.locator('[data-payment-order-id="delivery-0"]').getByText('updated@example.test',{exact:true}).waitFor();
    assert.equal(listRequests-previousReads,1);
    assert.equal(detailRequests,0);
    failed=true;await page.locator('#paymentOrdersRefresh').click();
    const errorCard=page.locator('[data-payment-order-id="delivery-2"]');
    if(await errorCard.locator('.paymentOrderCardDetails').getAttribute('hidden')!==null)await errorCard.locator('[data-order-toggle]').click();
    const retry=errorCard.getByRole('button',{name:'Yenidən cəhd et',exact:true});
    await retry.waitFor();
    await retry.click();
    await retry.waitFor({state:'detached'});
    assert.equal(detailRequests,1);
    sessionExpired=true;
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
    await page.waitForFunction(()=>!document.querySelector('[data-order-field-value]'));
    assert.equal(await page.locator('[data-order-field-value]').count(),0);
   }
   console.log(JSON.stringify({phase:before?'before':'after',engine:engine.name(),width,delay,firstMs,returnMs,tabMs,reloadMs,detailRequests,listRequests,live}));
   await context.unrouteAll({behavior:'wait'});await context.close();
  }
 }finally{await browser.close();}
}
