import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {withModuleRecovery} from '../module-recovery.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const old=execFileSync('git',['show','3fb52cde:page-navigation.js'],{encoding:'utf8'});
let checks=0,writes=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const requests=[],faults=new Map();let origin;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shell=(path)=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QA</title></head><body><header class="site-header">MIRPANEL</header>${path==='/balans'?'<main id="shopApp"></main><script type="module" src="/community-assets/shop-ui.js?v=fixture"></script>':'<main><h1>'+path+'</h1></main>'}</body></html>`;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,origin),p=u.pathname;requests.push({path:p,search:u.search,time:Date.now(),method:req.method});
 const fault=faults.get(p);
 if(fault){fault.hits++;if(fault.delay)await sleep(fault.delay);if(fault.hits<=fault.fail){if(fault.reset){res.destroy();return;}res.writeHead(fault.status||503,{'Retry-After':fault.retryAfter||'0','Content-Type':'application/json'});res.end('{}');return;}}
 if(req.method!=='GET'){writes++;res.writeHead(503);res.end('{}');return;}
 if(p==='/api/read'){res.setHeader('Content-Type','application/json');res.end('{"balanceCents":550,"available":8}');return;}
 if(p==='/api/community/state'){res.setHeader('Content-Type','application/json');res.end('{"profile":null}');return;}
 if(p==='/catalog-card.js'){res.setHeader('Content-Type','text/javascript');res.end('window.initialScriptRuns=(window.initialScriptRuns||0)+1;');return;}
 if(p==='/qa.css'){res.setHeader('Content-Type','text/css');res.end('body{--qa-style:ready}');return;}
 if(p==='/slow.js'){res.setHeader('Content-Type','text/javascript');res.end('await new Promise(r=>setTimeout(r,180));window.slowEvaluations=(window.slowEvaluations||0)+1;export const ready=true;');return;}
 if(p==='/parent.js'){res.setHeader('Content-Type','text/javascript');res.end(withModuleRecovery("import {value} from '/dependency.js';export {value};",u.href));return;}
 if(p==='/dependency.js'){res.setHeader('Content-Type','text/javascript');res.end('if(window.failDependencyOnce){window.failDependencyOnce=false;throw TypeError("Synthetic dependency evaluation failure");}export const value=42;');return;}
 if(p==='/community-assets/auth-forms.js'){res.setHeader('Content-Type','text/javascript');res.end('export function mountAuth(){return ()=>{};}');return;}
 if(p==='/community-assets/shop-ui.js'){res.setHeader('Content-Type','text/javascript');res.end('await new Promise(r=>setTimeout(r,400));export function mountShop(){const app=document.getElementById("shopApp");app.innerHTML="<h1>Balansım</h1><input id=amount value=5><input id=receipt type=file><select id=plan><option>7 gün</option><option>1 ay</option></select><p data-ready>Hazırdır</p>";return ()=>{};}');return;}
 if(p==='/old-router.js'){res.setHeader('Content-Type','text/javascript');res.end(old.replace('15000','150'));return;}
 if(p==='/test'){res.setHeader('Content-Type','text/html');res.end(shell('/').replace('</body>','<script src="/request-recovery.js"></script><script src="'+(u.searchParams.has('old')?'/old-router.js':'/page-navigation.js')+'"></script></body>'));return;}
 if(p==='/balans'||p==='/elaqe'||p==='/haqqimizda'){res.setHeader('Content-Type','text/html');res.end(shell(p));return;}
 if(p==='/missing.js'||p.startsWith('/api/denied')){res.writeHead(p==='/missing.js'?404:Number(u.searchParams.get('status')||401));res.end('{}');return;}
 try{const file=p.slice(1);if(file.includes('..'))throw Error();let body=await fs.readFile(file,'utf8');if(p==='/request-recovery.js'&&!u.searchParams.has('realTiming'))body=body.replace('[1000,3000,7000]','[20,40,70]');res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');res.end(p.endsWith('.js')?withModuleRecovery(body,u.href):body);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 const context=await browser.newContext({viewport:{width:390,height:850}}),page=await context.newPage();page.setDefaultTimeout(8000);
 try{
  await page.goto(origin+'/test?old');await page.waitForFunction(()=>!!window.MirpanelNavigation);await page.evaluate(()=>void window.MirpanelNavigation.go('/balans'));await page.getByRole('heading',{name:'Yükləmə alınmadı',exact:true}).waitFor();await sleep(500);eq(await page.locator('[data-ready]').count(),0,'old deadline leaves permanent error despite completed import');
  await page.goto(origin+'/test');await page.waitForFunction(()=>!!window.MirpanelNavigation);
  faults.set('/catalog-card.js',{fail:1,hits:0,status:503});await page.evaluate(()=>{const script=document.createElement('script');script.src='/catalog-card.js';document.head.append(script);});await page.waitForFunction(()=>window.initialScriptRuns===1);eq(faults.get('/catalog-card.js').hits,2,'initial-document script failure recovers once');faults.delete('/catalog-card.js');
  faults.set('/qa.css',{fail:1,hits:0,status:503});await page.evaluate(()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/qa.css';document.head.append(link);});await page.waitForFunction(()=>getComputedStyle(document.body).getPropertyValue('--qa-style').trim()==='ready');eq(faults.get('/qa.css').hits,3,'initial CSS resource recovers');faults.delete('/qa.css');
  faults.set('/balans',{fail:2,hits:0,status:503});await page.evaluate(()=>void window.MirpanelNavigation.go('/balans'));await page.locator('[data-ready]').waitFor();eq(faults.get('/balans').hits,3,'route shell automatically recovers');faults.delete('/balans');
  // Recovery must never remount an already open form or clear browser File state.
  await page.locator('#amount').fill('12,50');await page.locator('#plan').selectOption({index:1});await page.locator('#receipt').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from('synthetic')});
  await page.evaluate(()=>localStorage.setItem('mirpanel.cart.v1','[{"productId":"qa","planIndex":1,"quantity":1}]'));
  faults.set('/api/read',{fail:2,hits:0,status:502});eq(await page.evaluate(async()=>await(await window.MirpanelRecovery.read('/api/read')).json()),{balanceCents:550,available:8});eq(await page.locator('#amount').inputValue(),'12,50');eq(await page.locator('#plan').inputValue(),'1 ay');eq(await page.locator('#receipt').evaluate(n=>n.files[0].name),'qa.png');eq(await page.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.v1'))[0].quantity),1);faults.delete('/api/read');
  // An unresolved physical evaluation is awaited again, never executed twice.
  eq(await page.evaluate(async()=>{const R=window.MirpanelRecovery;const results=await Promise.all([R.module('/slow.js',{timeout:100}),R.module('/slow.js',{timeout:100})]);return results.every(m=>m.ready)&&window.slowEvaluations===1;}),true,'one physical module evaluation');
  // A real failed dependency stays poisoned at the old native ESM URL.
  await page.evaluate(()=>window.failDependencyOnce=true);eq(await page.evaluate(async()=>{try{await import('/parent.js');return false;}catch{return true;}}),true);
  eq(await page.evaluate(async()=>{try{await import('/parent.js');return false;}catch{return true;}}),true,'native import retains failed dependency');
  eq(await page.evaluate(async()=>{try{await window.MirpanelRecovery.module('/parent.js');}catch{return false;}return true;}),true,'new recovery token rebuilds static dependency graph');faults.delete('/dependency.js');
  faults.set('/api/read',{fail:1,hits:0,reset:true});eq(await page.evaluate(async()=> (await window.MirpanelRecovery.read('/api/read')).status),200,'connection reset recovers');
  faults.set('/api/read',{fail:1,hits:0,delay:100});eq(await page.evaluate(async()=> (await window.MirpanelRecovery.read('/api/read',{}, {timeout:60})).status).catch(()=>0),0,'persistent body timeout exhausts bounded attempts');eq(faults.get('/api/read').hits,4);faults.delete('/api/read');
  for(const status of [401,403,404,422]){const before=requests.length;eq(await page.evaluate(async status=>(await window.MirpanelRecovery.read('/api/denied?status='+status)).status,status),status);eq(requests.length-before,1,'permanent error not retried');}
  const beforeWrites=writes;eq(await page.evaluate(async()=> (await window.MirpanelRecovery.read('/api/payments/shop/checkout',{method:'POST',body:'{}'})).status),503);eq(writes-beforeWrites,1,'mutation response is never automatically replayed');
  faults.set('/api/read',{fail:1,hits:0,status:429,retryAfter:'1'});const at=Date.now();await page.evaluate(()=>window.MirpanelRecovery.read('/api/read').then(r=>r.status));eq(Date.now()-at>=950,true,'Retry-After respected');eq(faults.get('/api/read').hits,2);faults.delete('/api/read');
  await context.setOffline(true);const count=requests.length;await page.evaluate(()=>{window.offlineResult=window.MirpanelRecovery.read('/api/read').then(r=>r.status);});await sleep(150);eq(requests.length,count,'offline sends no requests');await context.setOffline(false);eq(await page.evaluate(()=>window.offlineResult),200,'online event continues request');
  faults.set('/api/read',{fail:99,hits:0,status:503});await page.evaluate(()=>{window.watchLife=new AbortController();window.watchResult=0;window.watched=window.MirpanelRecovery.watch(async()=>{await window.MirpanelRecovery.read('/api/read');window.watchResult++;},{signal:watchLife.signal});void watched().catch(()=>{});});await page.waitForFunction(()=>!document.querySelector('[role=status]:not([hidden])'));await sleep(250);eq(faults.get('/api/read').hits,4,'bounded exhaustion');faults.set('/api/read',{fail:0,hits:0});await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>window.watchResult===1);eq(faults.get('/api/read').hits,1,'exhausted read resumes on reconnect');await page.evaluate(()=>watchLife.abort());faults.delete('/api/read');
  faults.set('/api/read',{fail:99,hits:0,status:503});await page.evaluate(()=>{window.returnLife=new AbortController();window.returned=0;window.returnRead=window.MirpanelRecovery.watch(async()=>{await window.MirpanelRecovery.read('/api/read');window.returned++;},{signal:returnLife.signal});void returnRead().catch(()=>{});});await sleep(350);eq(faults.get('/api/read').hits,4);faults.set('/api/read',{fail:0,hits:0});await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>window.returned===1);eq(faults.get('/api/read').hits,1,'hidden-to-visible resumes only failed reads');await page.evaluate(()=>returnLife.abort());faults.delete('/api/read');
  faults.set('/api/read',{fail:99,hits:0,status:429,retryAfter:'2'});await page.evaluate(()=>{window.cancelRead=new AbortController();window.cancelled=window.MirpanelRecovery.read('/api/read',{signal:cancelRead.signal}).catch(e=>e.name);});await sleep(80);await page.evaluate(()=>cancelRead.abort());eq(await page.evaluate(()=>window.cancelled),'AbortError');await sleep(150);eq(faults.get('/api/read').hits,1,'departing view stops delayed retries');faults.delete('/api/read');
  faults.set('/elaqe',{fail:0,hits:0,delay:300});await page.evaluate(()=>{void window.MirpanelNavigation.go('/elaqe');void window.MirpanelNavigation.go('/haqqimizda');});await page.getByRole('heading',{name:'/haqqimizda',exact:true}).waitFor();await sleep(400);eq(new URL(page.url()).pathname,'/haqqimizda');eq(await page.getByRole('heading',{name:'/haqqimizda',exact:true}).count(),1,'late previous response cannot replace new route');faults.delete('/elaqe');
  const before=requests.filter(r=>r.path==='/missing.js').length;eq(await page.evaluate(async()=>{try{await window.MirpanelRecovery.module('/missing.js');return false;}catch(e){return e.status===404;}}),true);eq(requests.filter(r=>r.path==='/missing.js').length-before,1,'real missing module stops');
  console.log('PASS',engine.name(),'old deadline reproduction, shared resources/reads, cached dependency, state retention, offline/reconnect, stale navigation, limits, no mutation replay');
 }finally{faults.clear();await browser.close();}
}
console.log(JSON.stringify({checks,syntheticMutationRequests:writes,productionWrites:0,realPayments:0,timing:'backoff compressed to 20/40/70ms except real 1s Retry-After; slow import 180ms and old deadline 150ms'}));
}finally{await new Promise(r=>server.close(r));}
