import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='outputs/cancelled-orders';await fs.mkdir(out,{recursive:true});
const live=process.argv.includes('--live-assets'),results=[];
for(const engine of [chromium,webkit])for(const width of [320,390,430,1440]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/profil')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/browser-orders.css"><body style="margin:0;background:#080b0d;color:white;font:14px system-ui"><main class="account-panel" style="max-width:920px;margin:20px auto;padding:10px"><h1>Sifarişlərim</h1><p>İzolyasiya edilmiş sınaq məlumatları</p><section id="browserOrders"></section><p id="browserOrdersError" hidden></p><button id="browserOrdersMore" hidden>More</button><dialog id="browserReceipt"><button id="browserReceiptClose">Close</button><div id="browserReceiptContent"></div></dialog></main>'});
   if(['/browser-orders.js','/browser-orders.css'].includes(u.pathname)){
    const local=await fs.readFile('.'+u.pathname,'utf8');let body=local;
    if(live){const r=await fetch('https://mirpanel.com'+u.pathname+'?v=cancelled-inputs-1');assert(r.ok);body=await r.text();assert.equal(body.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));}
    return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body});
   }
   if(u.pathname==='/checkout-sounds.js')return route.fulfill({contentType:'text/javascript',body:'export function playCheckoutSound(){}'});
   return route.fulfill({status:404,body:''});
  });
  await page.goto('https://orders.test/profil');await page.evaluate(()=>window.mirpanelAccountMounting=true);await page.addScriptTag({url:'/browser-orders.js'});
  await page.evaluate(()=>{
   const id=n=>'12345678-1234-4234-8234-'+String(n).padStart(12,'0');
   const make=(n,product)=>({id:id(n),orderCode:String(9000+n),product,amount:5.49,status:'cancelled',createdAt:'2026-11-22T09:00:00Z',items:[{title:product,quantity:1,planName:'1 ay',unitCents:549}],cancellation:{full:true,lines:[{index:0,quantity:1}],refundCents:549,refundStatus:n===1?'wallet_refunded':'card_pending',reason:'Ünvanı yoxlayın:\n[https://example.test/help?query='+('long'.repeat(40))+']\n<img src=x onerror=alert(1)> javascript:alert(1)'}});
   window.testOrders=[make(1,'Spotify Premium'),make(2,'Canva Premium'),make(3,'Köhnə sifariş')];window.testOrders[2].status='rejected';delete window.testOrders[2].cancellation;window.inputReads=[];
   window.testApi=async path=>{
    if(path==='my-orders')return {accountId:'owner',orders:window.testOrders,nextCursor:null};
    if(path.endsWith('/inputs')){
     const orderId=path.split('/')[1],n=Number(orderId.slice(-1));window.inputReads.push(orderId);
     const data={accountId:'owner',orderId,lines:[{title:window.testOrders[n-1].product,planName:'1 ay',fields:n===3?[]:[{label:'Hesabın e-poçtu',value:n===1?'spotify-product@example.test':'canva-product@example.test',sensitive:false},...(n===1?[{label:'Hesabın şifrəsi',value:'SYNTHETIC-PRODUCT-SECRET',sensitive:true}]:[])]}]};
     if(window.delayInputs&&n===1)return new Promise(resolve=>window.releaseInputs=()=>resolve(data));return data;
    }throw Error('Unexpected request '+path);
   };
   window.disposeTest=window.mountBrowserOrders({profile:true,api:window.testApi});
  });
  const first=page.locator('[data-order-code="9001"]');await first.locator('summary').click();
  await first.getByText('spotify-product@example.test',{exact:true}).waitFor();
  const password=first.getByRole('textbox',{name:'Hesabın şifrəsi',exact:true});assert.equal(await password.getAttribute('type'),'password');
  await first.getByRole('button',{name:'Hesabın şifrəsi göstər',exact:true}).click();assert.equal(await password.getAttribute('type'),'text');assert.equal(await password.inputValue(),'SYNTHETIC-PRODUCT-SECRET');
  await first.getByRole('button',{name:'Hesabın şifrəsi gizlət',exact:true}).click();assert.equal(await password.getAttribute('type'),'password');
  const link=first.locator('.browser-order-reason-link');assert.equal(await link.getAttribute('target'),'_blank');assert((await link.getAttribute('rel')).includes('noopener'));assert((await link.getAttribute('href')).startsWith('https://example.test/help?'));
  assert.equal(await first.locator('.browser-order-cancellation-reason img').count(),0);assert((await first.innerText()).includes('<img src=x onerror=alert(1)>'));
  assert(!(await first.innerText()).includes('1 ədəd ləğv edildi'));assert(!(await first.innerText()).includes('təhvil verilməyən hissəsi'));
  assert.equal(await first.locator('.browser-order-instructions:visible').count(),0,'No empty delivery panel on full cancellation');
  assert.equal(await first.locator('.browser-order-refund').innerText(),'Məbləğ MirPanel balansınıza qaytarılıb');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(engine===chromium&&[390,1440].includes(width))await page.screenshot({path:out+'/'+(live?'live-assets':'local')+'-'+width+'.png',fullPage:true});
  await first.locator('summary').click();await page.waitForFunction(()=>!document.querySelector('[data-order-code="9001"] input'));assert.equal(await first.locator('input').count(),0);
  await first.locator('summary').click();await first.getByText('spotify-product@example.test',{exact:true}).waitFor();assert.equal(await password.getAttribute('type'),'password');
  const second=page.locator('[data-order-code="9002"]');await second.locator('summary').click();await second.getByText('canva-product@example.test',{exact:true}).waitFor();assert(!((await second.innerText()).includes('spotify-product')));assert.equal(await second.locator('input[type=password]').count(),0);assert(!(await second.innerText()).includes('balansınıza qaytarılıb'));
  const third=page.locator('[data-order-code="9003"]');await third.locator('summary').click();await third.getByText('Bu sifariş üçün daxil edilmiş məlumat saxlanmayıb.',{exact:true}).waitFor();
  await page.evaluate(()=>window.delayInputs=true);await first.locator('summary').click();await page.waitForFunction(()=>typeof window.releaseInputs==='function');await second.locator('summary').click();await second.getByText('canva-product@example.test',{exact:true}).waitFor();await page.evaluate(()=>window.releaseInputs());assert.equal(await first.locator('input').count(),0);
  await page.evaluate(()=>{window.disposeTest();window.delayInputs=false;const o=window.testOrders[0];o.status='preparing';o.items[0].quantity=3;o.cancellation.full=false;o.cancellation.lines[0].quantity=2;o.cancellation.refundStatus='card_pending';window.disposeTest=window.mountBrowserOrders({profile:true,api:window.testApi});});
  await first.locator('summary').click();await first.getByText('spotify-product@example.test',{exact:true}).waitFor();assert((await first.innerText()).includes('2 ədəd ləğv edildi'));assert((await first.innerText()).includes('təhvil verilməyən hissəsi'));assert(!(await first.innerText()).includes('balansınıza qaytarılıb'));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null})));await page.getByText('Sifarişlərinizi görmək üçün hesabınıza daxil olun.',{exact:true}).waitFor();assert.equal(await page.locator('[data-customer-inputs] input').count(),0);
  assert.deepEqual(errors,[]);results.push({engine:engine.name(),width,passed:true,mode:live?'live assets, isolated data':'local isolated',realOrdersChanged:0});console.log(JSON.stringify(results.at(-1)));
 }finally{await browser.close();}
}
await fs.writeFile(out+'/'+(live?'live':'local')+'-checks.json',JSON.stringify(results,null,2));
