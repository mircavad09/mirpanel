import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import {onRequest} from '../functions/_middleware.js';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live');
const onlyAfter=process.argv.includes('--after-only');
const baseline='21729b0';
const before=new Map(live?[]:['index.html','site-header.js','browser-nav.js','session-state.js','account-header.js','account-header.css'].map(file=>[file,execFileSync('git',['show',baseline+':'+file])]));
const mime={js:'text/javascript',css:'text/css',html:'text/html',page:'text/html',png:'image/png',webp:'image/webp',json:'application/json'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let origin;
const server=http.createServer(async(req,res)=>{
 try{
  const old=req.headers['x-qa-baseline']==='1';
  const request=new Request(origin+req.url,{method:req.method,headers:req.headers});
  const result=await onRequest({request,next:async(nextRequest=request)=>{
   const p=new URL(nextRequest.url).pathname;
   if(p.startsWith('/api/'))return new Response('{}',{status:404,headers:{'Content-Type':'application/json'}});
   const file=p==='/'?'index.html':p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
   if(!/^[\w/.-]+$/.test(file)||file.includes('..'))return new Response(null,{status:404});
   try{return new Response(old&&before.has(file)?before.get(file):await fs.readFile(file),{headers:{'Content-Type':mime[file.split('.').at(-1)]||'application/octet-stream'}});}
   catch{return new Response(null,{status:404});}
  }});
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
origin='http://127.0.0.1:'+server.address().port;
const user=(id,name,balance,avatar)=>({user_id:id,display_name:name,balanceCents:balance,avatarUrl:'/community-assets/avatar-'+avatar+'.webp'});
const first=user('qa-1','Sınaq Bir',432,'robot'),second=user('qa-2','Sınaq İki',987,'pinqvin');
const url=live?'https://mirpanel.com':origin;
const results=[];

async function run(browser,engine,width,old,delay){
 const p=await browser.newPage({viewport:{width,height:850},extraHTTPHeaders:old?{'x-qa-baseline':'1'}:{}});
 const label={engine,width,phase:live?'live synthetic':old?'before':'after',delay};
 let profile=first,requests=0,status=200;
 await p.addInitScript(()=>{
  window.qa={token:Math.random(),guest:null,guestInserted:null,pending:null,account:null,content:null};
  new MutationObserver(()=>{
   if(qa.guestInserted===null&&document.querySelector('.account-guest-toggle'))qa.guestInserted=Math.round(performance.now());
  }).observe(document,{childList:true,subtree:true});
  function frame(){
   for(const [key,selector] of Object.entries({guest:'.account-guest-toggle',pending:'.account-session-placeholder',account:'.account-toggle',content:'#homeQuickLinks a[href="/mehsul/capcut-pro"]'})){
    const node=document.querySelector(selector);
    if(qa[key]===null&&node?.getClientRects().length&&getComputedStyle(node).visibility!=='hidden')qa[key]=Math.round(performance.now());
   }
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 });
 await p.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.origin!==url)return r.abort();
  if(u.pathname==='/api/community/state'){
   requests++;const payload=profile,s=status;
   await sleep(delay);
   return r.fulfill({status:s,json:s===200?{profile:payload,unreadTags:1}:{error:'Synthetic error'}}).catch(()=>{});
  }
  if(u.pathname==='/api/community/notifications')return r.fulfill({json:{unread:1,items:[{text:'Sınaq bildirişi',messageId:'qa'}]}});
  if(u.pathname==='/api/auth/sign-out'){profile=null;return r.fulfill({json:{ok:true}});}
  if(r.request().method()!=='GET')return r.fulfill({status:405,json:{}});
  if(u.pathname==='/site-header.js')await sleep(450);
  if(u.pathname==='/api/payments/inventory')return r.fulfill({json:{products:[]}});
  return r.continue();
 });
 const verified=p.locator('.account-toggle');
 async function measure(reload=false){
  requests=0;
  if(reload)await p.reload({waitUntil:'commit'});else await p.goto(url+'/',{waitUntil:'commit'});
  await verified.waitFor();
  await p.waitForFunction(()=>qa.account!==null&&qa.content!==null);
  const metrics=await p.evaluate(()=>{
   const entry=performance.getEntriesByType('resource').find(x=>new URL(x.name).pathname==='/api/community/state');
   return {...qa,start:Math.round(entry.startTime),response:Math.round(entry.responseEnd)};
  });
  if(!old){assert.equal(metrics.guestInserted,null,'verified account never renders guest');assert.equal(requests,1,'early and header reads are coalesced');if(delay>1000){assert(metrics.pending!==null&&metrics.pending<metrics.account);assert(metrics.content<metrics.response,'home content is independent of the slow session');}}
  return {...metrics,requests};
 }
 try{
  const direct=await measure();
  const reload=await measure(true);
  console.log(JSON.stringify({...label,direct,reload}));
  results.push({...label,direct,reload});
  if(old)return;
  await p.locator('.account-bell [data-tag-count]').waitFor();
  if(!old&&delay>1000){
   await fs.mkdir('outputs/home-session',{recursive:true});
   await p.screenshot({path:'outputs/home-session/'+(live?'live-':'')+engine+'-'+width+'.png'});
  }
  const token=await p.evaluate(()=>qa.token);
  await p.waitForFunction(()=>window.MirpanelNavigation);
  await p.evaluate(()=>window.MirpanelNavigation.go('/mehsul/capcut-pro'));
  await p.locator('#pp-main-title').waitFor();
  await p.evaluate(()=>window.MirpanelNavigation.go('/'));
  await p.locator('#homeQuickLinks a[href="/mehsul/capcut-pro"]').first().waitFor();
  assert.equal(await p.evaluate(()=>qa.token),token);
  assert.equal(requests,1,'in-site return does not reset or refetch the session');
  assert.equal(await p.evaluate(()=>qa.guest),null);
  await p.locator('.account-bell [data-tag-count]').waitFor();
  if(width>=1000)assert.match(await p.locator('.desktop-balance').innerText(),/4\.32/);
  if(delay>1000)return;
  status=503;
  await p.evaluate(()=>window.refreshCommunityNav());
  assert(await verified.isVisible(),'network failure preserves verified controls');
  assert.equal(await p.locator('.account-guest-toggle').count(),0);
  status=200;profile=second;
  await p.evaluate(()=>window.refreshCommunityNav());
  await verified.click();
  assert.match(await p.locator('#accountDropdown').innerText(),/Sınaq İki/);
  assert(!((await p.locator('#accountDropdown').innerText()).includes('Sınaq Bir')));
  if(width>=1000)assert.match(await p.locator('.desktop-balance').innerText(),/9\.87/);
  await p.locator('.account-signout').click();
  await p.locator('.account-guest-toggle').waitFor();
  assert.equal(await p.locator('.account-toggle,.desktop-balance,.account-identity').count(),0);
  await p.reload({waitUntil:'commit'});
  await p.locator('.account-guest-toggle').waitFor();
  const guest=await p.evaluate(()=>({guest:qa.guest,response:performance.getEntriesByType('resource').find(x=>x.name.includes('/api/community/state'))?.responseEnd}));
  await p.waitForFunction(()=>qa.guest!==null);
  assert((await p.evaluate(()=>qa.guest))>=Math.floor(guest.response),'guest appears after confirmation');
  status=503;
  await p.reload({waitUntil:'commit'});
  await p.locator('.account-session-placeholder').waitFor();
  await p.locator('#homeQuickLinks a[href="/mehsul/capcut-pro"]').first().waitFor();
  await sleep(250);
  assert.equal(await p.locator('.account-guest-toggle').count(),0,'unresolved session does not become guest');
  console.log(JSON.stringify({...label,regressions:'SPA product/home, bell, balance, changed account, sign-out, confirmed guest, 503'}));
 }finally{await p.close();}
}

try{
 await Promise.allSettled([chromium,webkit].map(async engine=>{
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   for(const width of [390,1440])for(const delay of (live?[900]:[150,4300]))for(const old of live||onlyAfter?[false]:[true,false])await run(browser,engine.name(),width,old,delay);
  }finally{await browser.close();}
 })).then(results=>{for(const result of results)if(result.status==='rejected'){console.error(result.reason);process.exitCode=1;}});
}finally{
 await fs.mkdir('outputs/home-session',{recursive:true});
 await fs.writeFile('outputs/home-session/'+(live?'live':onlyAfter?'after':'comparison')+'.json',JSON.stringify(results,null,2));
 server.close();
}
