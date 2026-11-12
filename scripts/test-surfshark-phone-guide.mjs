import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';

const live=process.argv.includes('--live');
const out='outputs/surfshark-phone-guide';
await fs.mkdir(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const product={id:'surfshark',orderGuide:{information:'Sintetik məlumat'}};
const guide=orderGuideFor(product,{},'1 ay');
assert.deepEqual(guide.tracks.phone.map(step=>step.animation),['surfshark-open','surfshark-login']);
assert.equal(orderGuideFor({...product,id:'other'},{}).tracks.phone,undefined);
const files=new Map();
for(const name of ['browser-orders.js','browser-orders.css']){
 const local=await fs.readFile(name,'utf8');
 const response=live?await fetch('https://mirpanel.com/'+name+'?v=surfshark-phone-1',{signal:AbortSignal.timeout(15000)}):null;
 if(response)assert.ok(response.ok);
 const content=response?await response.text():local;
 assert.equal(content.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+name,content);
}
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 const send=(type,data)=>{res.setHeader('Content-Type',type);res.end(data);};
 const json=data=>send('application/json',JSON.stringify(data));
 if(path==='/api/payments/my-orders')return json({orders:[{id,orderCode:'SINAQ-SURFSHARK',product:'Surfshark VPN',status:'completed',amount:5,createdAt:'2026-11-12T12:00:00Z',items:[{productId:'surfshark',title:'Surfshark VPN',planName:'1 ay',quantity:1,unitCents:500}]}]});
 if(path==='/api/payments/my-orders/'+id+'/guide/0')return json(guide);
 if(files.has(path))return send(path.endsWith('.css')?'text/css':'text/javascript',files.get(path));
 if(path==='/')return send('text/html; charset=utf-8','<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   for(const [width,height] of [[320,640],[390,800],[1440,900]]){
    const record=engine===chromium&&width===390;
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<600,...(record?{recordVideo:{dir:out,size:{width,height}}}:{})});
    try{
     const page=await context.newPage(),errors=[];
     page.on('pageerror',error=>errors.push(error.message));
     await page.goto('http://127.0.0.1:'+server.address().port);
     await page.getByRole('button',{name:/^(Məlumat və təlimat|Təlimat)$/}).click();
     const dialog=page.locator('.browser-order-guide'),scene=dialog.locator('.surfshark-demo');
     const back=dialog.getByRole('button',{name:'Geri'}),next=dialog.getByRole('button',{name:'Növbəti'});
     await dialog.getByRole('button',{name:'Telefonla giriş',exact:true}).waitFor();
     const phone=dialog.locator('.surfshark-handset');
     const bounds=await phone.boundingBox();
     assert.ok(bounds.width>=168&&bounds.height>=340,JSON.stringify(bounds));
     assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y>=0&&bounds.y+bounds.height<=height);
     assert.ok(await back.isDisabled());
     assert.equal(await scene.locator('.surfshark-demo-open').textContent(),'Log in');
     await page.waitForFunction(()=>getComputedStyle(document.querySelector('.surfshark-demo-open')).outlineColor==='rgb(255, 214, 106)');
     if(record)await page.waitForTimeout(700);
     if(record)await phone.screenshot({path:out+'/step-1.png'});
     await page.evaluate(()=>{
      window.surfsharkCues=[];
      document.querySelector('.browser-order-guide').addEventListener('animationstart',event=>{
       if(event.animationName==='surfshark-cue'&&event.target.closest('[data-scene="surfshark-login"]')){
        window.surfsharkCues.push(event.target.firstChild.textContent);
       }
      });
     });
     await next.scrollIntoViewIfNeeded();
     const beforeChange=await phone.boundingBox();
     await next.click();
     assert.equal(await scene.getAttribute('data-scene'),'surfshark-login');
     assert.equal(await scene.locator('.surfshark-demo-email span').textContent(),'numune@example.com');
     assert.equal(await scene.locator('.surfshark-demo-password span').first().textContent(),'••••••••');
     assert.equal(await scene.locator('.surfshark-demo-next').textContent(),'Next');
     assert.equal(await scene.locator('.surfshark-demo-next').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(241, 241, 241)');
     const second=await phone.boundingBox();
     for(const target of [scene.locator('.surfshark-demo-email'),scene.locator('.surfshark-demo-password'),scene.locator('.surfshark-demo-next')]){
      const rect=await target.boundingBox();
      assert.ok(rect.width>=120&&rect.height>=15);
      assert.ok(rect.x>=second.x&&rect.x+rect.width<=second.x+second.width);
      assert.ok(rect.y>=second.y&&rect.y+rect.height<=second.y+second.height);
     }
     assert.ok(await next.isDisabled());
     assert.ok(second.y>=0&&second.y+second.height<=height);
     for(const key of ['x','y','width','height'])assert.ok(Math.abs(second[key]-beforeChange[key])<2,JSON.stringify({key,beforeChange,second}));
     await page.waitForFunction(()=>window.surfsharkCues.length===3);
     assert.deepEqual(await page.evaluate(()=>window.surfsharkCues),['Email','Password','Next']);
     await page.waitForFunction(()=>[...document.querySelectorAll('.surfshark-demo-cue')].every(n=>getComputedStyle(n).outlineColor==='rgba(0, 0, 0, 0)'&&n.getAnimations({subtree:true}).length===0));
     assert.equal(await scene.locator('input,button,a').count(),0);
     if(record){await phone.screenshot({path:out+'/step-2.png'});await page.waitForTimeout(900);}
     await back.click();
     assert.equal(await scene.getAttribute('data-scene'),'surfshark-open');
     if(record)await page.waitForTimeout(650);
     assert.deepEqual(errors,[]);
     if(record){
      const video=page.video();
      await context.close();
      const target=out+'/'+(live?'live':'local')+'-surfshark.webm';
      await video.saveAs(target);
      await video.delete();
     }
     console.log(engine.name(),width,height,'PASS');
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
