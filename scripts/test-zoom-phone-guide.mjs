import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {orderGuideFor,zoomPhoneSteps} from '../mirpanel-admin/order-guide.mjs';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT||'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='outputs/zoom-phone-guide';fs.mkdirSync(out,{recursive:true});
const guide=orderGuideFor({id:'zoom'},null,'1 aylıq');assert.equal(guide.tracks.phone.length,7);
assert.deepEqual(guide.tracks.phone,zoomPhoneSteps);
// Every pre-existing guide remains byte-for-byte equivalent at the data boundary.
const baseline=execFileSync('git',['show','185bebf:mirpanel-admin/order-guide.mjs'],{encoding:'utf8'});
const before=await import('data:text/javascript;base64,'+Buffer.from(baseline).toString('base64'));
for(const id of ['netflix','capcut','spotify','prime','chatgpt','surfshark'])assert.deepEqual(orderGuideFor({id},null,'1 aylıq'),before.orderGuideFor({id},null,'1 aylıq'));
const files=['browser-orders.js','browser-orders.css','delivery-message.mjs','zoom-guide.mjs','zoom-guide.css'];
const assets=new Map(files.map(file=>['/'+file,fs.readFileSync(file,'utf8')]));
if(process.argv.includes('--live'))for(const [file,local] of assets){const response=await fetch('https://mirpanel.com'+file+'?v=zoom-phone-1');assert.equal(response.status,200);assert.equal((await response.text()).replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));}
const html='<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="margin:0;background:#101115;color:white;font:14px system-ui"><main class="account-panel"><h1>Sifarişlərim</h1><div id="browserOrders"></div></main><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script></html>';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local'),p=url.pathname;const json=v=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));};
 if(assets.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(assets.get(p));}
 if(p==='/api/payments/my-orders')return json({orders:[{id:'zoom-synthetic',orderCode:'ZOOM-SINAQ',product:'Zoom Pro',status:'completed',amount:5,items:[{title:'Zoom Pro',productId:'zoom',planName:'1 aylıq',quantity:1,unitCents:500}],deliveries:[{id:'zoom-delivery',line:0,quantity:1}]}]});
 if(p.endsWith('/guide/0'))return json(guide);
 if(p.includes('/codes/'))return json({text:'Nümunə təhvil mesajı\nGirişdə çətinlik yaşayırsınızsa, zəhmət olmasa, Məlumat və təlimat keçidinə klikləyin.'});
 if(p.startsWith('/api/'))return json({});
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const results=[];
try{for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:process.env.MIRPANEL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
  await context.route('https://tinyhost.shop/**',r=>r.fulfill({contentType:'text/html',body:'<title>Isolated link test</title>'}));
  await page.goto(base+'/profil?tab=orders&order=ZOOM-SINAQ&guide=0');
  const dialog=page.locator('.browser-order-guide[open]');await dialog.locator('.zoom-demo').waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Təlimat',exact:true}).getAttribute('aria-pressed'),'true');
  const shell=dialog.locator('.zoom-handset');await shell.evaluate(n=>{window.testPhone=n;});const first=await shell.boundingBox();
  for(let i=0;i<7;i++){
   assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-scene'),['welcome','email','password','otp','webmail','inbox','code'][i]);
   assert.match(await dialog.locator('.browser-guide-text').textContent(),new RegExp(zoomPhoneSteps[i].description.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   assert.equal(await shell.evaluate(n=>n===window.testPhone),true);
   const bounds=await shell.boundingBox();assert.ok(Math.abs(bounds.width-first.width)<.1&&Math.abs(bounds.height-first.height)<.1);
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
   assert.equal(await dialog.locator('.zoom-demo svg').getAttribute('viewBox'),'0 0 738 1600');
   const pause=dialog.getByRole('button',{name:'Animasiyanı dayandır',exact:true});await pause.click();
   assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-paused'),'true');
   assert.ok(await dialog.locator('.zoom-cue').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).animationPlayState==='paused')));
   await dialog.getByRole('button',{name:'Təkrar göstər',exact:true}).click();assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-paused'),'true');
   await dialog.getByRole('button',{name:'Animasiyanı davam etdir',exact:true}).click();
   if(i===0){assert.equal(await dialog.locator('.zoom-cue').evaluate(n=>getComputedStyle(n).animationDuration),'3s');await page.waitForTimeout(3100);assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-scene'),'welcome');}
   if(i===2){assert.match(await dialog.locator('.zoom-demo').textContent(),/••••••••••/);}
   if(i===3)assert.equal(await dialog.locator('.zoom-digit').count(),0);
   if(i===4){const link=dialog.getByRole('link',{name:'Webmail-i aç'});assert.equal(await link.getAttribute('href'),'https://tinyhost.shop');assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);const popupWait=context.waitForEvent('page');await link.click();const popup=await popupWait;await popup.waitForLoadState();assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();}
   if(i===5){assert.equal(await dialog.locator('.zoom-phase-view text').count(),0);await page.waitForTimeout(5300);}
   if(i===6){assert.equal(await dialog.locator('.zoom-digit').allTextContents().then(a=>a.join('')),'123456');await page.waitForTimeout(5500);}
   if(name==='chrome'&&(width===390||width===1440)){await dialog.screenshot({path:`${out}/${width}-step-${i+1}.png`});}
   await dialog.getByRole('button',{name:'Təkrar göstər',exact:true}).click();
   if(i<6)await dialog.getByRole('button',{name:'Növbəti',exact:true}).click();
  }
  assert.ok(await dialog.getByRole('button',{name:'Növbəti',exact:true}).isDisabled());
  await dialog.getByRole('button',{name:'Əvvəlki',exact:true}).click();assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-scene'),'inbox');
  await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await dialog.locator('.zoom-cue').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).animationName==='none')));
  await dialog.getByRole('button',{name:'Növbəti',exact:true}).click();assert.equal(await dialog.locator('.zoom-return-stage').evaluate(n=>getComputedStyle(n).opacity),'1');
  await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
  // The message's existing instruction link resolves the same exact order/line.
  const link=page.getByRole('link',{name:'Məlumat və təlimat',exact:true});await link.click();await dialog.locator('.zoom-demo').waitFor();
  assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-scene'),'welcome');
  await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
  await page.locator('[data-order-info]').click();await dialog.locator('.zoom-demo').waitFor();
  assert.equal(await dialog.locator('.zoom-demo').getAttribute('data-scene'),'welcome');
  assert.deepEqual(errors,[]);assert.ok(external.every(u=>u==='https://tinyhost.shop/'));
  results.push({browser:name,width,steps:7,phoneStable:true,privateData:false,realOperations:0});console.log('PASS',name,width);await context.close();
 }}finally{await browser.close();}
}fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
