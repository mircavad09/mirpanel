import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {profileCSS,profileShell} from '../mirpanel-admin/community/public/profile-shell.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const files={orders:'12345678-1234-4234-8234-000000000001',delivery:'12345678-1234-4234-8234-000000000002'};
const content='Sintetik təhvil\nİkinci sətir ✨';
const baseline=process.argv.includes('--baseline');
const previous=process.argv.includes('--previous');
const resume=process.argv.includes('--resume'),resumeBaseline=process.argv.includes('--resume-baseline');
const oldFiles=new Map(resumeBaseline?['page-navigation.js','browser-orders.js',...['profile-entry.js','profile-shell.js','account-panel.js','account-panel.css','account-codes.js','account-payments.js','account-subscriptions.js'].map(f=>'mirpanel-admin/community/public/'+f)].map(f=>[f,execFileSync('git',['show','5d9a0ee:'+f])]):baseline?['page-navigation.js','browser-orders.js','mirpanel-admin/community/public/account-panel.js','mirpanel-admin/community/public/account-codes.js','mirpanel-admin/community/public/profile.js','mirpanel-admin/community/public/account-panel.css'].map(f=>[f,execFileSync('git',['show','ac153ff:'+f])]):previous?['page-navigation.js','mirpanel-admin/community/public/account-panel.js','mirpanel-admin/community/public/account-payments.js','mirpanel-admin/community/public/account-subscriptions.js','mirpanel-admin/community/public/profile-entry.js','session-state.js'].map(f=>[f,execFileSync('git',['show','96f3280:'+f])]):[]);
let seen=[],owner='a',failOrders=false,delayLists=650,manyOrders=false;
const sample={id:files.orders,orderCode:'9180',product:'Synthetic order',plan:'1 ay',amount:10,status:'completed',createdAt:'2026-11-08T09:03:00Z',deliveries:[{id:files.delivery,line:0,quantity:1}]};
const profile=uid=>({user_id:uid,display_name:uid==='a'?'Synthetic A':'Synthetic B',email:'qa@example.invalid',member_number:1000,avatar:0,balanceCents:0,tier:{id:'standard',progress:0}});
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=u.pathname,uid=owner;
 const json=(code,d)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(d));};
 const html=body=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css">'+(p==='/profil'&&!baseline?'<link rel="stylesheet" href="'+profileCSS+'" data-shell-persistent>':'')+'<body class="community-page">'+fs.readFileSync('customer-header.html','utf8')+(p==='/'?'<a href="/profil">Profilim</a>':'')+body+'<script src="/customer-footer.js" defer></script><script src="/page-navigation.js"></script>');};
 if(p==='/api/payments/storefront')return json(200,{});
 if(p.startsWith('/api/'))seen.push(p+u.search);
 if(p==='/api/community/state'){await sleep(700);return uid?json(200,{profile:profile(uid)}):json(401,{error:'expired'});}
 if(p==='/api/community/profile-summary'){await sleep(200);return json(200,{orderCount:uid==='a'?1:0,latestOrder:null});}
 if(p==='/api/community/account-panel')return json(200,{products:[],wishlist:[],expensesCents:0,completedOrders:0});
 if(p==='/api/payments/my-orders'){await sleep(delayLists);return failOrders?json(503,{error:'test'}):json(200,{accountId:uid,orders:uid==='a'?(manyOrders?Array.from({length:30},(_,i)=>({...sample,id:'12345678-1234-4234-8234-'+String(i+1).padStart(12,'0'),orderCode:String(9180+i)})):[sample]):[],topups:[],nextCursor:null});}
 if(p==='/api/payments/my-orders/codes'){await sleep(delayLists);return json(200,{accountId:uid,codes:uid==='a'?[{id:files.delivery,title:sample.product,plan:sample.plan,quantity:1}]:[]});}
 if(p==='/api/payments/my-orders/codes/'+files.delivery)return json(uid==='a'?200:404,{text:uid==='a'?content:null});
 if(p==='/api/community/payment-history'){await sleep(delayLists);return json(200,{accountId:uid,balance:uid==='a'?12550:0,total:0,month:0,all:0,approved:0,pending:0,rejected:0,rejectedCents:0,items:[],more:false});}
 if(p==='/api/payments/shop/subscriptions'){await sleep(delayLists);return json(200,{accountId:uid,subscriptions:[]});}
 if(p==='/')return html('<main><h1>Ana səhifə</h1></main>');
 if(p==='/profil')return html(baseline?'<main id="communityApp" class="community-shell"></main><script type="module" src="/community-assets/community.js"></script>':'<main id="communityApp" data-profile-entry class="community-shell">'+profileShell(u.search)+'</main><script type="module" src="/community-assets/profile-entry.js?v=profile-start-20261108"></script>');
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(/^[\w/.-]+$/.test(file)&&!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/png'});return res.end(oldFiles.get(file)||fs.readFileSync(file));
 }
 json(404,{error:'not found'});
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const out=path.resolve('../../outputs/profile-opening');fs.mkdirSync(out,{recursive:true});
try{
 for(const [engine,width] of [[chromium,1440],[chromium,390],[webkit,390],...(resume||resumeBaseline?[[webkit,1440]]:[])]){
  owner='a';failOrders=false;delayLists=650;manyOrders=false;seen=[];
  const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  const record=!baseline&&!previous&&engine===chromium&&width===390;
  const c=await b.newContext({viewport:{width,height:820},...(record?{recordVideo:{dir:out,size:{width:390,height:820}}}:{})});
  try{
   const p=await c.newPage();p.setDefaultTimeout(8500);
   await p.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied=text}}));
   if(resume||resumeBaseline){
    await p.addInitScript(()=>{window.docMarker=Math.random();window.navKind=performance.getEntriesByType('navigation')[0]?.type;});
    manyOrders=true;await p.goto(origin+'/profil?tab=orders');
    await p.locator('[data-order-id]').first().waitFor();
    await p.evaluate(()=>window.scrollTo(0,550));
    const scroll=await p.evaluate(()=>scrollY);
    assert(scroll>=500);
    const marker=await p.evaluate(()=>window.docMarker);
    const hiddenCount=await p.evaluate(()=>{
     Object.defineProperty(document,'hidden',{configurable:true,value:true});
     document.dispatchEvent(new Event('visibilitychange'));
     return document.querySelectorAll('[data-order-id]').length;
    });
    const wake=performance.now();
    await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await p.locator('[data-order-id]').first().waitFor();
    const wakeMs=Math.round(performance.now()-wake);
    assert.equal(await p.evaluate(()=>window.docMarker),marker);
    assert.equal(hiddenCount,resumeBaseline?0:30);
    if(!resumeBaseline)assert(Math.abs(await p.evaluate(()=>scrollY)-scroll)<3);
    const times={};
    for(const [tab,ready] of [['payments','[data-metric=balance] strong'],['subscriptions','.subs-empty'],['codes','.account-code'],['orders','[data-order-id]']]){
     async function turn(){
      return p.evaluate(async({tab,ready})=>{
       const t=performance.now(),a=document.querySelector('[data-account-tab='+tab+']');a.click();
       const heading=()=>a.getAttribute('aria-current')==='page'&&document.querySelector('.account-tab-content h1')?.textContent===a.textContent.trim();
       const start=await new Promise(resolve=>{function frame(){if(heading())resolve(performance.now());else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
       const end=await new Promise(resolve=>{function frame(){if(document.querySelector(ready))resolve(performance.now());else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
       return {reaction:Math.round(start-t),data:Math.round(end-t)};
      },{tab,ready});
     }
     if(tab==='orders'){await p.locator('[data-account-tab=profile]').click();await p.locator('.profile-hero').waitFor();}
     const first=await turn();
     if(tab==='payments'){await p.locator('[data-status=rejected]').click();await p.getByText('Bu filtrə uyğun ödəniş yoxdur.').waitFor();await p.locator('.pay-history-tools input').fill('synthetic');}
     await p.locator('[data-account-tab=profile]').click();await p.locator('.profile-hero').waitFor();
     delayLists=2000;const repeat=await turn();delayLists=650;
     if(!resumeBaseline){assert(repeat.reaction<100);assert(repeat.data<500);if(tab==='payments'){assert.equal(await p.locator('.pay-history-tools input').inputValue(),'synthetic');assert.equal(await p.locator('[data-status=rejected]').getAttribute('aria-pressed'),'true');}}
     times[tab]={first,repeat};
    }
    if(!resumeBaseline){
     delayLists=2000;
     await p.evaluate(()=>{document.querySelector('[data-account-tab=payments]').click();document.querySelector('[data-account-tab=codes]').click();});
     await p.locator('.account-code').waitFor();
     await sleep(2100);
     assert.equal(await p.locator('[data-account-tab=codes]').getAttribute('aria-current'),'page');
     assert.equal(await p.locator('.account-payments').count(),0);
     delayLists=650;
     await p.locator('[data-account-tab=orders]').click();
     await p.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
     await p.locator('[data-order-id]').first().waitFor();
     assert.equal(await p.evaluate(()=>window.docMarker),marker);
     const saved=await c.storageState();
     await p.close();
     const reopened=await c.newPage();await reopened.goto(origin+'/profil?tab=orders');await reopened.locator('[data-order-id]').first().waitFor();
     assert.notEqual(await reopened.evaluate(()=>window.docMarker),marker);
     assert.equal(JSON.stringify(saved).includes(content),false);
     await reopened.locator('[data-account-tab=payments]').click();await reopened.locator('[data-metric=balance] strong').waitFor();
     await reopened.locator('[data-account-tab=codes]').click();await reopened.goBack();await reopened.locator('[data-metric=balance] strong').waitFor();
     await reopened.goForward();await reopened.locator('.account-code').waitFor();
     if(engine===chromium&&width===1440){
      delayLists=14000;
      const slow=await c.newPage();await slow.goto(origin+'/profil?tab=payments');
      await slow.locator('.account-tab-spinner').waitFor();
      await slow.getByRole('button',{name:'Yenidən cəhd et',exact:true}).waitFor({timeout:14500});
      assert.equal(await slow.locator('.account-tab-spinner').count(),0);
      delayLists=650;
      await slow.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();
      await slow.locator('[data-metric=balance] strong').waitFor();
      await slow.close();
      const broken=await c.newPage();let attempts=0;
      await broken.route('**/account-subscriptions.js*',route=>++attempts===1?route.abort():route.continue());
      await broken.goto(origin+'/profil?tab=subscriptions');
      await broken.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();
      await broken.locator('.subs-empty').waitFor();assert.equal(attempts,2);
      await broken.close();
     }
     await sleep(800);owner=null;
     await reopened.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
     await reopened.waitForURL('**/hesab?next=%2Fprofil%3Ftab%3Dcodes');assert.equal(await reopened.locator('.account-code').count(),0);
    }
    console.log(JSON.stringify({engine:engine.name(),width,resumeBaseline,hiddenCount,wakeMs,sameDocument:true,times}));continue;
   }
   if(baseline){
    const start=Date.now();await p.goto(origin+'/profil?tab=orders&order=9180',{waitUntil:'domcontentloaded'});
    await p.locator('.account-tabs').waitFor();const shellMs=Date.now()-start;
    await p.locator('details[data-order-code="9180"][open]').waitFor();
    console.log(JSON.stringify({engine:engine.name(),width,baseline,shellMs,orderMs:Date.now()-start,isolated:true}));continue;
   }
   await p.goto(origin);
   const start=Date.now();await p.getByRole('link',{name:'Profilim'}).click();
   await p.locator('.account-tabs').waitFor();const shellMs=Date.now()-start;
   assert.equal(await p.getByText('Məlumatlar yüklənir…',{exact:true}).count(),0);
   assert.equal(await p.locator('.profile-hero').count(),0);
   await p.locator('.profile-hero').waitFor();const profileMs=Date.now()-start;
   assert(seen.includes('/api/community/state'));assert.equal(seen.some(x=>x.startsWith('/api/payments/')),false);
   assert.equal(seen.filter(x=>x==='/api/community/account-panel').length,0);
   seen=[];const directStart=Date.now();await p.goto(origin+'/profil?tab=orders&order=9180',{waitUntil:'domcontentloaded'});
   await p.locator('.account-tabs').waitFor();const directShellMs=Date.now()-directStart;
   assert.equal(await p.getByText('Hələ sifarişiniz yoxdur').count(),0);
   const order=p.locator('details[data-order-code="9180"][open]');await order.waitFor();
   const orderMs=Date.now()-directStart;assert.equal(seen.filter(x=>x==='/api/payments/my-orders?order=9180').length,1);
   assert.equal(seen.some(x=>x.includes('/codes')||x.includes('/wallet')||x.includes('/profile-summary')),false);
   await p.reload({waitUntil:'domcontentloaded'});await order.waitFor();
   await p.locator('[data-account-tab=codes]').click();await p.getByRole('button',{name:'Göstər',exact:true}).waitFor();
   await p.getByRole('button',{name:'Göstər',exact:true}).click();await p.getByText('İkinci sətir ✨',{exact:false}).waitFor();
   await p.getByRole('button',{name:'Gizlət',exact:true}).click();assert.equal(await p.locator('pre').textContent(),'');
   await p.locator('.account-code').getByRole('button',{name:'Kopyala',exact:true}).click();await p.getByText('Məlumat kopyalandı').waitFor();
   assert.equal(await p.evaluate(()=>window.__copied),content);
   await p.goBack();await order.waitFor();await p.goForward();await p.getByRole('button',{name:'Göstər',exact:true}).waitFor();
   await p.locator('[data-account-tab=orders]').click();await p.locator('[data-order-id]').waitFor();
   await p.locator('[data-account-tab=codes]').click();
   delayLists=2000;failOrders=true;
   const cacheStart=Date.now();await p.locator('[data-account-tab=orders]').click();
   await p.locator('[data-order-id]').waitFor();const cachedMs=Date.now()-cacheStart;assert(cachedMs<1100);
   await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).waitFor();assert.equal(await p.locator('[data-order-id]').count(),1);
   failOrders=false;delayLists=650;
   await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();
   const tabTimes={};
   for(const [tab,ready] of [['payments','[data-metric=balance] strong'],['subscriptions','.subs-empty']]){
    const measure=async()=>{const t=performance.now();await p.locator('[data-account-tab='+tab+']').click();await p.locator(ready).waitFor();return Math.round(performance.now()-t);};
    tabTimes[tab]={firstMs:await measure()};
    await p.locator('[data-account-tab=codes]').click();
    tabTimes[tab].repeatMs=await measure();
    if(!previous)assert(tabTimes[tab].repeatMs<500,'cached '+tab+' renders without waiting for the 650 ms API');
    await p.locator('[data-account-tab=orders]').click();
   }
   const footerTop=()=>p.locator('#customerFooter').evaluate(footer=>footer.getBoundingClientRect().top);
   const viewportHeight=await p.evaluate(()=>innerHeight);
   await p.goto(origin+'/profil?tab=payments',{waitUntil:'domcontentloaded'});
   await p.locator('.account-tab-spinner').waitFor();
   const loadingFooterTop=await footerTop();
   assert(loadingFooterTop>=viewportHeight,'The footer must stay below the viewport while payments load');
   await p.locator('[data-metric=balance] strong').waitFor();
   await p.locator('[data-account-tab=expenses]').click();
   await p.locator('.account-expenses').waitFor();
   assert(Math.abs(await footerTop()-loadingFooterTop)<2,'Short profile tabs should share the same footer position');
   await p.locator('#customerFooter .customer-footer-support').scrollIntoViewIfNeeded();
   assert(await p.getByRole('link',{name:'Operatora yaz',exact:true}).isVisible());
   await p.locator('[data-account-tab=orders]').click();
   await p.locator('[data-order-id]').waitFor();
   owner='b';await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'b'}})));
   assert.equal(await p.locator('[data-order-id]').count(),0);await p.getByText('Hələ sifarişiniz yoxdur').waitFor();
   assert.equal(await p.evaluate(()=>JSON.stringify([...Object.entries(localStorage),...Object.entries(sessionStorage)]).includes('Sintetik təhvil')),false);
   await p.locator('[data-account-tab=payments]').click();await p.locator('[data-metric=balance] strong').waitFor();
   assert(!((await p.locator('[data-metric=balance] strong').textContent()).includes('125')));
   console.log(JSON.stringify({engine:engine.name(),width,previous,shellMs,profileMs,directShellMs,orderMs,cachedMs,tabTimes,deepLink:true,ownTabOnly:true,refresh:true,backForward:true,accountSwitch:true,isolated:true}));
   const video=p.video();if(video){await p.close();await video.saveAs(path.join(out,'profil-sintetik-mobil.webm'));await video.delete().catch(()=>{});}
  }finally{await c.close();await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
