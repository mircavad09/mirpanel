import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='https://mirpanel.test',out='outputs/order-player';await fs.mkdir(out,{recursive:true});
const longName='Sınaq oyunçusu '+('UzunOyunçuAdı'.repeat(7));
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}}}));
  let state='preparing',writes=0;
  const order=()=>({id:'00000000-0000-4000-8000-000000000001',orderCode:'12919',product:'Free Fire + PUBG Mobile',amount:25.08,status:state==='completed'?'completed':'preparing',supplierProcessing:state==='processing',createdAt:'2026-11-16T12:00:00Z',items:[{title:'Free Fire',productId:'free_fire',planName:'572 Almaz (7/24) — sınaq paketi',quantity:2,unitCents:754,player:{id:'00123456789',name:longName,verified:true}},{title:'PUBG Mobile',productId:'pubg_mobile',planName:'60 UC — sınaq paketi',quantity:1,unitCents:1000,player:{id:'000987654321',name:'MUST NOT SHOW',verified:false}}]});
  await page.route(base+'/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;if(req.method()!=='GET'){writes++;return route.fulfill({status:403,json:{error:'Writes forbidden'}});}
   if(p==='/sifarislerim')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/browser-orders.css"><main class="account-panel" style="max-width:1000px;margin:auto"><h1>Sifarişlərim</h1><div id="browserOrdersError" hidden></div><div id="browserOrders"></div><button id="browserOrdersMore" hidden>Daha çox</button><dialog id="browserReceipt"><button id="browserReceiptClose">Bağla</button><div id="browserReceiptContent"></div></dialog></main><script src="/browser-orders.js"></script>'});
   if(p==='/api/payments/my-orders')return route.fulfill({json:{accountId:'synthetic-owner',orders:[order()],nextCursor:null}});
   if(p.startsWith('/api/'))return route.fulfill({json:{}});
   try{return await route.fulfill({body:await fs.readFile(p.slice(1)),contentType:p.endsWith('.css')?'text/css':'text/javascript'});}catch{return route.fulfill({status:404,body:''});}
  });
  for(state of ['preparing','processing','completed']){
   await page.goto(base+'/sifarislerim?order=12919');await page.locator('.browser-order-player').first().waitFor();
   assert((await page.locator('.browser-order-status').innerText()).includes({preparing:'Hazırlanır',processing:'İcra olunur',completed:'Tamamlandı'}[state]));
   const rows=page.locator('.browser-order-player');assert.equal(await rows.count(),2);
   assert((await rows.nth(0).innerText()).includes(longName));assert((await rows.nth(1).innerText()).includes('Oyunçu adı yoxlanıla bilmədi'));assert(!(await rows.nth(1).innerText()).includes('MUST NOT SHOW'));
   for(const [i,id]of [[0,'00123456789'],[1,'000987654321']]){const b=rows.nth(i).getByRole('button',{name:'Oyunçu ID-sini kopyala'});await b.click();assert.equal(await page.evaluate(()=>window.copied),id);assert((await rows.nth(i).innerText()).includes('Kopyalandı'));const box=await b.boundingBox();assert(box.width>=44&&box.height>=44);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
   assert((await page.locator('.browser-order-line-meta').first().innerText()).includes('2 × 7,54 ₼'));
  }
  assert.equal(writes,0);assert.deepEqual(errors,[]);await page.screenshot({path:out+'/'+engine.name()+'-'+width+'.png',fullPage:true});await page.close();console.log(JSON.stringify({engine:engine.name(),width,statuses:true,longName:true,unverifiedName:true,leadingZeroCopy:true,reload:true,overflow:false,writes}));
 }}finally{await browser.close();}
}
