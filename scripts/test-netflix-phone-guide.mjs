import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const live=process.argv.includes('--live'),record=process.argv.includes('--record');
const root=process.cwd(),out=path.resolve('../../outputs'),id='11111111-1111-4111-8111-111111111111';
const catalog=extractAdminState(fs.readFileSync('app.js','utf8'));
for(const productId of ['capcut','netflix_umumi','netflix_sexsi']){
 const product=catalog.products.find(p=>p.id===productId);
 const before=JSON.stringify(product);
 const result=orderGuideFor(product,{},'');
 assert.equal(JSON.stringify(product),before);
 assert.deepEqual(result.tracks,orderGuideFor({...product,id:'control'}, {},'').tracks);
}
const guide=orderGuideFor({id:'netflix',orderGuide:{information:'Mövcud məlumat mətni',tracks:{general:[{image:'/uploads/demo.png',description:'Ümumi təlimat'}]}}},{},'1 aylıq');
assert.equal(guide.tracks.phone.length,5);assert.equal(guide.information,'Mövcud məlumat mətni');assert.equal(guide.tracks.general.length,1);
assert.deepEqual(orderGuideFor({id:'netflix_umumi',orderGuide:{information:'Ümumi',tracks:{}}},{},'').tracks,{});
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname;
 const json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(p==='/api/payments/my-orders')return json({orders:[{id,orderCode:'SINAQ-1',product:'Netflix Şəxsi',plan:'1 aylıq',status:'completed',amount:5.99,items:[{productId:'netflix',title:'Netflix Şəxsi',planName:'1 aylıq',quantity:1,unitCents:599}]}]});
 if(p.endsWith('/guide/0'))return json(guide);
 if(p.startsWith('/api/'))return json({});
 if(p==='/test'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="margin:0;background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script></html>');}
 const file=path.resolve(root,'.'+p);
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_CHROME});
try{
 for(const width of record?[390]:[320,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:record?900:850},isMobile:width<600,hasTouch:width<600,...(record?{recordVideo:{dir:'../netflix-recording',size:{width:390,height:900}}}:{})});
  const p=await context.newPage();p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message)});
  if(live)for(const name of ['browser-orders.js','browser-orders.css']){
   const response=await fetch('https://mirpanel.com/'+name+'?verify='+Date.now());
   assert.equal(response.status,200);const body=await response.text();
   assert.equal(body.replaceAll('\r\n','\n'),fs.readFileSync(name,'utf8').replaceAll('\r\n','\n'));
   await p.route(origin+'/'+name,r=>r.fulfill({body,contentType:name.endsWith('css')?'text/css':'text/javascript'}));
  }
  await p.goto(origin+'/test');await p.locator('summary').waitFor();if(!await p.locator('details.browser-order').evaluate(n=>n.open))await p.locator('summary').click();await p.getByRole('button',{name:'Məlumat və təlimat',exact:true}).click();
  const dlg=p.locator('.browser-order-guide');
  await p.getByText('Mövcud məlumat mətni',{exact:true}).waitFor();
  await dlg.getByRole('button',{name:'Təlimat',exact:true}).click();
  await dlg.getByRole('button',{name:'Telefonda giriş',exact:true}).click();
  const phone=p.locator('.netflix-handset'),scene=p.locator('.netflix-demo'),dots=p.locator('.browser-guide-dots');
  const first=await phone.boundingBox(),dialogFirst=await dlg.boundingBox();
  for(let step=0;step<5;step++){
   if(step)await dots.getByRole('button',{name:'Addım '+(step+1),exact:true}).click();
   assert.equal(await scene.getAttribute('data-scene'),guide.tracks.phone[step].animation);
   assert.equal(await scene.locator('img,input,button,a').count(),0);
   assert.equal(await phone.evaluate(n=>n.scrollHeight<=n.clientHeight+2),true);
   const rect=await phone.boundingBox();assert.ok(Math.abs(rect.width-first.width)<1&&Math.abs(rect.height-first.height)<1);
   assert.ok(Math.abs(rect.x-first.x)<1&&Math.abs(rect.y-first.y)<1,'phone stays in place');
   const d=await dlg.boundingBox();assert.ok(Math.abs(d.y-dialogFirst.y)<1&&Math.abs(d.height-dialogFirst.height)<1,'dialog stays in place');
   if(step===0)assert.equal(await scene.locator('.netflix-target').textContent(),'Sign In');
   if(step===2){assert.equal(await scene.locator('.netflix-codes>div').count(),4);assert.equal(await scene.locator('.netflix-codes').textContent(),'');}
   if(step===3)assert.equal(await scene.locator('.netflix-target').textContent(),'Use password instead');
   if(step===1||step===4){
    await p.waitForTimeout(record?2400:50);
    if(!record){const visible=await scene.locator('.netflix-typing>span').evaluateAll(ns=>ns.filter(n=>getComputedStyle(n).visibility==='visible').length);assert.ok(visible<nsLength(step));await p.waitForTimeout(2250);}
    assert.equal(await scene.locator('.netflix-target').textContent(),step===1?'Continue':'Sign In');
    assert.equal(await scene.locator('.netflix-target').evaluate(n=>getComputedStyle(n).outlineColor),'rgb(229, 191, 82)');
   }else if(record)await p.waitForTimeout(1400);
   if([390,1440].includes(width)&&step===3)await p.screenshot({path:path.join(out,'MirPanel-netflix-telefon-'+width+'.png')});
  }
  if(record){const video=p.video();await p.close();fs.writeFileSync('../netflix-recording/path.txt',await video.path());await context.close();continue;}
  await dlg.getByRole('button',{name:'Əvvəlki',exact:true}).click();
  assert.equal(await scene.getAttribute('data-scene'),'netflix-help');
  await phone.evaluate(n=>{
   const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'touches',{value:[{clientX:180,clientY:150}]});n.dispatchEvent(start);
   const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'changedTouches',{value:[{clientX:70,clientY:150}]});n.dispatchEvent(end);
  });
  assert.equal(await scene.getAttribute('data-scene'),'netflix-password');
  await phone.evaluate(n=>{
   const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'touches',{value:[{clientX:70,clientY:150}]});n.dispatchEvent(start);
   const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'changedTouches',{value:[{clientX:180,clientY:150}]});n.dispatchEvent(end);
  });
  assert.equal(await scene.getAttribute('data-scene'),'netflix-help');
  await dots.getByRole('button',{name:'Addım 2',exact:true}).click();
  await dlg.getByRole('button',{name:'Avtomatik göstər',exact:true}).click();
  await p.waitForTimeout(2400);assert.equal(await scene.getAttribute('data-scene'),'netflix-email');
  await p.waitForTimeout(2800);assert.equal(await scene.getAttribute('data-scene'),'netflix-code');
  await dlg.getByRole('button',{name:'Dayandır',exact:true}).click();const stopped=await scene.getAttribute('data-scene');
  await p.waitForTimeout(5200);assert.equal(await scene.getAttribute('data-scene'),stopped);
  assert.ok(await dlg.getByRole('button',{name:'Növbəti',exact:true}).evaluate(n=>n.getBoundingClientRect().height>=44));
  await dlg.getByRole('button',{name:'Təlimatı bağla',exact:true}).click();await scene.waitFor({state:'detached'});
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.getByRole('button',{name:'Məlumat və təlimat',exact:true}).click();
  await dlg.getByRole('button',{name:'Təlimat',exact:true}).click();
  await dlg.getByRole('button',{name:'Telefonda giriş',exact:true}).click();
  await dots.getByRole('button',{name:'Addım 2',exact:true}).click();
  assert.equal(await scene.locator('.netflix-typing>span').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).visibility==='visible')),true);
  assert.equal(await scene.locator('.netflix-target').evaluate(n=>getComputedStyle(n).animationName),'none');
  await dlg.getByRole('button',{name:'Təlimatı bağla',exact:true}).click();
  assert.deepEqual(errors,[]);await context.close();console.log('PASS '+width+'px: five scenes, stable frame/dialog, controls, swipe, typing and autoplay');
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
function nsLength(step){return step===1?17:8;}
