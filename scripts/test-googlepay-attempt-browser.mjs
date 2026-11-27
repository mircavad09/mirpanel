// Browser capability and provider responses are simulated, not a real wallet payment.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest} from '../functions/odenis/epoint/[[path]].js';
const records=new Map();let starts=0,leaves=0,checks=0,lastBody;
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://fixture'),p=u.pathname,json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
 if(p.startsWith('/community-assets/')){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync('mirpanel-admin/community/public/'+p.slice(18)));}
 if(p.startsWith('/api/payments/epoint/')){
  if(p.endsWith('/status')&&!u.searchParams.has('ref'))return json({enabled:true,methods:{'google-pay':true,'apple-pay':true,birbank:true,m10:false},limits:{minCents:100,maxCents:50000}});
  if(req.method==='POST'){let raw='';for await(const part of req)raw+=part;const b=JSON.parse(raw);
   if(p.endsWith('/leave')){leaves++;const r=records.get(b.ref);if(r.status!=='success')r.attemptAbandoned=true;return json(r);}
   starts++;lastBody=b;const r={status:'pending',state:'ready',purpose:'topup',method:b.method||'card',cents:500,widget:'https://epoint.az/synthetic'};records.set(b.requestId,r);return json(r);
  }const row=records.get(u.searchParams.get('ref'));if(!row){res.statusCode=404;return json({error:'Ödəniş tapılmadı.'});}return json(row);
 }
 if(p.startsWith('/odenis/epoint/')){const r=onRequest({request:new Request('https://mirpanel.com'+p+u.search)});res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());}
 if(p==='/balans'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/shop.css"><body style="background:#111;color:white;font:16px system-ui;margin:12px"><h1>Balans artımı · sınaq</h1><form id="form"></form><script type="module">
 import {mountWalletSelection} from '/community-assets/wallet-selection.js';
 const form=document.querySelector('form'),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;},button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const request=async(p,o)=>{const r=await fetch('/api/payments/epoint/'+p,o),d=await r.json();if(!r.ok)throw Object.assign(Error(d.error),{status:r.status});return d;};
 await mountWalletSelection({form,accountId:'synthetic',getCents:()=>500,signal:new AbortController().signal,el,button,request,deviceSupports:async()=>true,walletTile:(method,fn)=>{const tile=button(method,fn);form.append(tile);return {tile};}});
 </script>`);}
 res.end('Synthetic destination');
 }catch(e){res.statusCode=500;res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};fs.mkdirSync('outputs/googlepay',{recursive:true});
try{for(const [engine,name]of [[chromium,'chrome'],[webkit,'webkit']]){const browser=await engine.launch(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of [320,390,430,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 Android Chrome/130'}),page=await ctx.newPage();page.setDefaultTimeout(10000);
 await ctx.addInitScript(()=>{window.PaymentRequest=class{async canMakePayment(){return true;}};});
 await ctx.route('https://epoint.az/**',r=>r.fulfill({contentType:'text/html',body:'Synthetic Google Pay widget'}));
 if(name==='chrome'&&width===390){
  const missing=randomUUID();await page.goto(root+'/balans?paymentReturn='+missing);await page.getByText('Ödəniş cəhdi yaradılmayıb. Ödəniş üsulunu seçə bilərsiniz.').waitFor();
  await page.getByRole('button',{name:'google-pay',exact:true}).click();await page.getByRole('button',{name:'Balansa əlavə et · 5,00 ₼',exact:true}).click();await page.getByRole('button',{name:'Təsdiq et',exact:true}).click();await page.waitForURL('**/odenis/epoint/odeme?ref=*');eq(lastBody.previousPayment,undefined);
 }
 const ref=randomUUID();records.set(ref,{status:'pending',purpose:'topup',state:'ready',method:'google-pay',cents:500,widget:'https://epoint.az/synthetic'});
 await page.goto(root+'/odenis/epoint/odeme?ref='+ref);await page.locator('iframe').waitFor();const before=starts;
 await page.locator('[data-payment-back]').click();await page.waitForURL('**/balans?paymentReturn=*');await page.getByRole('button',{name:'google-pay',exact:true}).waitFor();eq(records.get(ref).attemptAbandoned,true);eq(starts,before);
 await page.getByRole('button',{name:'apple-pay',exact:true}).click();await page.getByRole('button',{name:'Balansa əlavə et · 5,00 ₼',exact:true}).click();await page.getByRole('button',{name:'Təsdiq et',exact:true}).evaluate(b=>{b.click();b.click();});await page.waitForURL('**/odenis/epoint/odeme?ref=*');eq(starts,before+1);eq(lastBody.previousPayment,ref);eq(lastBody.method,'apple-pay');eq(lastBody.amount,'5.00');
 const next=lastBody.requestId;await page.goBack();await page.getByRole('button',{name:'google-pay',exact:true}).waitFor();
 await page.getByRole('button',{name:'google-pay',exact:true}).click();await page.getByRole('button',{name:'Balansa əlavə et · 5,00 ₼',exact:true}).click();await page.getByRole('button',{name:'Təsdiq et',exact:true}).click();await page.waitForURL('**/odenis/epoint/odeme?ref=*');eq(lastBody.previousPayment,next);eq(lastBody.method,'google-pay');eq(records.get(next).attemptAbandoned,true);
 // A late server success wins over abandonment; no browser message is payment proof.
 const finalRef=lastBody.requestId;records.get(finalRef).status='success';records.get(finalRef).balanceCents=500;await page.evaluate(()=>window.dispatchEvent(new Event('focus'))).catch(e=>{if(!e.message.includes('Execution context was destroyed'))throw e;});await page.waitForURL('**/ugurlu?ref=*');
 eq(await page.getByRole('heading',{name:'Balansınız uğurla artırıldı'}).count(),1);eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(name==='chrome'&&width===390)await page.screenshot({path:'outputs/googlepay/synthetic-success-390.png',fullPage:true});
 console.log('PASS',name,width,'Google Pay back, method switch, browser back, double click, late server success');await ctx.close();
 }}finally{await browser.close();}}console.log(JSON.stringify({checks,starts,leaves,realPayments:0,capabilities:'simulated'}));}finally{await new Promise(r=>server.close(r));}
