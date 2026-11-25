import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {onRequest} from '../functions/odenis/epoint/[[path]].js';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live'),ref='90000000-0000-4000-8000-000000000003',out=path.resolve('../../outputs/success-actions-20261125');fs.mkdirSync(out,{recursive:true});
let state='success',purpose='purchase',delivered=false,fault=false,reads=0,writes=0;
const result=()=>({purpose,status:state,cents:599,orderId:ref,orderCode:'DEMO-9001',checkoutId:ref,deliveryStatus:delivered?'completed':'preparing',balanceCents:1099});
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://fixture');if(req.method!=='GET'){writes++;res.writeHead(405);return res.end();}
 if(u.pathname.startsWith('/community-assets/')){const f='mirpanel-admin/community/public/'+u.pathname.slice(18);if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(f));}
 if(u.pathname.startsWith('/odenis/epoint/')){const r=onRequest({request:new Request(u)});res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());}
 res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>İzolə edilmiş keçid yoxlaması</h1>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){const b=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of [320,390,430,1440]){
 const c=await b.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
 // Shorten only polling delays, not network timeouts or CSS animation durations.
 await c.addInitScript(()=>{const native=setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,[1000,2000,3000,5000,8000,13000,20000,30000,60000].includes(ms)?300:ms,...args);});
 const p=await c.newPage();p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/**',async route=>{const req=route.request();if(req.method()!=='GET'){writes++;return route.fulfill({status:405,body:'{}'});}reads++;return route.fulfill({status:fault?503:200,contentType:'application/json',body:JSON.stringify(result())});});
 // Destination requests are intercepted too: no real account/order data is read.
 await p.route('**/profil?**',r=>r.fulfill({contentType:'text/html',body:'<h1>İzolə edilmiş keçid yoxlaması</h1>'}));
 state='success';purpose='purchase';delivered=false;fault=false;
 const url=base+'/odenis/epoint/ugurlu?ref='+ref;await p.goto(url);await p.locator('[data-result=paid]').waitFor();
 assert.equal(await p.locator('[data-epoint-check]').count(),0);assert.equal(await p.getByRole('link',{name:'Kodlarım',exact:true}).isVisible(),false);
 for(const [label,href] of [['Sifarişlərimə bax','/profil?tab=sifarislerim&order=DEMO-9001'],['Məhsullara bax','/mehsul'],['Ana səhifə','/']]){
  const a=p.getByRole('link',{name:label,exact:true});assert.equal(await a.getAttribute('href'),href);assert.equal(await a.locator('svg').count(),1);
  const box=await a.boundingBox();assert(box.height>=44);assert(await a.evaluate(n=>getComputedStyle(n).display==='flex'&&getComputedStyle(n).alignItems==='center'));
 }
 const sizes=await p.locator('[data-epoint-orders],[data-epoint-products]').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().width));assert.equal(sizes[0],sizes[1]);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(engine===chromium&&[390,1440].includes(width)){await p.waitForTimeout(700);await p.screenshot({path:out+'/'+(live?'live-assets-':'')+'preparing-'+width+'.png',fullPage:true});}
 // A failed background delivery read must keep confirmed payment success.
 fault=true;const before=reads;await p.waitForFunction(()=>document.querySelector('[data-result=paid]'));await p.waitForTimeout(350);assert(reads>before);assert.equal(await p.locator('[data-result=paid]').count(),1);assert.equal(await p.locator('[data-epoint-check]').count(),0);
 fault=false;delivered=true;await p.getByRole('link',{name:'Kodlarım',exact:true}).waitFor();assert.match(await p.locator('[data-epoint-message]').innerText(),/hazırdır.*Kodlarım/);
 const codes=p.getByRole('link',{name:'Kodlarım',exact:true});assert.equal(await codes.getAttribute('href'),'/profil?tab=kodlarim&order=DEMO-9001');assert.equal(await codes.locator('svg').count(),1);
 if(engine===chromium&&[390,1440].includes(width))await p.screenshot({path:out+'/'+(live?'live-assets-':'')+'ready-'+width+'.png',fullPage:true});
 for(const label of ['Kodlarım','Sifarişlərimə bax']){await p.getByRole('link',{name:label,exact:true}).click();assert.match(p.url(),new RegExp(label==='Kodlarım'?'tab=kodlarim&order=DEMO-9001':'tab=sifarislerim&order=DEMO-9001'));await p.goto(url);await p.locator('[data-result=paid]').waitFor();}
 // Products/home clicks navigate to the actual intended paths, isolated from account APIs.
 for(const [label,pathname]of [['Məhsullara bax','/mehsul'],['Ana səhifə','/']]){await p.route(base+pathname,r=>r.fulfill({contentType:'text/html',body:'<h1>İzolə edilmiş keçid yoxlaması</h1>'}),{times:1});await p.getByRole('link',{name:label,exact:true}).click();await p.waitForURL(base+pathname);await p.goto(url);await p.locator('[data-result=paid]').waitFor();}
 if(width===390){delivered=false;const start=reads;await p.goto(url);await p.locator('[data-result=paid]').waitFor();await p.waitForTimeout(3100);assert(reads-start>9,'confirmed delivery polling continues slowly after initial budget');delivered=true;await codes.waitFor();assert.equal(await p.locator('[data-epoint-check]').count(),0);}
 purpose='wallet';await p.reload();await p.getByRole('heading',{name:'Balansınız uğurla artırıldı'}).waitFor();assert.equal(await codes.isVisible(),false);assert.equal(await p.getByRole('link',{name:'Ödənişlərimə bax'}).getAttribute('href'),'/profil?tab=odenislerim');
 state='failed';await p.goto(url);await p.waitForURL(base+'/balans?paymentReturn='+ref);assert.equal(await p.locator('[data-result=paid]').count(),0);
 state='pending';purpose='purchase';await p.goto(url);await p.waitForURL(base+'/odenis?paymentReturn='+ref);assert.equal(await p.locator('[data-result=paid]').count(),0);
 assert.deepEqual(errors,[]);await c.close();console.log(JSON.stringify({engine:engine.name(),width,liveAssets:live,noPaidCheckButton:true,svgLinks:true,automaticDeliveryRefresh:true,readyCodesOnly:true,successRetainedOnRefreshError:true,linksClicked:true,nonSuccessReturnPreserved:true}));
 }}finally{await b.close();}}assert.equal(writes,0);console.log(JSON.stringify({reads,writes,realPayments:0,realOrders:0}));}finally{await new Promise(r=>server.close(r));}
