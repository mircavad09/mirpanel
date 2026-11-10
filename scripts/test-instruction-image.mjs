import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live'),out='outputs/instruction-button',files=new Map();
fs.mkdirSync(out,{recursive:true});
for(const f of ['browser-orders.js','browser-orders.css']){
 const local=fs.readFileSync(f,'utf8'),response=live?await fetch('https://mirpanel.com/'+f+'?v=instruction-button-2'):null;
 if(response)assert.ok(response.ok);
 const content=response?await response.text():local;
 assert.equal(content.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+f,content);
}
const products=['CapCut Pro','Netflix Şəxsi','Prime Video'];
const order={id:'11111111-1111-4111-8111-111111111111',orderCode:'99001',status:'completed',product:'Sintetik çoxməhsullu sifariş',amount:14.97,createdAt:'2026-11-11T12:00:00Z',items:products.map(title=>({title,planName:'1 ay',quantity:1,unitCents:499}))};
let guides=[];
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://test').pathname;
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));};
 if(p==='/api/payments/my-orders')return json({orders:[order]});
 if(p.includes('/guide/')){const i=Number(p.split('/').at(-1));guides.push(i);return json({information:products[i]+' üçün sintetik təlimat',tracks:{}});}
 if(p==='/checkout-sounds.js'){res.setHeader('Content-Type','text/javascript');return res.end('export function playCheckoutSound(){}');}
 if(files.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':'text/javascript');return res.end(files.get(p));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="margin:12px;background:#080a0d;color:white;font-family:system-ui"><section class="account-panel"><h1>Sifarişlərim · Sınaq</h1><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const engine of [chromium,webkit])for(const width of [320,390,430,1440]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const recording=live&&engine===chromium&&width===390;
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500,...(recording?{recordVideo:{dir:out+'/recording',size:{width,height:900}}}:{})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('.browser-order').waitFor();await page.locator('.browser-order').evaluate(n=>n.open=true);
  const buttons=page.getByRole('button',{name:'Təlimat',exact:true});assert.equal(await buttons.count(),3);
  const first=buttons.first();await first.scrollIntoViewIfNeeded();
  assert.equal(await first.locator('img').count(),0);
  assert.equal(await first.locator('svg').count(),1);
  for(const b of await buttons.all()){
   const box=await b.boundingBox(),again=await b.locator('..').getByRole('button',{name:'Yenidən al'}).boundingBox();
   assert.equal(box.y,again.y);assert.equal(box.height,again.height);
   assert.ok(box.x+box.width<=again.x);
  }
  const box=await first.boundingBox(),handle=await first.elementHandle();
  await page.waitForFunction(n=>{const s=getComputedStyle(n,'::before');return +s.opacity>.5&&new DOMMatrixReadOnly(s.transform).m41<0;},handle);
  await page.waitForFunction(n=>{const s=getComputedStyle(n,'::before');return +s.opacity>.5&&new DOMMatrixReadOnly(s.transform).m41>0;},handle);
  assert.deepEqual(await first.boundingBox(),box);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.deepEqual(await first.evaluate(n=>{const s=getComputedStyle(n,'::before');return [s.animationName,+s.opacity];}),['none',.5]);
  await page.emulateMedia({reducedMotion:'no-preference'});
  guides=[];
  for(let i=0;i<3;i++){
   const b=buttons.nth(i);if(i===0){if(width<500)await b.tap();else await b.click();}else{await b.focus();await page.keyboard.press(i===1?'Space':'Enter');}
   const dialog=page.getByRole('dialog',{name:products[i]});
   try{await dialog.getByText(products[i]+' üçün sintetik təlimat',{exact:true}).waitFor({timeout:5000});}
   catch(e){console.log({i,guides,dialogs:await page.locator('dialog[open]').innerText()});throw e;}
   if(recording)await page.waitForTimeout(600);
   await dialog.getByRole('button',{name:'Təlimatı bağla',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('.browser-order-guide'));
   assert.equal(await b.evaluate(n=>document.activeElement===n),true);
  }
  assert.deepEqual(guides,[0,1,2]);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:out+'/'+(live?'live-':'')+engine.name()+'-'+width+'.png'});
  if(recording)await page.waitForTimeout(5500);
  const video=page.video();await context.close();if(video){await video.saveAs(out+'/live-mobile.webm');await video.delete();}
  console.log(JSON.stringify({live,engine:engine.name(),width,products:3,keyboard:true,reducedMotion:true,stable:true}));
 }finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
