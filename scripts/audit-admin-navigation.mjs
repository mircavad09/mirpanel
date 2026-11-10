// Run against a synthetic server, or a live origin with an authorized temporary
// session. Browser writes and third-party navigation are blocked in both modes.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT||'playwright');
const origin=new URL(process.env.MIRPANEL_ADMIN_ORIGIN||'http://127.0.0.1:10095').origin;
const session=process.env.MIRPANEL_ADMIN_TEST_SESSION;
const configured=process.env.MIRPANEL_AUDIT_WIDTHS||'390,1440';
const reports=[];
for(const width of configured.split(',').map(Number)){
 const engine=process.env.MIRPANEL_AUDIT_WEBKIT==='1'&&width<650?webkit:chromium;
 const browser=await engine.launch(engine===chromium?{executablePath:process.env.MIRPANEL_CHROME}:{});
 try{
  const ctx=await browser.newContext({viewport:{width,height:860},hasTouch:width<650,isMobile:width<650,serviceWorkers:'block'});
  if(session){const at=session.indexOf('=');assert.ok(at>0);await ctx.addCookies([{name:session.slice(0,at),value:session.slice(at+1),url:origin,httpOnly:true,sameSite:'Strict',secure:origin.startsWith('https:')}]);}
  const blocked=new Set();
  await ctx.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin)return route.abort();
   if(route.request().method()!=='GET'){blocked.add(u.pathname);return route.fulfill({status:405,json:{error:'Baxış sınağında yazma bağlıdır.'}});}
   return route.continue();
  });
  const p=await ctx.newPage();p.setDefaultTimeout(7000);
  let errors=[],requests=[],pending=new Set();
  const path=r=>new URL(r.url()).pathname;
  const safePath=r=>path(r).replace(/\/[0-9a-f-]{36}(?=\/|\.|$)/gi,'/:id').replace(/(\/community\/users)\/[^/]+/,'$1/:id');
  p.on('pageerror',error=>errors.push(error.name));
  p.on('request',r=>{if(path(r).startsWith('/api/')&&!path(r).endsWith('/events')&&r.method()==='GET')pending.add(r);});
  p.on('requestfinished',r=>pending.delete(r));p.on('requestfailed',r=>pending.delete(r));
  p.on('response',r=>{if(r.request().method()==='GET'&&path(r).startsWith('/api/'))requests.push({path:safePath(r),status:r.status()});});
  const settle=async()=>{await p.waitForTimeout(350);for(let n=0;n<18&&pending.size;n++)await p.waitForTimeout(150);};
  await p.goto(origin+'/admin.html',{waitUntil:'domcontentloaded'});
  await p.locator('.navBtn[data-view="dashboard"]').waitFor({state:'attached'});
  await settle();
  const entries=await p.locator('.nav .navBtn').evaluateAll(ns=>ns.map(n=>({view:n.dataset.view||null,href:n.getAttribute('href'),label:n.textContent.trim()})));
  const report={width,engine:engine.name(),views:[]};
  for(const entry of entries){
   errors=[];requests=[];pending=new Set();
   const target=entry.view?p.locator('#'+entry.view+'View'):p.locator('main').first();
   try{
    if(entry.view){
     const menu=p.locator('.mobileMenuToggle');
     if(await menu.isVisible()&&await menu.getAttribute('aria-expanded')==='false')await menu.click();
     const button=p.locator('.navBtn[data-view="'+entry.view+'"]');
     const group=button.locator('xpath=ancestor::details[1]');
     if(await group.count()&&await group.getAttribute('open')===null)await group.locator('summary').click();
     await button.click();
    }else await p.goto(origin+entry.href,{waitUntil:'domcontentloaded'});
    await target.waitFor({state:'visible'});await settle();
    const counts=await target.evaluate(n=>{
     const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
     const controls=[...n.querySelectorAll('button,a[href],input,select,textarea,summary')].filter(visible);
     // Use IDs, roles and control types, not dynamic user names or field values.
     const inventory=Object.groupBy(controls,e=>e.getAttribute('role')||e.tagName.toLowerCase()+(e.type?':'+e.type:''));
     return {controls:Object.fromEntries(Object.entries(inventory).map(([type,items])=>[type,items.length])),
      stableControls:controls.map(e=>e.id).filter(Boolean),
      actions:[...new Set(controls.flatMap(e=>e.getAttributeNames().filter(name=>/^data-(?:edit|save|add|delete|order|payment|ready|stock|topup|upload|refresh|filter|game|guide|page)(?:-|$)/.test(name))))],
      overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};
    });
    const measure=async(fn,wait)=>{
     const t=performance.now();await fn();await wait();return Math.round(performance.now()-t);
    };
    let delivery;
    if(entry.view==='paymentOrders'&&await target.locator('[data-payment-pending-stage="delivery"]').isVisible()){
     const queue=target.locator('[data-payment-pending-stage="delivery"]');
     const results=target.locator('[data-order-page*="pendingStage=delivery"]');
     const queueMs=await measure(()=>queue.click(),()=>results.waitFor({timeout:7000})).catch(()=>null);
     const card=results.locator('[data-payment-order-id]').first(),action=card.locator('[data-order-delivery]');
     if(await card.count()&&!await action.isVisible()){const toggle=card.locator('[data-order-toggle]');if(await toggle.isVisible())await toggle.click();}
     const dialog=p.locator('[data-payment-delivery-dialog][open]');
     const dialogMs=await action.isVisible()?await measure(()=>action.click(),()=>dialog.waitFor()).catch(()=>null):null;
     if(await dialog.isVisible()){const close=dialog.getByRole('button',{name:'Bağla',exact:true});if(await close.isVisible())await close.click();else await p.keyboard.press('Escape');}
     const repeatDialogMs=await action.isVisible()?await measure(()=>action.click(),()=>dialog.waitFor()).catch(()=>null):null;
     if(await dialog.isVisible())await p.keyboard.press('Escape');
     const payment=target.locator('[data-payment-pending-stage="payment"]');
     let repeatQueueMs=null;
     if(await payment.isVisible()){
      await payment.click();
      await target.locator('[data-order-page*="pendingStage=payment"]').waitFor({timeout:7000}).catch(()=>{});
      repeatQueueMs=await measure(()=>queue.click(),()=>results.waitFor({timeout:7000})).catch(()=>null);
     }
     const scroll=await target.evaluate(n=>new Promise(resolve=>{
      let frames=0,maxGap=0;
      const start=performance.now(),old=window.scrollY;
      let prev=start;
      const tick=t=>{
       maxGap=Math.max(maxGap,t-prev);prev=t;frames++;
       window.scrollTo(0,Math.abs(Math.sin((t-start)/115))*n.scrollHeight);
       if(t-start<550)requestAnimationFrame(tick);
       else{window.scrollTo(0,old);resolve({frames,maxGapMs:Math.round(maxGap)});}
      };requestAnimationFrame(tick);
     }));
     delivery={queueMs,repeatQueueMs,dialogMs,repeatDialogMs,scroll};
    }
    report.views.push({...entry,...counts,requests:[...new Map(requests.map(r=>[r.path+':'+r.status,r])).values()],errors:[...errors],...(delivery?{delivery}:{})});
   }catch(error){report.views.push({...entry,unverified:error.name,errors:[...errors],requests:[...requests]});}
   if(!entry.view){await p.goto(origin+'/admin.html',{waitUntil:'domcontentloaded'});await p.locator('.navBtn[data-view="dashboard"]').waitFor({state:'attached'});}
  }
  report.blockedWrites=[...blocked];reports.push(report);
  console.log(JSON.stringify({width,engine:engine.name(),views:report.views.length,unverified:report.views.filter(v=>v.unverified).map(v=>v.view||v.href),issues:report.views.filter(v=>v.overflow||v.errors?.length||v.requests?.some(r=>r.status>=400)).map(v=>({view:v.view||v.href,overflow:v.overflow,errors:v.errors,failed:v.requests?.filter(r=>r.status>=400)})),delivery:report.views.find(v=>v.view==='paymentOrders')?.delivery}));
 }finally{await browser.close();}
}
if(process.env.MIRPANEL_ADMIN_AUDIT_REPORT)await writeFile(process.env.MIRPANEL_ADMIN_AUDIT_REPORT,JSON.stringify(reports,null,2));
