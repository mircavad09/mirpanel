import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {profileShell} from '../mirpanel-admin/community/public/profile-shell.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const files={orders:'12345678-1234-4234-8234-000000000001',delivery:'12345678-1234-4234-8234-000000000002'};
const content='Sintetik təhvil\nİkinci sətir ✨';
const baseline=process.argv.includes('--baseline');
const oldFiles=new Map(baseline?['page-navigation.js','browser-orders.js','mirpanel-admin/community/public/account-panel.js','mirpanel-admin/community/public/account-codes.js','mirpanel-admin/community/public/profile.js','mirpanel-admin/community/public/account-panel.css'].map(f=>[f,execFileSync('git',['show','ac153ff:'+f])]):[]);
let seen=[],owner='a',failOrders=false,delayLists=650;
const sample={id:files.orders,orderCode:'9180',product:'Synthetic order',plan:'1 ay',amount:10,status:'completed',createdAt:'2026-11-08T09:03:00Z',deliveries:[{id:files.delivery,line:0,quantity:1}]};
const profile=uid=>({user_id:uid,display_name:uid==='a'?'Synthetic A':'Synthetic B',email:'qa@example.invalid',member_number:1000,avatar:0,balanceCents:0,tier:{id:'standard',progress:0}});
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=u.pathname,uid=owner;
 const json=(code,d)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(d));};
 const html=body=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/community.css"><body class="community-page"><header class="site-header"><a href="/profil">Profilim</a></header>'+body+'<script src="/page-navigation.js"></script>');};
 if(p.startsWith('/api/'))seen.push(p+u.search);
 if(p==='/api/community/state'){await sleep(700);return json(200,{profile:profile(uid)});}
 if(p==='/api/community/profile-summary'){await sleep(200);return json(200,{orderCount:uid==='a'?1:0,latestOrder:null});}
 if(p==='/api/community/account-panel')return json(200,{products:[],wishlist:[],expensesCents:0,completedOrders:0});
 if(p==='/api/payments/my-orders'){await sleep(delayLists);return failOrders?json(503,{error:'test'}):json(200,{accountId:uid,orders:uid==='a'?[sample]:[],topups:[],nextCursor:null});}
 if(p==='/api/payments/my-orders/codes'){await sleep(delayLists);return json(200,{accountId:uid,codes:uid==='a'?[{id:files.delivery,title:sample.product,plan:sample.plan,quantity:1}]:[]});}
 if(p==='/api/payments/my-orders/codes/'+files.delivery)return json(uid==='a'?200:404,{text:uid==='a'?content:null});
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
 for(const [engine,width] of [[chromium,1440],[chromium,390],[webkit,390]]){
  owner='a';failOrders=false;delayLists=650;seen=[];
  const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  const record=!baseline&&engine===chromium&&width===390;
  const c=await b.newContext({viewport:{width,height:820},...(record?{recordVideo:{dir:out,size:{width:390,height:820}}}:{})});
  try{
   const p=await c.newPage();p.setDefaultTimeout(8500);
   await p.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied=text}}));
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
   owner='b';await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'b'}})));
   assert.equal(await p.locator('[data-order-id]').count(),0);await p.getByText('Hələ sifarişiniz yoxdur').waitFor();
   assert.equal(await p.evaluate(()=>JSON.stringify([...Object.entries(localStorage),...Object.entries(sessionStorage)]).includes('Sintetik təhvil')),false);
   console.log(JSON.stringify({engine:engine.name(),width,shellMs,profileMs,directShellMs,orderMs,cachedMs,deepLink:true,ownTabOnly:true,refresh:true,backForward:true,accountSwitch:true,isolated:true}));
   const video=p.video();if(video){await p.close();await video.saveAs(path.join(out,'profil-sintetik-mobil.webm'));await video.delete().catch(()=>{});}
  }finally{await c.close();await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
