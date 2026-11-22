import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT||'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const live=process.argv.includes('--live');
const paths={'/admin.css':'mirpanel-admin/public/admin.css','/ready-stock-admin.css':'mirpanel-admin/public/ready-stock-admin.css','/ready-stock-admin.js':'mirpanel-admin/public/ready-stock-admin.js'};
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 if(p!=='/admin.html'&&!paths[p]&&!p.includes('..')&&fs.existsSync('mirpanel-admin/public'+p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync('mirpanel-admin/public'+p));}
 if(paths[p]){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(paths[p]));}
 if(p!=='/admin.html'){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html lang="az"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/ready-stock-admin.css"><main style="max-width:1150px;margin:25px auto;padding:0 10px"><h1>Hazır hesab stoku</h1><div id="stock"></div></main><script type="module">import {mountReadyStock} from '/ready-stock-admin.js';mountReadyStock(document.querySelector('#stock'),async(url,options)=>{const r=await fetch(url,options);if(!r.ok)throw Object.assign(Error('Sınaq bağlantısı kəsildi.'),{status:r.status});return r.json();});</script></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;

try{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:920}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const catalog={products:[{id:'future_product',title:'Synthetic future ready product',readyTotal:3,scope:'product',version:1,plans:[{index:0,title:'Birinci paket',signature:'one',ready:3,sales:20,waiting:5,autoWallet:false,allowWaiting:false,readyManaged:true},{index:1,title:'İkinci paket',signature:'two',ready:0,sales:20,waiting:2,autoWallet:false,readyManaged:true}]}]};
  const calls=[];let failed=false;
  await page.route('**/api/admin/payment-ready-stock**',async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:catalog});
   const input=route.request().postDataJSON();calls.push(input);
   const settings=input.readyDeliverySettings;
   assert.equal(settings.productId,'future_product');assert.equal(settings.index,0);assert.equal(settings.planSignature,'one');
   assert.equal('accounts' in input,false);
   if(!failed){failed=true;return route.fulfill({status:503,json:{error:'Synthetic retry'}});}
   catalog.products[0].plans[0].autoWallet=settings.autoWallet;
   catalog.products[0].plans[0].allowWaiting=settings.allowWaiting;
   catalog.products[0].plans[0].waiting=2;catalog.products[0].plans[0].ready=0;catalog.products[0].readyTotal=0;
   return route.fulfill({json:{saved:true,fulfillment:{completed:3,units:3,waiting:2}}});
  });
  await page.goto(origin+'/admin.html');
  const auto=page.locator('[name="auto"]'),save=page.getByRole('button',{name:'Təhvil seçimini saxla',exact:true});
  await auto.check();await page.locator('[name="allowWaiting"]').check();
  await save.click();assert.equal(await auto.isChecked(),true);
  await save.click();await page.getByText('Avtomatik təhvil aktivləşdirildi. 3 sifariş tamamlandı, 2 sifariş stok gözləyir.',{exact:true}).waitFor();
  assert.equal(await auto.isChecked(),true);assert.equal(await page.locator('[data-ready]').innerText(),'0');
  assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
  await page.reload();assert.equal(await auto.isChecked(),true);
  await auto.uncheck();await save.click();await page.getByText('Avtomatik təhvil söndürüldü.',{exact:true}).waitFor();
  assert.equal(await auto.isChecked(),false);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();console.log('PASS '+width+'px settings button: exact package, persistent auto switch, retry, completion and waiting counts, disabled');
 }}finally{await browser.close();}
}finally{await new Promise(r=>server.close(r));}
