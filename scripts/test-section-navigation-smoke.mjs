// Actual public pages and synthetic read-only API responses. No production requests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {onRequest} from '../functions/_middleware.js';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const mime={js:'text/javascript',mjs:'text/javascript',css:'text/css',html:'text/html',page:'text/html',png:'image/png',webp:'image/webp',json:'application/json'};
let origin,delayOrder=false,delayListing=false,slowDetail=false,writes=0;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=http.createServer(async(req,res)=>{
 try{
  const request=new Request(origin+req.url,{method:req.method,headers:req.headers});
  const result=await onRequest({request,next:async(nextRequest=request)=>{
   const {pathname:p}=new URL(nextRequest.url);
   if(p==='/api/payments/shop/quote')return json({items:[]});
   if(req.method!=='GET'){writes++;return json({},405);}
   if(p==='/api/community/state')return json({profile:null});
   if(p.startsWith('/api/'))return json({},404);
   if(delayOrder&&p==='/order-confirmation.js')await sleep(850);
   if(delayListing&&p==='/mehsul.page')await sleep(550);
   if(slowDetail&&p==='/mehsul/netflix-sexsi.page')await sleep(800);
   const name=p==='/'?'index.html':p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
   if(!/^[\w/.-]+$/.test(name)||name.includes('..'))return new Response(null,{status:404});
   try{return new Response(await fs.readFile(name),{headers:{'Content-Type':mime[name.split('.').at(-1)]||'application/octet-stream'}});}
   catch{return new Response(null,{status:404});}
  }});
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
const flows=[['capcut-pro','capcut'],['netflix-sexsi','netflix'],['hbo-max','hbomax']];
try{
 for(const [engine,width] of [[chromium,390],[chromium,1440],[webkit,390],[webkit,1440]]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  const p=await browser.newPage({viewport:{width,height:850}});
  p.setDefaultTimeout(8500);
  try{
   const network=[];
   p.on('request',req=>{const pathname=new URL(req.url()).pathname;if(['/api/payments/inventory','/stock-display-fix.js'].includes(pathname))network.push(pathname);});
   await p.route(/^https?:\/\/(?!127\.0\.0\.1:)/,r=>r.abort());
   await p.route('**/api/payments/inventory',r=>r.fulfill({json:{products:flows.map(([,productId])=>({productId,scope:'product',available:20}))}}));
   await p.route('**/api/payments/shop/quote',r=>{
    const {productId,planIndex}=r.request().postDataJSON().items[0];
    const fields=productId==='capcut'?[]:[{key:'name',label:'Otaq adı',required:true,maxLength:40},{key:'code_4',label:'Otaq kodu',required:true,digits:4,maxLength:4}];
    return r.fulfill({json:{balanceCents:null,items:[{productId,planIndex,confirmationEnabled:true,terms:'Sintetik qaydalar · '+productId,termsVersion:'qa-terms',fields,planName:'Sınaq paketi'}]}});
   });
   delayOrder=true;await p.goto(origin+'/mehsul/capcut-pro',{waitUntil:'commit'});
   const button=p.locator('#pp-order-btn');await button.waitFor();
   assert(await button.isDisabled(),'order stays disabled while its handler downloads');
   await p.locator('#pp-order-btn:not([disabled])').waitFor();
   assert.equal(network[0],'/api/payments/inventory','inventory starts during HTML parsing');
   await button.evaluate(b=>b.click());await p.locator('dialog.cart-entry[open] h2').waitFor();
   await p.evaluate(()=>document.querySelector('dialog.cart-entry[open]').close());
   await p.waitForFunction(()=>!document.body.classList.contains('orderConfirmationActive')&&!!window.MirpanelNavigation);
   await p.evaluate(()=>void window.MirpanelNavigation.go('/'));await p.locator('#grid .card').first().waitFor();
   await p.evaluate(()=>history.back());await p.waitForURL('**/mehsul/capcut-pro',{waitUntil:'domcontentloaded'});await p.locator('#pp-order-btn:not([disabled])').waitFor();
   await p.evaluate(()=>history.forward());
   await p.locator('#grid .card').first().waitFor().catch(async e=>{console.error(await p.evaluate(()=>({path:location.pathname,history:history.length,state:history.state,router:!!window.MirpanelNavigation,pending:window.MirpanelNavigation?.pending,cards:document.querySelectorAll('#grid .card').length,status:document.querySelector('.site-route-loading')?.textContent})));throw e;});
   delayListing=true;
   await p.evaluate(()=>{void window.MirpanelNavigation.go('/mehsul');void window.MirpanelNavigation.go('/');});
   await p.locator('#grid .card').first().waitFor();await p.waitForTimeout(700);
   assert.equal(new URL(p.url()).pathname,'/');assert.equal(await p.locator('.catalog-grid').count(),0);
   await p.evaluate(()=>void window.MirpanelNavigation.go('/mehsul'));
   await p.locator('.catalog-grid .card').first().waitFor();
   delayOrder=delayListing=false;
   await p.addInitScript(()=>window.qaDocument=Math.random());
   await p.goto(origin+'/');
   await p.waitForFunction(()=>window.MirpanelNavigation&&document.querySelector('.browser-bottom-nav'));
   const token=await p.evaluate(()=>{window.qaHeader=document.querySelector('.site-header');window.qaBottom=document.querySelector('.browser-bottom-nav');return window.qaDocument;});
   const assertSame=()=>p.evaluate(token=>window.qaDocument===token&&window.qaHeader===document.querySelector('.site-header')&&window.qaBottom===document.querySelector('.browser-bottom-nav'),token);
   async function order(slug,id){
    await p.waitForURL(u=>u.pathname==='/mehsul/'+slug,{waitUntil:'commit'});
    await p.locator('#pp-order-btn:not([disabled])').waitFor();
    await p.locator('#pp-order-btn').click();
    const dialog=p.locator('dialog.cart-entry[open]');
    await dialog.getByText('Sintetik qaydalar · '+id).waitFor();
    if(id!=='capcut'){
     await dialog.getByRole('checkbox').check();
     await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).click();
     await dialog.getByLabel('Otaq kodu',{exact:true}).fill('0012');
     assert.equal(await dialog.getByLabel('Otaq kodu',{exact:true}).inputValue(),'0012');
    }
    await dialog.getByRole('button',{name:'Bağla',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
   }
   await p.locator('#homeQuickLinks a[href="/mehsul/capcut-pro"]').first().evaluate(a=>a.click());
   await order(...flows[0]);assert(await assertSame());
   await p.goBack();await p.locator('#grid .card').first().waitFor();assert(await assertSame());
   for(const [slug,id] of flows){
    await p.evaluate(()=>window.MirpanelNavigation.go('/mehsul?search='));
    const selector='.catalog-grid a[href="/mehsul/'+slug+'"]';
    await p.locator(selector).first().click();
    await order(slug,id);assert(await assertSame());
    await p.goBack();await p.locator(selector).first().waitFor();assert(await assertSame());
   }
   console.log('PASS real navigation smoke',engine.name(),width,'home, listing, CapCut/Netflix/HBO, consent, unchanged header and history; no business writes');
  }finally{await p.close();await browser.close();}
 }
 assert.equal(writes,0);
}finally{await new Promise(r=>server.close(r));}
