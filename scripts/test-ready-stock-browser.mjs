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
   const catalog={products:[{id:'capcut',title:'CapCut Pro',image:'/assets/capcut.png',readyTotal:8,scope:'product',version:4,plans:[item(0,'1 aylıq (Telefon)',40),{...item(1,'3 aylıq',40),ready:8}]},{id:'netflix',title:'Netflix',image:'/assets/netflix.png',readyTotal:0,scope:'plan',version:9,plans:[item(0,'Şəxsi paket',0)]},{id:'spotify',title:'Spotify',image:'/assets/spotify.png',readyTotal:0,scope:'none',version:0,plans:[item(0,'1 aylıq',null)]}]};
   const saves=[],salesWrites=[],p=catalog.products[0];let first=true;
   const note='Sintetik mesaj 1\n\nİstifadə qaydası: sınaq',note2='Sintetik mesaj 2\nİkinci sətir';
   await page.route('https://mirpanel.com/assets/*',route=>route.fulfill({contentType:'image/png',body:fs.readFileSync('.'+new URL(route.request().url()).pathname)}));
   await page.route('**/api/admin/payment-ready-stock**',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:catalog});
    const input=route.request().postDataJSON();
    if(route.request().url().endsWith('/sales')){
     assert.equal(input.expectedVersion,p.version);salesWrites.push(input.available);p.version++;
     for(const x of p.plans)x.sales=input.available;
     return route.fulfill({json:{ok:true}});
    }
    saves.push(input);assert.equal(input.productId,'capcut');assert.equal(input.index,0);
    assert.deepEqual(input.messages,[note,note2]);assert.equal(input.autoWallet,true);
    if(first){first=false;p.plans[0].ready=2;p.readyTotal=10;p.plans[0].autoWallet=true;return route.abort('connectionreset');}
    assert.deepEqual(input,saves[0]);return route.fulfill({json:{added:2,replayed:true}});
   });
   await page.goto(origin+'/admin.html');
   const product=page.getByLabel('Məhsul',{exact:true}),plan=page.getByLabel('Paket',{exact:true});
   const capcut=page.getByRole('button',{name:/CapCut Pro/}),netflix=page.getByRole('button',{name:/Netflix/}),price=page.getByLabel('Satış miqdarı');
   const stock=page.locator('[data-edit-sales]'),saveSales=page.getByRole('button',{name:'Satış stokunu saxla'});
   const messages=page.getByRole('textbox',{name:'Müştəriyə təqdim ediləcək hazır mesaj'}),automatic=page.getByRole('switch',{name:'Balansla avtomatik təhvil'});
   await netflix.click();assert.equal(await plan.locator('option').count(),1);assert.match(await stock.innerText(),/Stokda yoxdur/);
   await capcut.click();assert.equal(await plan.locator('option').count(),2);
   await stock.click();await price.fill('0');await saveSales.click();
   await page.waitForFunction(()=>document.querySelector('[data-sales]').textContent==='Limitsiz');
   await stock.click();await price.fill('50');await saveSales.click();
   await page.waitForFunction(()=>document.querySelector('[data-sales]').textContent==='50 satış vahidi');
   assert.deepEqual(salesWrites,[null,50]);assert.match(await capcut.innerText(),/8 hazır hesab/);
   await automatic.check();await messages.first().fill(note);
   await page.getByRole('button',{name:'+ Yeni hesab əlavə et'}).click();await messages.nth(1).fill(note2);
   await plan.selectOption('1');assert.equal(await messages.first().inputValue(),'');assert.equal(await automatic.isChecked(),false);
   await messages.first().fill('Digər paket üçün ayrıca qaralama');
   await netflix.click();assert.equal(await product.inputValue(),'netflix');assert.match(await stock.innerText(),/Stokda yoxdur/);
   await capcut.click();assert.equal(await capcut.getAttribute('aria-pressed'),'true');assert.equal(await plan.inputValue(),'1');assert.equal(await messages.first().inputValue(),'Digər paket üçün ayrıca qaralama');
   await plan.selectOption('0');assert.equal(await messages.nth(1).inputValue(),note2);assert.equal(await automatic.isChecked(),true);
   assert.equal(new URL(page.url()).pathname,'/admin.html');
   const submit=page.getByRole('button',{name:'Yadda saxla'});
   await submit.click();await page.getByText(/Eyni düymə ilə yenidən cəhd/).waitFor();
   assert.equal(await messages.nth(1).inputValue(),note2);
   await submit.click();await page.getByText('2 hazır hesab saxlanıldı.').waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-ready]').textContent==='2');
   assert.match(await capcut.innerText(),/10 hazır hesab/);assert.equal(await automatic.isChecked(),true);
   await capcut.locator('img').evaluate(img=>img.decode());
   assert.equal(await page.locator('textarea').count(),1);assert.equal(await page.locator('textarea').inputValue(),'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const folder=process.env.MIRPANEL_READY_STOCK_SCREENSHOTS;
   if(folder){fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:path.join(folder,width===1360?'hazir-hesab-stoku.png':'hazir-hesab-stoku-mobil.png'),fullPage:true});}
   await page.close();
   console.log('PASS '+width+'px — catalog photos, 0/50, previous out-of-stock, isolated drafts, two messages, retry and aggregate counts');
  }
 }finally{await browser.close();}
}finally{await new Promise(r=>server.close(r));}
