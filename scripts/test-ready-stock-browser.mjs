import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT||'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const live=process.argv.includes('--live');
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
try{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  if(live){
   const ctx=await browser.newContext();
   for(const name of Object.keys(paths)){
    const r=await ctx.request.get('https://mirpanel.onrender.com'+name+'?v=ready-account-password-1');
    assert(r.ok());
    assert.equal((await r.text()).replaceAll('\r\n','\n'),fs.readFileSync(paths[name],'utf8').replaceAll('\r\n','\n'));
   }
   await ctx.close();
  }
  for(const width of [1360,390]){
   const page=await browser.newPage({viewport:{width,height:920},isMobile:width<600,hasTouch:width<600});
   await page.context().grantPermissions(['clipboard-read','clipboard-write']);
   page.setDefaultTimeout(7000);page.on('pageerror',error=>console.error(error.message));
   const item=(index,title,sales)=>({index,title,signature:'test-'+index,sales,ready:0,autoWallet:false});
   const catalog={products:[{id:'capcut',title:'CapCut Pro',image:'/assets/capcut.png',readyTotal:8,scope:'product',version:4,plans:[item(0,'1 aylıq (Telefon)',40),{...item(1,'3 aylıq',40),ready:8}]},{id:'netflix',title:'Netflix',image:'/assets/netflix.png',readyTotal:0,scope:'plan',version:9,plans:[item(0,'Şəxsi paket',0)]},{id:'spotify',title:'Spotify',image:'/assets/spotify.png',readyTotal:0,scope:'none',version:0,plans:[item(0,'1 aylıq',null)]}]};
   const saves=[],salesWrites=[],p=catalog.products[0];let first=true;
   const note='Sintetik mesaj 1\n\nİstifadə qaydası: sınaq',note2='Sintetik mesaj 2\nİkinci sətir';
   if(live)for(const name of Object.keys(paths))await page.route(origin+name,async route=>{
    const r=await route.fetch({url:'https://mirpanel.onrender.com'+name+'?v=ready-account-password-1'});
    return route.fulfill({response:r});
   });
   await page.route('https://mirpanel.com/assets/*',route=>route.fulfill({contentType:'image/png',body:fs.readFileSync('.'+new URL(route.request().url()).pathname)}));
   await page.route('**/api/admin/payment-ready-stock**',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:catalog});
    const input=route.request().postDataJSON();
    if(route.request().url().endsWith('/sales')){
     assert.equal(input.expectedVersion,p.version);salesWrites.push(input.available);p.version++;
     for(const x of p.plans)x.sales=input.available;
     return route.fulfill({json:{ok:true}});
    }
    if(route.request().url().endsWith('/message')){
     const product=catalog.products.find(x=>x.id===input.productId);
     product.message=input.message;return route.fulfill({json:{message:input.message}});
    }
    saves.push(input);assert.equal(input.productId,'capcut');assert.equal(input.index,0);
    assert.deepEqual(input.accounts,[{email:'first@example.test',password:'synthetic-one'},{email:'second@example.test',password:'synthetic-two'}]);assert.equal(input.autoWallet,true);
    if(first){first=false;p.plans[0].ready=2;p.readyTotal=10;p.plans[0].autoWallet=true;return route.abort('connectionreset');}
    assert.deepEqual(input,saves[0]);return route.fulfill({json:{added:2,replayed:true}});
   });
   await page.goto(origin+'/admin.html');
   const product=page.getByLabel('Məhsul',{exact:true}),plan=page.getByLabel('Paket',{exact:true});
   const capcut=page.getByRole('button',{name:/CapCut Pro/}),netflix=page.getByRole('button',{name:/Netflix/}),price=page.getByLabel('Satış miqdarı');
   const stock=page.locator('[data-edit-sales]'),saveSales=page.getByRole('button',{name:'Satış stokunu saxla'});
   const messages=page.getByRole('textbox',{name:'Müştəriyə təqdim ediləcək hazır mesaj'}),automatic=page.getByRole('switch',{name:/Ödəniş təsdiqlənəndə avtomatik təhvil/});
   await netflix.click();assert.equal(await plan.locator('option').count(),1);assert.match(await stock.innerText(),/Stokda yoxdur/);
   await capcut.click();assert.equal(await plan.locator('option').count(),2);
   await stock.click();await price.fill('0');await saveSales.click();
   await page.waitForFunction(()=>document.querySelector('[data-sales]').textContent==='Limitsiz');
   await stock.click();await price.fill('50');await saveSales.click();
   await page.waitForFunction(()=>document.querySelector('[data-sales]').textContent==='50 satış vahidi');
   assert.deepEqual(salesWrites,[null,50]);assert.match(await capcut.innerText(),/8 hazır hesab/);
   const saveMessage=page.getByRole('button',{name:'Hazır mesajı saxla'});
   await messages.fill(note);await saveMessage.click();await page.getByText('Hazır mesaj saxlanıldı.').waitFor();
   assert.equal(await page.locator('[data-ready]').innerText(),'0');
   await netflix.click();assert.equal(await messages.inputValue(),'');
   await messages.fill(note2);await saveMessage.click();await page.getByText('Hazır mesaj saxlanıldı.').waitFor();
   await page.reload();await capcut.click();assert.equal(await messages.inputValue(),note);
   await automatic.check();
   const email=page.getByLabel('Hesabın e-poçtu'),password=page.getByLabel('Hesabın şifrəsi');
   assert.equal(await email.first().inputValue(),'');assert.equal(await password.first().inputValue(),'');
   assert.equal(await password.first().getAttribute('type'),'text');
   await email.first().fill('first@example.test');await password.first().pressSequentially('synthetic-one');
   await page.getByRole('button',{name:'+ Yeni hesab əlavə et'}).click();
   assert.equal(await email.nth(1).inputValue(),'');assert.equal(await password.nth(1).inputValue(),'');
   await email.nth(1).fill('removed@example.test');await password.nth(1).fill('synthetic-remove');
   await page.getByRole('button',{name:'+ Yeni hesab əlavə et'}).click();
   const cards=page.locator('.readyStockAccount');
   assert.deepEqual(await cards.locator('h4').allTextContents(),['Hesab 1','Hesab 2','Hesab 3']);
   assert.equal(await email.nth(2).inputValue(),'');assert.equal(await password.nth(2).inputValue(),'');
   assert.deepEqual(await password.evaluateAll(inputs=>inputs.map(input=>input.type)),['text','text','text']);
   await email.nth(2).fill('second@example.test');
   await page.evaluate(()=>navigator.clipboard.writeText('synthetic-two'));
   await password.nth(2).press('Control+V');
   assert.equal(await password.nth(2).inputValue(),'synthetic-two');
   const layout=await cards.first().evaluate(card=>{
    const [email,password]=card.querySelectorAll('input');
    const a=email.getBoundingClientRect(),b=password.getBoundingClientRect();
    return {sameRow:Math.abs(a.top-b.top)<1,stacked:b.top>=a.bottom&&Math.abs(a.left-b.left)<1};
   });
   assert.equal(width===390?layout.stacked:layout.sameRow,true);
   const folder=process.env.MIRPANEL_READY_STOCK_SCREENSHOTS;
   if(folder){
    fs.mkdirSync(folder,{recursive:true});
    await page.locator('#stock').screenshot({path:path.join(folder,width===1360?'hesab-kartlari-komputer.png':'hesab-kartlari-mobil.png')});
   }
   await page.getByRole('group',{name:'Hesab 2',exact:true}).getByRole('button',{name:'Hesabı sil'}).click();
   assert.deepEqual(await cards.locator('h4').allTextContents(),['Hesab 1','Hesab 2']);
   assert.equal(await email.first().inputValue(),'first@example.test');
   assert.equal(await password.first().inputValue(),'synthetic-one');
   assert.equal(await email.nth(1).inputValue(),'second@example.test');
   assert.equal(await password.nth(1).inputValue(),'synthetic-two');
   await plan.selectOption('1');assert.equal(await messages.inputValue(),note);assert.equal(await email.first().inputValue(),'');
   await plan.selectOption('0');assert.equal(await email.nth(1).inputValue(),'second@example.test');
   const submit=page.getByRole('button',{name:'Hesabları və təhvil ayarını saxla'});
   await submit.click();await page.getByText(/Eyni düymə ilə yenidən cəhd/).waitFor();
   assert.equal(await email.nth(1).inputValue(),'second@example.test');
   await submit.click();await page.getByText('2 hazır hesab saxlanıldı.').waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-ready]').textContent==='2');
   assert.equal(await email.count(),1);assert.equal(await email.first().inputValue(),'');assert.equal(await password.first().inputValue(),'');
   assert.equal(await messages.inputValue(),note);
   await netflix.click();assert.equal(await messages.inputValue(),note2);
   await capcut.click();await capcut.locator('img').evaluate(img=>img.decode());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.close();
   console.log('PASS '+width+'px — catalog photos, 0/50, previous out-of-stock, product messages, three cards, middle removal, persistence, retry and aggregate counts');
  }
 }finally{await browser.close();}
}finally{await new Promise(r=>server.close(r));}
