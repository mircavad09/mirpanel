import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const before=process.argv.includes('--before'),live=process.argv.includes('--live'),demo=process.argv.includes('--demo');
const shellSource=before?execFileSync('git',['-c','safe.directory=*','show','d04fc3d:mirpanel-admin/community/public/profile-shell.js'],{encoding:'utf8'}):fs.readFileSync('mirpanel-admin/community/public/profile-shell.js','utf8');
const {profileShell,profileCSS,profileLoadingCSS}=await import('data:text/javascript;base64,'+Buffer.from(shellSource).toString('base64'));
if(!before)assert.ok(fs.readFileSync('mirpanel-admin/community/public/account-panel.css','utf8').includes(profileLoadingCSS));
const out='outputs/profile-loading';fs.mkdirSync(out,{recursive:true});
const tabs=['orders','codes','subscriptions','payments','expenses'],uid='synthetic-owner';
const profile={user_id:uid,display_name:'Sınaq hesabı',email:'demo@example.test',avatar:0,member_number:1,balanceCents:550};
const order={id:'11111111-1111-4111-8111-111111111111',orderCode:'SINAQ-01',product:'CapCut Pro',createdAt:'2026-11-13T12:00:00Z',status:'completed',amount:5,items:[{title:'CapCut Pro',planName:'1 aylıq',quantity:1,unitCents:500}],deliveries:[{id:'synthetic-delivery',line:0,quantity:1}]};
const responses={orders:{accountId:uid,orders:[order],deliveryDetails:{'synthetic-delivery':{text:'Sintetik hazır mesaj',email:'demo@example.test',password:'Synthetic-only'}},topups:[{id:'cached-old-topup',requested_cents:'600',status:'approved',created_at:order.createdAt}]},codes:{accountId:uid,codes:[{id:'synthetic-delivery',title:'CapCut Pro',plan:'1 ay',purchasedAt:order.createdAt}]},subscriptions:{accountId:uid,subscriptions:[{id:'sub-1',title:'CapCut Pro',plan:'1 ay',days:12,expiresOn:'2026-12-01',renewalCents:500}]},payments:{accountId:uid,items:[{id:'topup-1',kind:'topup',title:'Balans yükləmə',status:'approved',number:'SINAQ-01',cents:550,submitted_at:order.createdAt,operation_at:order.createdAt,by_receipt:false}],balance:550,total:550,month:550,rejectedCents:0,rejected:0,all:1,approved:1,reviewing:0,page:1,more:false},expenses:{expensesCents:500,completedOrders:1,products:[],wishlist:[]}};
let fail='',delay=900,stateDelay=650;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const html=tab=>'<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="'+profileCSS+'"><link rel="stylesheet" href="/browser-orders.css"><body class="community-page profile-screen" style="background:#000;color:white"><main id="communityApp" class="community-shell" data-profile-entry>'+profileShell('?tab='+tab)+'</main><script type="module">import {mountProfile} from "/community-assets/profile-entry.js?v=profile-loading-1";window.testReturn=()=>{history.pushState({},"","/profil?tab='+tab+'");mountProfile(document.querySelector("#communityApp"));};window.testAway=()=>{window.mirpanelPageDispose?.();history.pushState({},"","/other");document.querySelector("#communityApp").innerHTML="<h1>Digər səhifə</h1>";};document.addEventListener("click",e=>{const a=e.target.closest("[data-account-tab]");if(a){e.preventDefault();history.pushState({},"",a.href);window.mirpanelAccountNavigate(a.href);}});</script></html>';
async function respond(url){
 const p=new URL(url).pathname;
 if(p==='/profil')return {type:'text/html',body:html(new URL(url).searchParams.get('tab')||'orders')};
 if(p==='/api/community/state'){await pause(stateDelay);return {json:{profile}};}
 if(p.includes('/codes/synthetic-delivery'))return {json:{text:'Sintetik hazır mesaj',email:'demo@example.test',password:'Synthetic-only'}};
 const tab=p==='/api/payments/my-orders'?'orders':p.endsWith('/codes')?'codes':p.endsWith('/subscriptions')?'subscriptions':p.endsWith('/payment-history')?'payments':p.endsWith('/account-panel')?'expenses':null;
 if(tab){await pause(delay);return fail===tab?{status:503,json:{error:'Sintetik bağlantı xətası'}}:{json:responses[tab]};}
 if(p.startsWith('/api/'))return {json:{}};
 const f=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(p.endsWith('profile-entry.js'))await pause(280);
 try{const body=before?execFileSync('git',['-c','safe.directory=*','show','d04fc3d:'+f],{encoding:'utf8',stdio:['ignore','pipe','ignore']}):fs.readFileSync(f,'utf8');return {type:p.endsWith('.css')?'text/css':'text/javascript',body};}catch{return {status:404,body:''};}
}
const server=http.createServer(async(req,res)=>{const result=await respond('http://local'+req.url);res.writeHead(result.status||200,{'Content-Type':result.json?'application/json':result.type||'text/plain','Cache-Control':'no-store'});res.end(result.json?JSON.stringify(result.json):result.body);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
const ready={orders:'.browser-order-delivery pre',codes:'.codes-card',subscriptions:'.subs-card',payments:'.account-payment-row',expenses:'.account-expenses'};
try{for(const [engine,width] of before?[[chromium,390]]:demo?[[chromium,390],[chromium,1440]]:(process.argv.includes('--webkit')?[[webkit,390],[webkit,1440]]:[[chromium,390],[chromium,1440],[webkit,390],[webkit,1440]])){
 const b=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{const record=engine===chromium&&(width===390||demo);
 const c=await b.newContext({viewport:{width,height:850},...(record?{recordVideo:{dir:out,size:{width,height:850}}}:{})});const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(live)await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname==='/profil'||u.pathname.startsWith('/api/')){const d=await respond(u.href);return r.fulfill({status:d.status||200,contentType:d.json?'application/json':d.type,body:d.json?JSON.stringify(d.json):d.body});}return r.continue();});
 await p.addInitScript(()=>{window.framesSeen=[];window.phase='cold';const frame=()=>{const content=document.querySelector('.account-tab-content'),loader=content?.querySelector('.account-loading'),old=content?.querySelector('.browser-orders-placeholder,.browser-delivery-skeleton');if(content){window.framesSeen.push({phase:window.phase,old:!!old,loader:!!loader,background:loader?getComputedStyle(loader).backgroundColor:getComputedStyle(content).backgroundColor});}requestAnimationFrame(frame);};requestAnimationFrame(frame);});
 for(const tab of before||demo?['orders']:tabs){
  fail='';await p.goto(base+'/profil?tab='+tab,{waitUntil:'domcontentloaded'});
  if(!before){await p.locator('.account-loading').first().waitFor();await p.waitForFunction(()=>{const n=document.querySelector('.account-loading');return n&&getComputedStyle(n).backgroundColor==='rgb(0, 0, 0)';});if(record&&tab==='orders')await p.screenshot({path:out+'/loading-'+width+'.png'});}
  const actualReady=tab==='payments'?'.account-payment-list article':ready[tab];
  await p.locator(actualReady).first().waitFor();stateDelay=0;await p.waitForTimeout(80);
  if(before){console.log('BEFORE green skeleton frames',await p.evaluate(()=>framesSeen.filter(x=>x.old).length));await p.screenshot({path:out+'/before.png'});break;}
  assert.equal(await p.locator('.account-loading').count(),0);
  if(tab==='orders'){assert.equal(await p.locator('[data-topup-id]').count(),0);fs.mkdirSync('outputs/profile-records',{recursive:true});await p.screenshot({path:'outputs/profile-records/orders-'+engine.name()+'-'+width+'.png'});}
  assert.equal(await p.evaluate(()=>framesSeen.some(x=>x.old||x.background==='rgb(22, 27, 24)')),false);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.reload({waitUntil:'domcontentloaded'});await p.locator(actualReady).first().waitFor();
  // Visit another section and immediately return to the cached section while the network is slow.
  const other=tab==='codes'?'orders':'codes';
  await p.locator('[data-account-tab='+other+']').click();await p.locator(ready[other]).first().waitFor();
  await p.evaluate(()=>{window.phase='cached';window.framesSeen=[];});
  await p.locator('[data-account-tab='+tab+']').click();await p.locator(actualReady).first().waitFor({timeout:600});await p.waitForTimeout(140);
  assert.equal(await p.evaluate(()=>framesSeen.some(x=>x.loader)),false,tab+' cached frame');
  const backgroundPage=await c.newPage();await backgroundPage.goto('about:blank');await backgroundPage.bringToFront();await p.bringToFront();await p.locator(actualReady).first().waitFor({timeout:600});await backgroundPage.close();
  await p.evaluate(()=>testAway());await p.evaluate(()=>testReturn());await p.locator(actualReady).first().waitFor({timeout:700});
  if(record&&tab==='orders')await p.screenshot({path:out+'/mobile-ready.png',fullPage:true});
  // Genuine first-load failure must replace the spinner; retry must recover.
  fail=tab;await p.goto(base+'/profil?tab='+tab,{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).first().waitFor();
  assert.equal(await p.locator('.account-loading').count(),0,tab+' failed spinner stopped');
  fail='';await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).first().click();await p.locator(actualReady).first().waitFor();
  console.log('PASS',live?'live':'local',engine.name(),width,tab,'cold reload cached tab/section return error retry');
 }
 assert.deepEqual(errors,[]);
 const video=p.video();await c.close();if(video)fs.renameSync(await video.path(),path.join(out,(before?'before':live?(width===390?'live-mobile':'live-desktop'):(width===390?'mobile':'desktop'))+'.webm'));
 }finally{await b.close();}
}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
