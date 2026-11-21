import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live-assets'),out='outputs/customer-orders-accordion';await fs.mkdir(out,{recursive:true});
const results=[];
for(const engine of [chromium,webkit])for(const width of [320,390,430,1440]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://orders.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/profil')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#090c0e;color:white;font-family:system-ui;margin:0"><main class="account-panel" style="max-width:960px;margin:24px auto;padding:12px"><h1>Sifarişlərim</h1><p style="color:#aaa;font-size:12px">İzolyasiya edilmiş sınaq məlumatları</p><div id="browserOrders"></div><p id="browserOrdersError" hidden></p><button id="browserOrdersMore" hidden>Daha çox göstər</button><dialog id="browserReceipt"><button id="browserReceiptClose">Close</button><div id="browserReceiptContent"></div></dialog></main>`});
  if(['/browser-orders.js','/browser-orders.css','/delivery-message.mjs'].includes(path)){
   const local=await fs.readFile('.'+path,'utf8');let body=local;
   if(live){const response=await fetch('https://mirpanel.com'+path+'?v=orders-open-latest-1');assert(response.ok);body=await response.text();assert.equal(body.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));}
   return route.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body});
  }
  if(path.endsWith('checkout-sounds.js'))return route.fulfill({contentType:'text/javascript',body:'export function playCheckoutSound(){}'});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('https://orders.test/profil?tab=sifarislerim');
 await page.evaluate(()=>window.mirpanelAccountMounting=true);await page.addScriptTag({url:'/browser-orders.js'});
 await page.evaluate(()=>{
  const item={title:'CapCut Pro',planName:'1 aylıq',quantity:1,unitCents:499,durationMonths:1,repeat:{productId:'capcut',planIndex:0,planName:'1 aylıq'}};
  window.fixture={accountId:'synthetic',orders:[{id:'one',orderCode:'100',createdAt:'2026-11-21T08:00:00Z',product:'CapCut Pro + ChatGPT Plus',status:'preparing',amount:20.98,items:[item,{...item,title:'ChatGPT Plus',unitCents:1599,repeat:null}],deliveries:[{id:'delivery',line:0,quantity:1}]}],deliveryDetails:{delivery:{text:'Sintetik təlimat: https://example.test/help',email:'example@example.test'}}};
  window.orderUI={};window.mount=()=>window.mountBrowserOrders({ui:window.orderUI,profile:true,api:async()=>structuredClone(window.fixture)});window.disposeOrders=window.mount();
 });
 const open=()=>page.locator('[data-order-id][open]');await page.locator('[data-delivery]').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-order-id=one]').open);
 assert.equal(await open().count(),1);assert.equal(await page.getByRole('link',{name:'Yenilə',exact:true}).count(),0);
 await page.getByText('example@example.test',{exact:true}).waitFor();await page.getByText('Status: Hazırlanır. Təhvil məlumatı hazır deyil.',{exact:true}).waitFor();
 const enabled=page.locator('[data-buy-again]').first(),disabled=page.locator('[data-buy-again]').last();assert.equal(await enabled.isDisabled(),false);assert.equal(await disabled.isDisabled(),true);
 assert.equal(await enabled.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');assert.notEqual(await disabled.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
 await page.locator('summary .browser-order-heading').click();await page.waitForFunction(()=>!document.querySelector('[data-order-id=one]').open);
 await page.evaluate(()=>{fixture.orders[0].amount=20.97;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(120);assert.equal(await open().count(),0);
 await page.evaluate(()=>{fixture.orders.push({...fixture.orders[0],id:'old',orderCode:'99',createdAt:'2026-11-20T08:00:00Z',product:'Əvvəlki sifariş'});document.dispatchEvent(new Event('visibilitychange'));});await page.locator('[data-order-id=old]').waitFor();assert.equal(await open().count(),0);
 await page.locator('[data-order-id=old] summary .browser-order-heading').click();await page.waitForFunction(()=>document.querySelector('[data-order-id=old]').open);
 await page.locator('[data-order-id=one] summary .browser-order-heading').click();await page.waitForFunction(()=>document.querySelectorAll('[data-order-id][open]').length===1&&!document.querySelector('[data-order-id=old]').open);
 await page.evaluate(()=>{fixture.orders[0].amount=20.98;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(120);assert.equal(await open().getAttribute('data-order-id'),'one');
 await page.evaluate(()=>{fixture.orders.push({...fixture.orders[0],id:'new',orderCode:'101',createdAt:'2026-11-21T09:00:00Z'});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>document.querySelector('[data-order-id=new]')?.open);assert.equal(await open().count(),1);
 assert.deepEqual(await page.locator('[data-order-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.orderId)),['new','one','old']);
 await page.locator('[data-order-id=one] summary .browser-order-heading').click();await page.waitForFunction(()=>document.querySelectorAll('[data-order-id][open]').length===1&&document.querySelector('[data-order-id=one]').open);
 await page.evaluate(()=>{disposeOrders();disposeOrders=mount();});await page.waitForFunction(()=>document.querySelector('[data-order-id=one]')?.open);assert.equal(await open().count(),1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if([390,1440].includes(width)&&engine===chromium)await page.screenshot({path:out+'/'+(live?'live-assets':'local')+'-'+width+'.png',fullPage:true});
 await open().locator("[data-buy-again]").first().click();await page.locator('.browser-order-repeat[open]').waitFor();await page.getByRole('button',{name:'Ləğv et',exact:true}).click();
 assert.deepEqual(errors,[]);results.push({engine:engine.name(),width,single:true,partial:true,manualCollapse:true,accordion:true,newOrder:true,refreshPreserves:true,remountPreserves:true,rebuyDialog:true,overflow:false});console.log(JSON.stringify(results.at(-1)));
 }finally{await browser.close();}
}
await fs.writeFile(out+'/'+(live?'live-assets':'local')+'-results.json',JSON.stringify({results,syntheticData:true,productionWrites:0},null,2));
