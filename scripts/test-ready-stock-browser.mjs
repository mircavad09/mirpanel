import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const paths={'/admin.css':'mirpanel-admin/public/admin.css','/ready-stock-admin.css':'mirpanel-admin/public/ready-stock-admin.css','/ready-stock-admin.js':'mirpanel-admin/public/ready-stock-admin.js'};
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 if(paths[p]){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(paths[p]));}
 if(p!=='/admin.html'){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html lang="az"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/ready-stock-admin.css"><main style="max-width:1150px;margin:25px auto;padding:0 10px"><h1>Hazır hesab stoku</h1><div id="stock"></div></main><script type="module">import {mountReadyStock} from '/ready-stock-admin.js';mountReadyStock(document.querySelector('#stock'),async(url,options)=>{const r=await fetch(url,options);if(!r.ok)throw Object.assign(Error('Sınaq bağlantısı kəsildi.'),{status:r.status});return r.json();});</script></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const cms=fs.readFileSync('mirpanel-admin/public/cms-admin.js','utf8');
assert.match(cms,/\["paymentOrders", "Sifarişlər"\], \["readyStock", "Hazır hesab stoku"\]/);
assert.match(cms,/data-dashboard-view="readyStock">\+ Hazır hesab əlavə et/);
try{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const width of [1360,390]){
   const page=await browser.newPage({viewport:{width,height:920},isMobile:width<600,hasTouch:width<600});
   page.setDefaultTimeout(7000);page.on('pageerror',error=>console.error(error.message));
   const item=(index,title,sales)=>({index,title,signature:'test-'+index,sales,ready:0,autoWallet:false});
   const catalog={products:[{id:'capcut',title:'CapCut Pro',scope:'product',version:4,plans:[item(0,'1 aylıq (Telefon)',40),item(1,'3 aylıq',40)]},{id:'netflix',title:'Netflix',scope:'plan',version:9,plans:[item(0,'Şəxsi paket',12)]}]};
   const saves=[],p=catalog.products[0];let first=true;
   await page.route('**/api/admin/payment-ready-stock**',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:catalog});
    const input=route.request().postDataJSON();
    if(route.request().url().endsWith('/sales')){
     assert.equal(input.available,50);assert.equal(input.expectedVersion,4);
     for(const x of p.plans)x.sales=50;
     return route.fulfill({json:{ok:true}});
    }
    saves.push(input);assert.equal(input.productId,'capcut');assert.equal(input.index,0);
    assert.deepEqual(input.messages,['Sintetik mesaj 1','Sintetik mesaj 2','Sintetik mesaj 3','Sintetik mesaj 4','Sintetik mesaj 5']);
    if(first){first=false;p.plans[0].ready=5;p.plans[0].autoWallet=true;return route.abort('connectionreset');}
    assert.deepEqual(input,saves[0]);return route.fulfill({json:{added:5,replayed:true}});
   });
   await page.goto(origin+'/admin.html');
   const product=page.getByLabel('Məhsul',{exact:true}),plan=page.getByLabel('Paket',{exact:true});
   await product.selectOption('netflix');assert.equal(await plan.locator('option').count(),1);
   await product.selectOption('capcut');assert.equal(await plan.locator('option').count(),2);
   await page.getByLabel('Satış miqdarı').fill('50');await page.getByRole('button',{name:'Satış stokunu saxla'}).click();
   await page.waitForFunction(()=>document.querySelector('[data-sales]').textContent==='50');
   await page.getByLabel('Balansla avtomatik təhvil').check();
   for(let i=0;i<5;i++){
    if(i)await page.getByRole('button',{name:'+ Yeni hesab əlavə et'}).click();
    await page.getByRole('textbox',{name:'Müştəriyə təqdim ediləcək mətn'}).nth(i).fill('Sintetik mesaj '+(i+1));
   }
   const submit=page.getByRole('button',{name:'Yadda saxla'});
   await submit.click();await page.getByText(/Eyni düymə ilə yenidən cəhd/).waitFor();
   assert.equal(await page.locator('textarea').nth(4).inputValue(),'Sintetik mesaj 5');
   await submit.click();await page.getByText('5 hazır hesab saxlanıldı.').waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-ready]').textContent==='5');
   assert.equal(await page.locator('textarea').count(),1);assert.equal(await page.locator('textarea').inputValue(),'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const folder=process.env.MIRPANEL_READY_STOCK_SCREENSHOTS;
   if(folder){fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:path.join(folder,width===1360?'hazir-hesab-stoku.png':'hazir-hesab-stoku-mobil.png'),fullPage:true});}
   await page.close();
   console.log('PASS '+width+'px — catalog, sales 50, five units, retry and separate counts');
  }
 }finally{await browser.close();}
}finally{await new Promise(r=>server.close(r));}
