import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const id='90000000-0000-4000-8000-000000000003',delivery='90000000-0000-4000-8000-000000000004';
let state='ready',reads=0,writes=0;
const response=()=>({id,state:'submitted',mode:'epoint',orderCode:'DEMO-13223',totalCents:9999,paidCents:1649,paymentConfirmed:!['pending','failed','cancelled'].includes(state),payment:{state:['failed','cancelled'].includes(state)?state:state==='pending'?'unknown':'paid'},deliveryStatus:state==='ready'?'completed':state==='partial'?'partial':'preparing',deliverySummary:{ready:state==='ready',delivered:state==='ready'?2:state==='partial'?1:0,total:2,deliveryIds:state==='ready'?[delivery]:[]},items:[{status:state==='failed'?'rejected':state==='cancelled'?'cancelled':'reviewing'}]});
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture'),p=u.pathname;
 const json=d=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(d));};
 if(p.startsWith('/api/')&&req.method!=='GET'){writes++;res.writeHead(405);return res.end();}
 if(p==='/api/community/state')return json({profile:{user_id:'synthetic',balanceCents:0}});
 if(p==='/api/payments/shop/checkout'){reads++;return json(response());}
 if(p==='/api/payments/my-orders/codes')return json({accountId:'synthetic',codes:[{id:delivery,orderCode:'DEMO-13223',lineIndex:0,title:'Sintetik hesab',plan:'1 ay',quantity:1},{id:'other',orderCode:'OTHER',lineIndex:0,title:'Başqa sifariş'}]});
 if(p==='/api/payments/my-orders/codes/'+delivery)return json({text:'Yalnız sintetik təhvil',email:'demo@example.test',password:'DEMO-ONLY'});
 if(p.startsWith('/api/'))return json({items:[],methods:[]});
 if(p==='/odenis'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page"><main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script>');}
 if(p==='/profil'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><main id="codes"></main><script type="module">import {mountCodes} from "/community-assets/account-codes.js";const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);n.append(...children);return n;};const button=(t,f)=>{const n=el("button",{},t);n.onclick=f;return n;};mountCodes({content:document.getElementById("codes"),el,button});</script>');}
 const f=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(!f.includes('..')&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wav':'audio/wav'})[path.extname(f)]||'application/octet-stream'});return res.end(fs.readFileSync(f));}res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const out=path.resolve('../../outputs/product-payment-result');fs.mkdirSync(out,{recursive:true});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){
  const c=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
  await c.addInitScript(()=>{
   const native=setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,[3000,12000].includes(ms)?80:ms,...args);
   class AudioMock{state='running';destination={};resume(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({duration:.1});}createBufferSource(){return {connect(){},disconnect(){},start(){sessionStorage.setItem('played',String(Number(sessionStorage.getItem('played')||0)+1));this.onended?.();}};}}
   window.AudioContext=AudioMock;
  });
  const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  state='pending';reads=0;await p.goto(origin+'/odenis?completed='+id+'&status=success&amount=9999');await p.locator('.shop-result[data-result=reviewing]').waitFor();assert.equal(await p.getByRole('link',{name:'Kodlarım',exact:true}).count(),0);
  await p.locator('h1').click();state='ready';await p.locator('.shop-result[data-result=paid]').waitFor();await p.waitForFunction(()=>sessionStorage.getItem('played')==='1');
  assert((await p.locator('.shop-result-reference').innerText()).match(/16[.,]49/));assert(!(await p.locator('.shop-result-reference').innerText()).match(/99[.,]99/));
  const codes=p.getByRole('link',{name:'Kodlarım',exact:true});assert.equal(await codes.getAttribute('href'),'/profil?tab=kodlarim&order=DEMO-13223');assert.equal(await codes.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 182, 0)');
  assert.equal(await codes.evaluate(n=>getComputedStyle(n,'::before').animationDuration),'3s');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(engine===chromium&&width===390){await p.waitForTimeout(800);await p.screenshot({path:out+'/ready-mobile.png'});}
  await p.reload();await p.locator('.shop-result[data-result=paid]').waitFor();assert.equal(await p.evaluate(()=>sessionStorage.getItem('played')),'1');
  await codes.click();await p.getByText('demo@example.test',{exact:true}).waitFor();assert.equal(await p.locator('.codes-card:visible').count(),1);assert.equal(await p.getByText('Başqa sifariş',{exact:true}).isVisible(),false);
  await p.goBack();await p.locator('.shop-result[data-result=paid]').waitFor();assert.equal(await p.evaluate(()=>sessionStorage.getItem('played')),'1');
  for(const variant of ['preparing','partial','failed','cancelled']){state=variant;await p.goto(origin+'/odenis?completed='+id);await p.locator('.shop-result').waitFor();assert.equal(await p.getByRole('link',{name:'Kodlarım',exact:true}).count(),0);assert.equal(await p.locator('.shop-result').getAttribute('data-result'),['failed','cancelled'].includes(variant)?'rejected':'paid');if(variant==='partial')assert((await p.locator('.shop-result-message').innerText()).includes('qismən'));if(engine===chromium&&width===390&&['preparing','partial'].includes(variant)){await p.waitForTimeout(800);await p.screenshot({path:out+'/'+variant+'-mobile.png'});}}
  state='pending';reads=0;await p.goto(origin+'/odenis?completed='+id);await p.getByText(/Avtomatik yoxlama bitdi/).waitFor();assert(reads<=9);await p.waitForTimeout(250);assert(reads<=9);await p.getByRole('button',{name:'Yenidən yoxla'}).click();state='ready';await p.locator('.shop-result[data-result=paid]').waitFor();
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.shop-result-badge').evaluate(n=>n.getAnimations({subtree:true}).length),0);assert.equal(await p.locator('.shop-result-primary').evaluate(n=>n.getAnimations({subtree:true}).length),0);
  assert.deepEqual(errors,[]);await c.close();console.log('PASS '+(engine===chromium?'Chrome':'WebKit')+' '+width+': pending callback, ready/preparing/partial/failure, order-specific codes reveal, paid amount, bounded polling, one sound across reload/back, reduced motion, no overflow, GET-only');
 }
 const c=await browser.newContext({viewport:{width:390,height:850}});await c.addInitScript(()=>{window.AudioContext=class{constructor(){throw Error('Blocked audio');}};});const p=await c.newPage();state='ready';await p.goto(origin+'/odenis?completed='+id);await p.getByRole('heading',{name:'Ödənişiniz uğurla tamamlandı!'}).waitFor();await p.getByRole('link',{name:'Kodlarım',exact:true}).click();await p.getByText('demo@example.test',{exact:true}).waitFor();await c.close();
 }finally{await browser.close();}
}assert.equal(writes,0);console.log('PASS blocked audio remains usable; zero payment/delivery/balance mutations. Browser emulation only, no real devices.');}finally{await new Promise(r=>server.close(r));}
