import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {spawn} from 'node:child_process';import {once} from 'node:events';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const before=process.argv.includes('--before'),live=process.argv.includes('--live'),port=10103,results=[];
const fixture=spawn(process.execPath,['scripts/payment-orders-browser-fixture.mjs'],{windowsHide:true,env:{...process.env,PORT:String(port),...(before?{MIRPANEL_ORDER_BASELINE:'5ca7ef0'}:{})},stdio:['ignore','pipe','inherit']});
try{
 await Promise.race([once(fixture.stdout,'data'),once(fixture,'exit').then(()=>{throw Error('Fixture stopped');})]);
 const server=JSON.parse(await fs.readFile('outputs/admin-delivery-speed/'+(before?'before':'after')+'-server.json','utf8'));
 let deployed;if(live){const r=await fetch('https://mirpanel.onrender.com/payment-admin.js?v=delivery-latency-1');assert(r.ok);deployed=await r.text();assert.equal(deployed.replaceAll('\r\n','\n'),(await fs.readFile('mirpanel-admin/public/payment-admin.js','utf8')).replaceAll('\r\n','\n'));}
 for(const engine of [chromium,webkit])for(const width of [390,1440]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{const p=await browser.newPage({viewport:{width,height:850}});p.setDefaultTimeout(12000);
   if(live)await p.route('**/payment-admin.js',r=>r.fulfill({contentType:'text/javascript',body:deployed}));
   for(const product of ['spotify','capcut','netflix']){
    await p.goto('http://127.0.0.1:'+port);const serverMs=server.results.find(x=>x.productId===product).ms;
    await p.evaluate(({product,serverMs})=>{
     const s=window.__fixtureState,original=window.api;s.speed={posts:[],listReads:0,countsReads:0,done:false,lose:false,delay:serverMs+200};
     const o={...s.all[0],productId:product,productTitle:product,customerName:'Sintetik '+product,paymentSource:'wallet',deliveryPending:true,remainingDelivery:[1],items:[{productId:product,title:product,planName:'1 ay',quantity:1,unitCents:500}]};s.speedOrder=o;
     window.api=async(path,options={})=>{const u=new URL(path,location.origin),t=s.speed;
      if(u.pathname.endsWith('/'+o.id+'/delivery')){
       if(options.method==='POST'){
        t.posts.push(JSON.parse(options.body));await new Promise(r=>setTimeout(r,t.delay));t.done=true;
        if(t.lose){t.lose=false;throw Error('Sintetik cavab itdi');}
        return {status:'completed',lines:[{index:0,title:product,plan:'1 ay',remaining:0}]};
       }
       return {status:'preparing',lines:[{index:0,title:product,plan:'1 ay',remaining:1,message:'Sintetik hazır mesaj',customerAccount:{email:'synthetic@example.test',password:'synthetic-only'},...(product==='netflix'?{netflixRoom:{name:'1',code:'0408'}}:{})}]};
      }
      const result=await original(path,options);
      if(u.pathname==='/api/admin/payment-orders'){
       if(u.searchParams.get('countsOnly')==='true')t.countsReads++;
       else{t.listReads++;if(t.done)await new Promise(r=>setTimeout(r,1000));}
       result.orders=u.searchParams.get('pendingStage')==='delivery'&&!t.done?[o]:[];
       result.counts={...result.counts,delivery:t.done?0:1,pending:0,pendingTotal:t.done?0:1};
      }return result;
     };
    },{product,serverMs});
    await p.locator('.navBtn[data-view=paymentOrders]').click();await p.locator('[data-payment-pending-stage=delivery]').click();
    const card=p.locator('[data-payment-order-id]').filter({hasText:'Sintetik '+product});await card.waitFor();
    if(width<650&&await card.locator('.paymentOrderCardDetails').evaluate(n=>n.hidden))await card.locator('[data-order-toggle]').click();
    await card.getByRole('button',{name:'Təhvil ver',exact:true}).click();const modal=p.locator('dialog[data-payment-delivery-dialog]');await modal.locator('[name=line] option').waitFor({state:'attached'});
    const send=modal.locator('[type=submit]');await send.waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('dialog [type=submit]').disabled);
    const reads=await p.evaluate(()=>__fixtureState.speed.listReads);await send.evaluate(b=>{
     const dialog=b.closest('dialog'),card=document.querySelector('[data-payment-order-id]');
     window.clickStart=performance.now();window.deliveryConfirmMs=null;window.deliveryCardMs=null;
     const frame=()=>{const ms=Math.round(performance.now()-clickStart);if(!dialog.isConnected&&deliveryConfirmMs===null)window.deliveryConfirmMs=ms;if(!card.isConnected&&deliveryCardMs===null)window.deliveryCardMs=ms;if(deliveryConfirmMs===null||deliveryCardMs===null)requestAnimationFrame(frame);};requestAnimationFrame(frame);
     b.click();b.click();window.busyReaction=performance.now()-clickStart;
    });
    if(!before){assert.equal(await send.textContent(),'Göndərilir…');assert(await send.isDisabled());}
    await modal.waitFor({state:'hidden'});await card.waitFor({state:'hidden'});await p.waitForFunction(()=>deliveryConfirmMs!==null&&deliveryCardMs!==null);
    const {confirmationMs,cardMs}=await p.evaluate(()=>({confirmationMs:deliveryConfirmMs,cardMs:deliveryCardMs}));
    const state=await p.evaluate(()=>__fixtureState.speed);assert.equal(state.posts.length,1);if(!before)assert.equal(state.listReads,reads,'delivery success cannot reload the full order list');
    if(!before)assert(confirmationMs<2000,'normal-network isolated target');
    results.push({engine:engine.name(),width,product,confirmationMs,cardMs,listReloads:state.listReads-reads,reactionMs:await p.evaluate(()=>busyReaction),synthetic:true});console.log(JSON.stringify(results.at(-1)));
   }
  }finally{await browser.close();}
 }
 await fs.mkdir('outputs/admin-delivery-speed',{recursive:true});await fs.writeFile('outputs/admin-delivery-speed/'+(before?'before':live?'live':'after')+'-browser.json',JSON.stringify({results,productionWrites:0},null,2));
}finally{fixture.kill();}
