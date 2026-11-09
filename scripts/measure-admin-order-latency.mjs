import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright','index.mjs')));
const baseline=process.argv[2]||'3236258';
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_BROWSER_PATH,headless:true});
try {
 for(const [index,version] of [baseline,'after'].entries()){
  const port=10094+index;
  const server=spawn(process.execPath,['scripts/payment-orders-browser-fixture.mjs'],{env:{...process.env,PORT:String(port),MIRPANEL_ORDER_LATENCY:'1',MIRPANEL_ORDER_BASELINE:index?'':baseline}});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Fixture did not start')),5000);
    server.stdout.on('data',()=>{clearTimeout(timer);resolve();});
    server.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture exit '+code));});
   });
   for(const width of [390,1440]){
    const samples=[];
    for(let run=0;run<3;run++){
     const page=await browser.newPage({viewport:{width,height:820}});
     await page.addInitScript(()=>{
      const timer=window.setInterval;
      window.setInterval=(fn,ms,...args)=>{if(ms===45000)window.refreshOrdersFixture=fn;return timer(fn,ms,...args);};
     });
     await page.goto('http://127.0.0.1:'+port);
     await page.evaluate(()=>{const s=window.__fixtureState;s.delivery=s.all.slice(0,19).map(o=>({...o,status:'preparing',deliveryPending:true}));});
     const stage=s=>page.locator('[data-payment-pending-stage="'+s+'"]');
     const card=page.locator('[data-payment-order-id]').first();
     const dialog=page.locator('[data-payment-delivery-dialog][open]');
     const measure=async(locator,selector)=>locator.evaluate(async(button,selector)=>{
      const t=performance.now();button.click();
      return new Promise((resolve,reject)=>{
       const tick=()=>document.querySelector(selector)?resolve(performance.now()-t):performance.now()-t>5000?reject(Error(selector)):requestAnimationFrame(tick);
       requestAnimationFrame(tick);
      });
     },selector);
     await page.locator('.navBtn[data-view="paymentOrders"]').click();
     await card.waitFor();
     // Reproducible admin think time before switching to the queue.
     await page.waitForTimeout(550);
     const queueFirst=await measure(stage('delivery'),'[data-order-page*="pendingStage=delivery"] [data-order-delivery]');
     if(width===390)await card.locator('[data-order-toggle]').click();
     const deliveryFirst=await measure(card.locator('[data-order-delivery]'),'[data-payment-delivery-dialog][open]');
     await dialog.locator('[name=line] option').first().waitFor({state:'attached'});
     await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
     await page.locator('[data-payment-delivery-dialog]').waitFor({state:'detached'});
     const deliveryRepeat=await measure(card.locator('[data-order-delivery]'),'[data-payment-delivery-dialog][open]');
     await dialog.locator('[name=line] option').first().waitFor({state:'attached'});
     await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
     await stage('payment').click();
     const queueRepeat=await measure(stage('delivery'),'[data-order-page*="pendingStage=delivery"] [data-order-delivery]');
     await page.waitForFunction(()=>!document.getElementById('paymentOrdersList').hasAttribute('aria-busy'));
     await card.scrollIntoViewIfNeeded();
     await page.locator('[data-order-field-value]').first().waitFor();
     const refresh=await page.evaluate(async()=>{
      const root=document.getElementById('paymentOrdersList'),row=root.querySelector('[data-payment-order-id]');
      const counts=()=>window.__fixtureState.calls.filter(c=>c.path.endsWith('/details')).length;
      const field=row.querySelector('[data-order-field-value]');
      const before=counts();let mutations=0;
      const observer=new MutationObserver(records=>{mutations+=records.filter(r=>r.target!==root||r.type==='childList').length;});
      observer.observe(root,{subtree:true,childList:true,attributes:true,characterData:true});
      window.refreshOrdersFixture();
      await new Promise(r=>setTimeout(r,600));observer.disconnect();
      const idle={mutations,refetches:counts()-before,preserved:row.querySelector('[data-order-field-value]')===field};
      window.refreshOrdersFixture();
      let maxGap=0,last=performance.now(),start=last;
      await new Promise(resolve=>{
       const frame=now=>{
        maxGap=Math.max(maxGap,now-last);last=now;
        window.scrollTo(0,Math.abs(Math.sin((now-start)/110))*root.scrollHeight);
        if(now-start<650)requestAnimationFrame(frame);else resolve();
       };requestAnimationFrame(frame);
      });
      return {...idle,maxGap};
     });
     if(index){assert.equal(refresh.mutations,0);assert.equal(refresh.refetches,0);assert.ok(refresh.preserved);assert.ok(deliveryFirst<200&&deliveryRepeat<200);}
     samples.push({queueFirst,queueRepeat,deliveryFirst,deliveryRepeat,...refresh});
     await page.close();
    }
    const summary=Object.fromEntries(Object.keys(samples[0]).filter(key=>key!=='preserved').map(key=>[key,Math.round(samples.map(s=>s[key]).sort((a,b)=>a-b)[1])]));
    console.log(JSON.stringify({version,width,median:summary,samples:3,syntheticDelayMs:{queue:450,delivery:550}}));
   }
  }finally{server.kill();}
 }
}finally{await browser.close();}
