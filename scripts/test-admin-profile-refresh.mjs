import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import{chromium,webkit}from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='http://localhost:45937',out='outputs/user-profile-refresh';await fs.mkdir(out,{recursive:true});
for(const engine of[chromium,webkit]){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
try{for(const width of[390,1440]){
 const page=await browser.newPage({viewport:{width,height:850}});await page.clock.install();let special=200,cents=10000,fail=false,delayControls=false,heldControls;const counts=new Map(),writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const controlReads=()=>[...counts].filter(([k])=>k.startsWith('/api/admin/community/user-controls')).reduce((n,[,v])=>n+v,0);
 const user={id:'synthetic',name:'Sınaq Müştərisi',memberNumber:1234,email:'synthetic@example.test',orderCount:1};
 const controls=()=>({seller:true,rule:'Sınaq qaydası',plans:[{productId:'capcut',product:'CapCut Pro',planKey:'0',plan:'7 gün',standard:500,special},{productId:'chatgpt',product:'ChatGPT',planKey:'0',plan:'1 ay',standard:1500,special:null}],referralBasisPoints:500,identity:{id:user.id,email:user.email,emailVerified:true,password_login:false}});
 await page.route(base+'/**',async route=>{const req=route.request(),u=new URL(req.url()),p=u.pathname;
 if(p==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><button id="refreshBtn">Yenilə</button><main id="root" style="margin:12px"></main><script>window.api=async(path,opts)=>{const r=await fetch(path,opts);const v=await r.json();if(!r.ok)throw Error(v.error);return v};window.cmsRefreshes=0;document.querySelector("#refreshBtn").onclick=()=>cmsRefreshes++;window.notificationTicks=0;window.addEventListener("admin-topup-poll",()=>notificationTicks++);</script><script type="module">import{mount}from"/admin-community-panel.js";window.remount=()=>mount(document.querySelector("#root"),"communityUsers","active30");await window.remount();</script>'});
 if(p.startsWith('/api/admin/community/')){const key=p+u.search;counts.set(key,(counts.get(key)||0)+1);await new Promise(r=>setTimeout(r,25));
 if(req.method()==='POST'){const b=JSON.parse(req.postData());writes.push(b);if(b.kind==='price')special=b.amount===null?null:Math.round(Number(b.amount)*100);return route.fulfill({json:{ok:true,id:'synthetic-operation'}});}
 if(fail&&p.endsWith('/user-controls'))return route.fulfill({status:503,json:{error:'Sınaq bağlantı xətası'}});
 if(p.endsWith('/users'))return route.fulfill({json:{users:[{...user,balanceCents:cents,spentCents:500,lastSeen:'2026-11-15T01:00:00Z'}],total:1,hasMore:false}});
 if(p.endsWith('/users/synthetic'))return route.fulfill({json:{user,profile:{phone:'+994 00 000 00 00'},totalCents:500,orders:[{order_code:'TEST123',product_title:'CapCut Pro',plan_name:'7 gün',amount:5,currency:'AZN',status:'completed'}]}});
 if(p.endsWith('/wallet'))return route.fulfill({json:{cents,debitAvailable:true,items:[],more:false}});
 if(p.endsWith('/user-controls')){const snapshot=controls();if(delayControls){heldControls=()=>route.fulfill({json:snapshot});return;}return route.fulfill({json:snapshot});}
 if(p.endsWith('/user-statistics'))return route.fulfill({json:{period:u.searchParams.get('period'),items:[]}});
 return route.fulfill({json:{}});
 }
 try{return await route.fulfill({path:p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):'mirpanel-admin/public/'+p.slice(1),contentType:p.endsWith('.css')?'text/css':'text/javascript'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto(base+'/');await page.locator('button.wu-identity').first().click();
 const tab=name=>page.locator('.wu-tabs').getByRole('button',{name,exact:true}),panel=key=>page.locator('[data-user-tab-panel='+key+']');
 await tab('Xüsusi qiymətlər').click();const amount=page.getByLabel('İstifadəçinin qiyməti (₼)',{exact:true});await amount.waitFor();await amount.fill('3,45');await amount.evaluate(n=>window.savedPriceInput=n);
 await tab('Referallar').click();await page.getByLabel('Yönləndirmə faizi').fill('8,5');await tab('Xüsusi qiymətlər').click();assert.equal(await amount.inputValue(),'3,45');assert(await amount.evaluate(n=>n===savedPriceInput));
 await page.evaluate(async()=>{window.dispatchEvent(new CustomEvent('admin-community-view',{detail:'communityUsers'}));await remount();for(let i=0;i<5;i++){dispatchEvent(new Event('focus'));dispatchEvent(new Event('admin-topup-poll'));document.dispatchEvent(new Event('visibilitychange'));}});
 assert.equal(await amount.inputValue(),'3,45');assert(await amount.evaluate(n=>n===savedPriceInput));const before=controlReads();await page.waitForTimeout(60);assert.equal(controlReads(),before);
 await page.evaluate(()=>{window.loadFlashes=0;new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.textContent?.includes('Yüklənir'))loadFlashes++;}).observe(document.getElementById('root'),{subtree:true,childList:true});});
 for(const name of['Statistika','Digər','Sifarişlər','Balans']){await tab(name).click();await page.waitForTimeout(90);}
 await tab('Xüsusi qiymətlər').click();special=350;await page.evaluate(()=>{loadFlashes=0;document.querySelector('[data-user-tab-panel=prices]').style.minHeight='2000px';scrollTo(0,200);});const scrollBefore=await page.evaluate(()=>scrollY);const c=controlReads();await page.clock.runFor(599000);assert.equal(controlReads(),c);await page.clock.runFor(1000);await page.waitForTimeout(180);
 assert.equal(controlReads(),c+1,'prices/referrals/other share one GET');assert.equal(await amount.inputValue(),'3,45');assert(await amount.evaluate(n=>n===savedPriceInput));assert.equal(await page.evaluate(()=>notificationTicks),5);assert.equal(await page.evaluate(()=>scrollY),scrollBefore,'background refresh preserves scroll');
 await page.locator('#refreshBtn').click();await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>cmsRefreshes),0);assert.equal(await amount.inputValue(),'3,45');
 await page.getByRole('button',{name:'Qiyməti saxla',exact:true}).click();await panel('prices').getByText('CapCut Pro · 7 gün · 3,45 ₼',{exact:false}).waitFor();assert.equal(writes.at(-1).amount,'3.45');assert.equal(await tab('Xüsusi qiymətlər').getAttribute('aria-pressed'),'true');
 await tab('Balans').click();await page.getByRole('button',{name:'Balansı idarə et'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('AZN məbləği').fill('17,25');cents=20000;await page.clock.runFor(600000);await page.waitForTimeout(180);assert.equal(await dialog.getByLabel('AZN məbləği').inputValue(),'17,25');assert(await dialog.isVisible());await dialog.getByRole('button',{name:'Pəncərəni bağla',exact:true}).click();
 await page.locator('#refreshBtn').click();await page.getByText('200.00 AZN',{exact:true}).waitFor();
 await tab('Xüsusi qiymətlər').click();await amount.waitFor();const node=await amount.elementHandle();const n=controlReads();await page.evaluate(()=>{for(let i=0;i<4;i++)document.querySelector('#refreshBtn').click();});await page.waitForTimeout(180);assert.equal(controlReads(),n+1);assert(await amount.evaluate((e,old)=>e===old,node));
 fail=true;await page.locator('#refreshBtn').click();await page.getByText('Sınaq bağlantı xətası',{exact:true}).waitFor();assert(await amount.isVisible());assert.equal(await amount.inputValue(),'3.45');fail=false;
 // A response started before a save must not replace the saved price.
 delayControls=true;await page.locator('#refreshBtn').click();while(!heldControls)await new Promise(r=>setTimeout(r,10));delayControls=false;await amount.fill('4,56');await page.getByRole('button',{name:'Qiyməti saxla',exact:true}).click();await panel('prices').getByText('CapCut Pro · 7 gün · 4,56 ₼',{exact:false}).waitFor();await heldControls();await page.waitForTimeout(180);assert.equal(await amount.inputValue(),'4.56');
 assert.equal(await page.evaluate(()=>loadFlashes),0);assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/'+engine.name()+'-'+width+'.png'});await page.close();console.log(JSON.stringify({engine:engine.name(),width,tenMinutes:true,tabsRetained:true,draftsAndDialogRetained:true,repeatedMountNoReload:true,focusAndNotificationsNoReload:true,manualRefresh:true,saveImmediate:true,coalescedReads:true,noLoadingFlash:true}));
 }}finally{await browser.close();}}
