import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';

const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const live=process.argv.includes('--live'),out='outputs/delivery-guide-link';
const footer='Girişdə çətinlik yaşayırsınızsa, zəhmət olmasa, Məlumat və təlimat keçidinə klikləyin.';
const sample='Sınaq təhvil mesajı\nE-poçt: sample@example.test\nŞifrə: https://example.test/secret\n2FA açarı: DEMO-ONLY-0000\n[https://2fa.live/]\nDigər keçid (http://example.test/reset?x=1&y=2). Sonra https://example.test/path(a),\n<script>window.messageExecuted=true</script>\n\n'+footer;
const expectedLinks=['https://example.test/secret','https://2fa.live/','http://example.test/reset?x=1&y=2','https://example.test/path(a)'];
const products=['Netflix Şəxsi','Spotify'],orderId='11111111-1111-4111-8111-111111111111';
const guides=['netflix','spotify'].map(id=>orderGuideFor({id},null,'1 aylıq'));
const syntheticRow={id:'delivery-0',order_code:'SINAQ-01',line_index:1,checkout_snapshot:{cartVersion:2,items:products.map(title=>({title,planName:'1 aylıq',quantity:1,unitCents:500}))}};
const scoped=createAccountOrders({resolve:async request=>request.owner?{userId:'synthetic-owner',codes:async()=>[syntheticRow]}:null});
const codeList=await scoped.codes({owner:true});
assert.equal(codeList.codes[0].orderCode,'SINAQ-01');assert.equal(codeList.codes[0].lineIndex,1);assert.equal(codeList.codes[0].title,'Spotify');
await assert.rejects(scoped.codes({}),{status:401});
const assets=new Map();
for(const [name,file] of Object.entries({'browser-orders.js':'browser-orders.js','browser-orders.css':'browser-orders.css','delivery-message.mjs':'delivery-message.mjs','ready-stock-admin.js':'mirpanel-admin/public/ready-stock-admin.js'})){
 const body=fs.readFileSync(file,'utf8');
 if(live){
  const response=await fetch((name.startsWith('ready-')?'https://mirpanel.onrender.com/':'https://mirpanel.com/')+name+'?v=delivery-links-2');
  assert.equal(response.status,200);assert.equal((await response.text()).replaceAll('\r\n','\n'),body.replaceAll('\r\n','\n'));
 }
 assets.set('/'+name,body);
}
const html='<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#101115;color:white;font:14px system-ui"><main class="account-panel"><h1>Sifarişlərim</h1><div id="browserOrders"></div></main><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script></html>';
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname;
 const json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(assets.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(assets.get(p));}
 if(p==='/api/payments/my-orders')return json({orders:[{id:orderId,orderCode:'SINAQ-01',product:products.join(' · '),status:'completed',amount:10,items:products.map(title=>({title,planName:'1 aylıq',quantity:1,unitCents:500})),deliveries:products.map((_,i)=>({id:'delivery-'+i,line:i,quantity:1}))}]});
 if(p.includes('/codes/delivery-'))return json({text:p.endsWith('1')?sample.replaceAll('\n','\r'):sample});
 if(/\/guide\/[01]$/.test(p))return json(guides[Number(p.at(-1))]);
 if(p==='/admin-fixture'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><meta charset="utf-8"><div id="host"></div><script type="module">import {mountReadyStock} from "/ready-stock-admin.js";const product={id:"a",title:"Netflix Şəxsi",message:"Hazır hesab",plans:[{index:0,label:"1 aylıq",ready:0}]};mountReadyStock(document.querySelector("#host"),async(path,options)=>{if(options?.method==="POST"){const data=JSON.parse(options.body);window.savedTemplate=data;product.message=data.message;return {message:product.message};}return {products:[product]};});</script>');
 }
 if(p.startsWith('/api/'))return json({});
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
fs.mkdirSync(out,{recursive:true});
try{
 for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:process.env.MIRPANEL_CHROME}:{})});
  try{
   for(const width of [390,1440]){
    const record=name==='chrome'&&width===390;
    const ctx=await browser.newContext({viewport:{width,height:850},...(record?{recordVideo:{dir:out,size:{width,height:850}}}:{})});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{
     write:async items=>{window.copiedMessage=await(await items[0].getType('text/plain')).text();},
     writeText:async text=>{window.copiedMessage=text;}
    }}));
    await ctx.route('https://2fa.live/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic external target</title>'}));
    if(!record)await page.route('**/codes/delivery-1',async route=>{
     const response=await route.fetch(),body=await response.json();
     await route.fulfill({json:{text:'<img onerror="alert(1)">\n'+body.text}});
    });
    await page.goto(base+'/sifarislerim');
    const links=page.getByRole('link',{name:'Məlumat və təlimat',exact:true});
    await links.nth(1).waitFor();
    assert.equal(await links.count(),2);assert.equal(await page.locator('.browser-order-delivery pre img').count(),0);
    const external=page.locator('.delivery-message-link');
    await external.nth(7).waitFor();
    assert.deepEqual(await external.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),[...expectedLinks,...expectedLinks]);
    assert.equal(await page.locator('.browser-order-delivery pre script').count(),0);
    assert.equal(await page.evaluate(()=>window.messageExecuted),undefined);
    assert.equal(await page.locator('.browser-order-delivery pre').first().textContent(),sample);
    await page.locator('[data-copy-delivery]').first().click();
    await page.waitForFunction(text=>window.copiedMessage===text,sample);
    for(const link of await external.all()){
     assert.equal(await link.getAttribute('target'),'_blank');
     assert.match(await link.getAttribute('rel'),/noopener/);
     assert.equal(await link.evaluate(n=>getComputedStyle(n).color),'rgb(37, 131, 255)');
     assert.match(await link.evaluate(n=>getComputedStyle(n).textDecorationLine),/underline/);
    }
    const popupPromise=ctx.waitForEvent('page');await external.filter({hasText:"https://2fa.live/"}).first().click();const popup=await popupPromise;
    await popup.waitForLoadState();assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
    for(const [i,title] of products.entries()){
     const link=links.nth(i),initial=page.url();
     assert.equal(await link.evaluate(n=>getComputedStyle(n).color),'rgb(37, 131, 255)');
     assert.match(await link.evaluate(n=>getComputedStyle(n).textDecorationLine),/underline/);
     if(record){await link.scrollIntoViewIfNeeded();await page.waitForTimeout(650);}
     await link.click();
     const guide=page.locator('.browser-order-guide[open]');
     await guide.locator('.browser-guide-handset-screen').waitFor();
     assert.ok((await guide.locator('.browser-guide-text').textContent()).includes(guides[i].tracks.phone[0].description));
     assert.equal(await guide.locator('h2').textContent(),title);
     assert.equal(await guide.getByRole('button',{name:'Təlimat',exact:true}).getAttribute('aria-pressed'),'true');
     if(record)await page.waitForTimeout(1000);
     await guide.getByRole('button',{name:'Bağla',exact:true}).click();
     assert.equal(page.url(),initial);assert.equal(await link.evaluate(n=>n===document.activeElement),true);
    }
    if(name==='chrome')await page.screenshot({path:path.join(out,'orders-'+width+'.png'),fullPage:true});
    await page.goto(base+'/profil?tab=orders&order=SINAQ-01&guide=1');
    const targeted=page.locator('.browser-order-guide[open]');
    await targeted.locator('.browser-guide-handset-screen').waitFor();
    assert.equal(await targeted.locator('h2').textContent(),'Spotify');
    await targeted.getByRole('button',{name:'Bağla',exact:true}).click();
    const video=page.video();await ctx.close();if(video)fs.renameSync(await video.path(),path.join(out,'mobil-demo.webm'));
    assert.deepEqual(errors,[]);console.log('PASS customer',name,width);
   }
   const page=await browser.newPage();await page.goto(base+'/admin-fixture');
   const add=page.getByRole('button',{name:'Məlumat və təlimat keçidini əlavə et',exact:true});
   await add.click();assert.equal(await page.locator('[name=template]').inputValue(),'Hazır hesab\n\n'+footer);assert.ok(await add.isDisabled());
   await page.getByRole('button',{name:'Hazır mesajı saxla',exact:true}).click();await page.getByText('Hazır mesaj saxlanıldı.',{exact:true}).waitFor();
   assert.deepEqual(await page.evaluate(()=>window.savedTemplate),{productId:'a',message:'Hazır hesab\n\n'+footer});
   await page.locator('[name=template]').fill('a'.repeat(7980));await add.click();
   assert.equal((await page.locator('[name=template]').inputValue()).length,7980);
   await page.close();console.log('PASS admin one click, duplicate and size checks',name);
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
