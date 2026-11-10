import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';
const live=process.argv.includes('--live'),out='outputs/prime-phone-guide';
fs.mkdirSync(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111',delivery='22222222-2222-4222-8222-222222222222';
const guide=orderGuideFor({id:'prime',orderGuide:{information:'Sintetik məlumat'}},{},'1 ay');
assert.equal(guide.tracks.phone.length,3);
const files=new Map();
for(const name of ['browser-orders.js','browser-orders.css']){
 const local=fs.readFileSync(name,'utf8');
 const data=live?await(await fetch('https://mirpanel.com/'+name+'?v=prime-phone-1')).text():local;
 assert.equal(data.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+name,data);
}
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname;
 const json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
 if(p==='/api/payments/my-orders')return json({orders:[{id,orderCode:'SINAQ-PRIME',product:'Prime Video',status:'completed',amount:5,createdAt:'2026-11-10T12:00:00Z',items:[{productId:'prime',title:'Prime Video',planName:'1 ay',quantity:1,unitCents:500}],deliveries:[{id:delivery,line:0,quantity:1}]}]});
 if(p.endsWith('/guide/0'))return json(guide);
 if(p.includes('/codes/'))return json({message:'Sintetik təhvil',email:'numune@example.com'});
 if(files.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(files.get(p));}
 if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const engine of [chromium,webkit])for(const width of [320,390,430,1440]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'Məlumat və təlimat',exact:true}).click();
  const dialog=page.locator('.browser-order-guide');
  await dialog.locator('.prime-demo').waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Təlimat',exact:true}).getAttribute('aria-pressed'),'true');
  await dialog.getByRole('button',{name:'Telefonla giriş',exact:true}).waitFor();
  const phone=dialog.locator('.prime-handset'),first=await phone.boundingBox(),next=dialog.getByRole('button',{name:'Növbəti',exact:true}),back=dialog.getByRole('button',{name:'Əvvəlki',exact:true});
  for(let i=0;i<3;i++){
   if(i)await next.click();
   const scene=dialog.locator('.prime-demo');
   assert.equal(await scene.getAttribute('data-scene'),guide.tracks.phone[i].animation);
   assert.equal(await scene.locator('.prime-demo-target').textContent(),['Devam Et','Giriş yap','Hayır, parola kullanmaya devam et'][i]);
   for(const [k,v]of Object.entries(await phone.boundingBox()))assert.ok(Math.abs(v-first[k])<2,k);
   if(i<2){
    assert.equal(await scene.locator('.prime-demo-typing').textContent(),i?'••••••••':'numune@example.com');
    await page.waitForFunction(()=>[...document.querySelectorAll('.prime-demo-typing>span')].every(n=>getComputedStyle(n).visibility==='visible'));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.prime-demo-target')).outlineColor==='rgb(229, 191, 82)');
   }
   if(engine===chromium&&[390,1440].includes(width))await dialog.screenshot({path:out+'/'+(live?'live-':'')+width+'-'+(i+1)+'.png'});
  }
  assert.equal(await next.isDisabled(),true);await back.click();assert.equal(await dialog.locator('.prime-demo').getAttribute('data-scene'),'prime-password');
  await dialog.getByRole('button',{name:'Məlumat',exact:true}).click();await dialog.getByText('Sintetik məlumat',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Təlimat',exact:true}).click();await dialog.locator('.prime-demo').waitFor();
  assert.equal(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth),true);
  assert.deepEqual(errors,[]);console.log(engine.name(),width,'PASS');
 }finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
