import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';
const live=process.argv.includes('--live'),out='outputs/chatgpt-twofa-guide';
fs.mkdirSync(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111',delivery='22222222-2222-4222-8222-222222222222';
const guide=orderGuideFor({id:'chatgpt',orderGuide:{information:'Sintetik məlumat'}},{},'1 ay');
assert.equal(guide.tracks.phone.length,7);
assert.equal(orderGuideFor({id:'chatgpt_ortaq'},{}).tracks.phone,undefined);
assert.equal(guide.information,'Sintetik məlumat');
const files=new Map();
for(const name of ['browser-orders.js','browser-orders.css']){
 const local=fs.readFileSync(name,'utf8');
 const data=live?await(await fetch('https://mirpanel.com/'+name+'?v=chatgpt-twofa-2')).text():local;
 assert.equal(data.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+name,data);
}
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname;
 const json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
 if(p==='/api/payments/my-orders')return json({orders:[{id,orderCode:'SINAQ-CHATGPT',product:'ChatGPT Plus (Şəxsi hesab)',status:'completed',amount:5,createdAt:'2026-11-10T12:00:00Z',items:[{productId:'chatgpt',title:'ChatGPT Plus (Şəxsi hesab)',planName:'1 ay',quantity:1,unitCents:500}],deliveries:[{id:delivery,line:0,quantity:1}]}]});
 if(p.endsWith('/guide/0'))return json(guide);
 if(p.includes('/codes/'))return json({message:'Sintetik təhvil',email:'numune@example.com'});
 if(files.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(files.get(p));}
 if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const exampleSecret='DEMO-ONLY-NOT-A-REAL-2FA-KEY-0000';
const expectedTargets=['Oturum aç veya kaydol','Devam','Devam','Kod','Submit','000000','Devam'];
const animatedValues={1:'numune@example.com',2:'••••••••',4:exampleSecret,6:'000000'};
const recording=process.argv.includes('--record');
try {
 for(const engine of recording?[chromium]:[chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try {
   for(const width of recording?[390]:[320,390,1440]){
    const context=await browser.newContext({viewport:{width,height:850},...(recording?{recordVideo:{dir:out,size:{width:390,height:850}}}:{})});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);
    await page.locator('[data-order-info]').click();
    const dialog=page.locator('.browser-order-guide');
    const scene=dialog.locator('.chatgpt-demo');
    await dialog.getByRole('button',{name:'Təlimat',exact:true}).click();
    await scene.waitFor();
    await dialog.getByRole('button',{name:'Telefonla giriş',exact:true}).waitFor();
    const next=dialog.getByRole('button',{name:'Növbəti',exact:true});
    const back=dialog.getByRole('button',{name:'Əvvəlki',exact:true});
    const phone=dialog.locator('.chatgpt-handset');
    await phone.evaluate(node=>{window.firstPhone=node;});
    const first=await phone.boundingBox();
    assert.equal(await back.isDisabled(),true);
    for(let i=0;i<7;i++){
     if(i)await next.click();
     assert.equal(await scene.getAttribute('data-scene'),guide.tracks.phone[i].animation.replace('chatgpt-',''));
     assert.equal(await phone.evaluate(node=>node===window.firstPhone),true);
     for(const key of ['width','height'])assert.ok(Math.abs((await phone.boundingBox())[key]-first[key])<2,key);
     assert.equal(await scene.evaluate(node=>node.scrollHeight<=node.clientHeight&&node.scrollWidth<=node.clientWidth),true,'scene fits at '+width+' step '+(i+1));
     assert.equal(await scene.locator('input,textarea,form,a').count(),0,'mock never accepts or submits data');
     if(i===3)assert.equal(await scene.locator('.chatgpt-demo-field strong').count(),0);
     if(i===4||i===5){
      assert.deepEqual(await scene.locator('.chatgpt-demo-field > span').allTextContents(),['2FA Secret','2FA Code']);
      assert.equal(await scene.locator('.chatgpt-twofa-secret strong').textContent(),exampleSecret);
      assert.equal(await scene.locator('.chatgpt-twofa-digits').count(),i===5?1:0);
     }
     const highlights=()=>scene.evaluate(node=>Array.from(node.querySelectorAll('.chatgpt-demo-mark,.chatgpt-demo-typing,.chatgpt-demo-after')).filter(el=>getComputedStyle(el).outlineColor==='rgb(229, 191, 82)').map(el=>el.textContent));
     if(animatedValues[i]){
      const typing=scene.locator('.chatgpt-demo-typing strong');
      assert.equal(await typing.textContent(),animatedValues[i]);
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.chatgpt-demo-typing')).outlineColor==='rgb(229, 191, 82)');
      assert.equal((await highlights()).length,1);
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.chatgpt-demo-after')).outlineColor==='rgb(229, 191, 82)');
     }
     if(i===5)await page.waitForFunction(()=>getComputedStyle(document.querySelector('.chatgpt-twofa-digits')).outlineColor==='rgb(229, 191, 82)');
     assert.deepEqual(await highlights(),[expectedTargets[i]]);
     if(recording)await page.waitForTimeout(1400);
     if(!recording&&engine===chromium&&width===390)await dialog.screenshot({path:out+'/'+(live?'live-':'')+'step-'+(i+1)+'.png',animations:'allow'});
    }
    assert.equal(await next.isDisabled(),true);
    if(!recording){
     for(let i=5;i>=0;i--){
      await back.click();
      assert.equal(await scene.getAttribute('data-scene'),guide.tracks.phone[i].animation.replace('chatgpt-',''));
     }
     assert.equal(await back.isDisabled(),true);
     await dialog.getByRole('button',{name:'Məlumat',exact:true}).click();
     await dialog.getByText('Sintetik məlumat',{exact:true}).waitFor();
    }
    assert.deepEqual(errors,[]);
    const video=page.video();
    await context.close();
    if(video)await video.saveAs(out+'/'+(live?'live':'local')+'-chatgpt-phone-guide.webm');
    console.log(engine.name(),width,'PASS');
   }
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
