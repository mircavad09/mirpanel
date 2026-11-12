import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';
const live=process.argv.includes('--live'),out='outputs/guide-tab-order';
fs.mkdirSync(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111',delivery='22222222-2222-4222-8222-222222222222';
const information='Sintetik məhsul məlumatı';
const products=[
 {id:'capcut',title:'CapCut Pro',orderGuide:{information,tracks:{phone:[{image:'/uploads/guides/capcut-mobile/1.png',animation:'ben',description:'CapCut tətbiqində Ben bölməsini açın.'},{image:'/uploads/guides/capcut-mobile/2.png',animation:'sign-in',description:'Giriş düyməsinə toxunun.'}]}}},
 {id:'netflix',title:'Netflix Şəxsi',orderGuide:{information}},
 {id:'prime',title:'Prime Video',orderGuide:{information}},
 {id:'synthetic',title:'Təlimatsız məhsul',orderGuide:{information}}
];
let product=products[0];
const guide=()=>orderGuideFor(product,{},'1 ay');
const files=new Map();
for(const name of ['browser-orders.js','browser-orders.css']){
 const local=fs.readFileSync(name,'utf8');
 const data=live?await(await fetch('https://mirpanel.com/'+name+'?v=surfshark-phone-1')).text():local;
 assert.equal(data.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+name,data);
}
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname;
 const json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
 if(p==='/api/payments/my-orders')return json({orders:[{id,orderCode:'SINAQ-CHATGPT',product:product.title,status:'completed',amount:5,createdAt:'2026-11-10T12:00:00Z',items:[{productId:product.id,title:product.title,planName:'1 ay',quantity:1,unitCents:500}],deliveries:[{id:delivery,line:0,quantity:1}]}]});
 if(p.endsWith('/guide/0'))return json(guide());
 if(p.includes('/codes/'))return json({message:'Sintetik təhvil',email:'numune@example.com'});
 if(files.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(files.get(p));}
 if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   for(const width of [390,1440]){
    for(const sample of products){
     product=sample;
     const page=await browser.newPage({viewport:{width,height:900}});
     const errors=[];
     page.on('pageerror',error=>errors.push(error.message));
     await page.goto('http://127.0.0.1:'+server.address().port);
     const trigger=page.locator('[data-order-info]');
     await trigger.click();
     const dialog=page.locator('.browser-order-guide');
     const tabs=dialog.locator('.browser-guide-tabs button');
     const how=dialog.getByRole('button',{name:'Təlimat',exact:true});
     const info=dialog.getByRole('button',{name:'Məlumat',exact:true});
     const guided=product.id!=='synthetic';
     for(let open=0;open<2;open++){
      if(open)await trigger.click();
      await page.waitForFunction(expected=>document.querySelector('.browser-guide-tabs button[aria-pressed=true]')?.textContent===expected,guided?'Təlimat':'Məlumat',{timeout:5000});
      assert.deepEqual(await tabs.allTextContents(),['Təlimat','Məlumat']);
      assert.equal(await (guided?how:info).getAttribute('aria-pressed'),'true');
      const positions=await tabs.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().left));
      assert.ok(positions[0]<positions[1]);
      if(guided){
       const next=dialog.getByRole('button',{name:'Növbəti',exact:true});
       await next.click();
       await dialog.getByRole('button',{name:'Əvvəlki',exact:true}).click();
       assert.equal(await dialog.locator('.browser-guide-step-number').textContent(),'1');
      }
      await info.click();
      await dialog.getByText(information,{exact:true}).waitFor();
      await how.click();
      if(!guided){
       assert.equal(await info.getAttribute('aria-pressed'),'true');
       await dialog.getByText(information,{exact:true}).waitFor();
      }else assert.equal(await how.getAttribute('aria-pressed'),'true');
      await info.click();
      if(engine===chromium&&width===390&&!open)await dialog.screenshot({path:out+'/'+(live?'live-':'')+product.id+'.png'});
      await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
     }
     assert.deepEqual(errors,[]);
     await page.close();
     console.log(engine.name(),width,product.id,'PASS');
    }
   }
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
