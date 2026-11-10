import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live'),before=process.argv.includes('--before'),out='outputs/completed-badge';
fs.mkdirSync(out,{recursive:true});
const files=new Map();
for(const file of ['browser-orders.js','browser-orders.css']){
 const local=before?execFileSync('git',['show','4328d55:'+file],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
 const content=live?await(await fetch('https://mirpanel.com/'+file+'?v=completed-badge-1')).text():local;
 if(live)assert.equal(content.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+file,content);
}
const orders=Array.from({length:150},(_,i)=>({id:'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'),orderCode:String(90000+i),product:'Sintetik məhsul '+(i+1),status:i<147?'completed':['preparing','rejected','reviewing'][i-147],amount:4.99,createdAt:'2026-11-11T10:00:00Z',items:[{title:'Sintetik məhsul '+(i+1),planName:'1 ay',quantity:1,unitCents:499}]}));
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://test').pathname;
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(p==='/api/payments/my-orders'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({orders}));}
 if(files.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(files.get(p));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="margin:12px;background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><h1>Sifarişlərim · Sınaq</h1><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const engine of [chromium,webkit])for(const width of [390,1440]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const record=live&&engine===chromium&&width===390;
  const c=await browser.newContext({viewport:{width,height:900},...(record?{recordVideo:{dir:out+'/recording',size:{width:390,height:900}}}:{})});
  const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('.browser-order').nth(149).waitFor();
  await page.locator('.browser-order').evaluateAll(nodes=>nodes.forEach(n=>n.open=false));
  const badge=page.locator('.browser-order-status[data-status=completed]').first();
  if(!before){
   assert.equal(await badge.locator('svg').count(),1);assert.equal(await badge.textContent(),'Tamamlandı');
   assert.equal(await page.locator('.browser-order-status:not([data-status=completed]) svg').count(),0);
   const rect=await badge.boundingBox();
   await page.waitForTimeout(2500);
   assert.deepEqual(await badge.boundingBox(),rect);
   const b=await badge.evaluate(n=>({color:getComputedStyle(n).color,weight:getComputedStyle(n).fontWeight,font:getComputedStyle(n).fontFamily}));
   assert.equal(b.color,'rgb(140, 236, 181)');assert.equal(b.weight,'600');
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await badge.locator('.order-completed-tick').evaluate(n=>getComputedStyle(n).animationName),'none');
   assert.equal(await badge.locator('.order-completed-tick').evaluate(n=>getComputedStyle(n).strokeDashoffset),'0px');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.waitForTimeout(1000);
   const active=await page.locator('.order-completed-icon.is-animating').count();
   assert.ok(active>0&&active<20,'Only visible badges animate');
   await page.screenshot({path:out+'/'+(live?'live-':'')+engine.name()+'-'+width+'.png'});
  }
  const frames=await page.evaluate(async()=>{
   const result=[];let last=performance.now();
   for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);const now=performance.now();result.push(now-last);last=now;window.scrollTo(0,(i<60?i:120-i)*110);}
   scrollTo(0,0);result.shift();return result.sort((a,b)=>a-b);
  });
  console.log(JSON.stringify({mode:before?'before':live?'live':'after',engine:engine.name(),width,orders:150,frameMedian:Math.round(frames[Math.floor(frames.length/2)]),frameP95:Math.round(frames[Math.floor(frames.length*.95)]),frameMax:Math.round(frames.at(-1))}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  if(record)await page.waitForTimeout(5400);
  const video=page.video();await c.close();if(video){await video.saveAs(out+'/live-mobile.webm');await video.delete();}
 }finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
