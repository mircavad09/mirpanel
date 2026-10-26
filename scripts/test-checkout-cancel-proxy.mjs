// Actual Cloudflare handler -> actual HTTP API -> isolated reservation adapter.
// No production business requests. --before runs the SAME acceptance assertion
// against the deployed old proxy, deliberately failing with its exact 404.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {onRequest as fixedProxy} from '../functions/api/payments/[[path]].js';
import {receiptFixture} from './receipt-gate-fixture.mjs';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentStore} from '../mirpanel-admin/payment-store.mjs';
import {randomImage} from './receipt-synthetic-fixtures.mjs';
const before=process.argv.includes('--before');
const proxy=before?(await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','68cd648:functions/api/payments/[[path]].js'])).toString('base64'))).onRequest:fixedProxy;
let checks=0,upstreamCalls=0,cancelCalls=0,releases=0,absenceChecks=0,transportFailure=false,browser,f,frontOrigin;
let dbRows=[],dbOrders=[],dbFailure=false;const queries=[];
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},id=()=>crypto.randomUUID(),originalFetch=globalThis.fetch;
globalThis.fetch=(input,options={})=>{
 const u=String(input?.url||input);
 if(u.startsWith('https://isolated-db.invalid/rest/v1/')){queries.push(new URL(u));return Promise.resolve(dbFailure?Response.json({message:'synthetic read failure'},{status:400}):Response.json(u.includes('/payment_orders?')?dbOrders:dbRows));}
 if(u.startsWith('https://mirpanel.onrender.com/')){upstreamCalls++;if(transportFailure)return Promise.reject(Error('isolated transport outage'));input=f.origin+u.slice('https://mirpanel.onrender.com'.length);}
 return originalFetch(input,{...options,...(options.body instanceof ReadableStream?{duplex:'half'}:{})});
};
const front=http.createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/payments/')){const chunks=[];for await(const b of req)chunks.push(b);const r=await proxy({request:new Request(frontOrigin+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})})});res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(Buffer.from(await r.arrayBuffer()));}
 const r=await originalFetch(f.origin+req.url);let body=await r.text();if(req.url==='/')body=body.replaceAll(f.origin,frontOrigin);res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'text/plain'});res.end(body);
}catch(e){res.writeHead(500);res.end('isolated transport error');}});
await new Promise(r=>front.listen(0,'127.0.0.1',r));frontOrigin='http://127.0.0.1:'+front.address().port;
const error=(code,status=409)=>Object.assign(Error(code),{code,status});
const post=(route,payload)=>fetch(frontOrigin+'/api/payments/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:frontOrigin},body:JSON.stringify(payload)});
try{
 f=await receiptFixture({createSystem:o=>{o.config.allowedOrigins.push(frontOrigin);return createPaymentSystem(o);}});
 f.store.cancelCustomerReservation=async(i,k)=>{cancelCalls++;const r=f.reservations.get(i);if(!r)throw error('RESERVATION_NOT_FOUND',404);if(r.checkout_key!==k)throw error('RESERVATION_CHECKOUT_MISMATCH');if(r.status==='reviewing')throw error('RESERVATION_ALREADY_SUBMITTED');if(['cancelled','expired','completed'].includes(r.status))return{status:r.status,idempotent:true};r.status='cancelled';releases++;return{status:'cancelled',idempotent:false};};
 f.store.missingReservationIsClear=async(i,k)=>{absenceChecks++;return ![...f.reservations.values()].some(r=>r.id===i||(r.checkout_key===k&&!['cancelled','expired'].includes(r.status)));};
 const reserve=async()=>{const key=id(),r=await f.store.reserve({checkoutKey:key,productId:'test',planId:'0'});return{reservationId:r.id,checkoutKey:key};};
 const first=await reserve(),response=await post('reservations/cancel',first),payload=await response.json();
 console.log(JSON.stringify({phase:before?'before':'after',status:response.status,payload,upstreamCalls}));
 eq(response.status,200,'canonical cancellation must pass Cloudflare and reach the API');eq(f.reservations.get(first.reservationId).status,'cancelled');
 eq(releases,1);await post('reservations/cancel',first);eq(releases,1);
 for(const state of['expired','cancelled','completed']){const p=await reserve();f.reservations.get(p.reservationId).status=state;const n=releases;eq((await post('reservations/cancel',p)).status,200);eq(releases,n);eq(f.reservations.get(p.reservationId).status,state);}
 const missing={reservationId:id(),checkoutKey:id()},absent=await post('reservations/cancel',missing);eq(absent.status,200);eq((await absent.json()).cancellation.serverVerifiedAbsent,true);
 const active=await reserve();const n=absenceChecks;eq((await post('reservations/cancel',{...active,checkoutKey:id()})).status,409);eq(absenceChecks,n);eq(f.reservations.get(active.reservationId).status,'reserved');
 eq((await post('reservations/cancel',{reservationId:id(),checkoutKey:active.checkoutKey})).status,404,'active same-checkout reservation prevents stale cleanup');
 f.reservations.get(active.reservationId).status='reviewing';eq((await post('reservations/cancel',active)).status,409);eq(f.reservations.get(active.reservationId).status,'reviewing');
 const count=upstreamCalls,wrong=await post('reservation/cancel',missing);eq(wrong.status,404);eq((await wrong.json()).code,'PAYMENT_PROXY_ROUTE_NOT_FOUND');eq(upstreamCalls,count,'wrong endpoint never reaches DB');
 const cross=await fetch(frontOrigin+'/api/payments/reservations/cancel',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:JSON.stringify(first)});eq(cross.status,403);
 // Real Supabase JS query adapter: fail closed on data/read ambiguity.
 const store=createPaymentStore({...f.config,supabaseUrl:'https://isolated-db.invalid'}),rid=id(),key=id();
 eq(await store.missingReservationIsClear(rid,key),true);eq(queries.at(-1).searchParams.get('or'),`(id.eq.${rid},checkout_key.eq.${key})`);
 for(const state of['reserved','reviewing','completed','rejected']){dbRows=[{id:id(),status:state}];eq(await store.missingReservationIsClear(rid,key),false);}
 dbRows=[{id:rid,status:'cancelled'}];eq(await store.missingReservationIsClear(rid,key),false,'existing ID cannot be hidden by ownership filtering');
 dbRows=[{id:id(),status:'expired'}];eq(await store.missingReservationIsClear(rid,key),true);dbOrders=[{id:id()}];eq(await store.missingReservationIsClear(rid,key),false);dbOrders=[];dbRows=Array.from({length:101},()=>({id:id(),status:'cancelled'}));eq(await store.missingReservationIsClear(rid,key),false);dbRows=[];dbFailure=true;await assert.rejects(()=>store.missingReservationIsClear(rid,key));checks++;dbFailure=false;
 const {chromium}=await import(pathToFileURL(process.env.MIRPANEL_NODE_MODULES+'/playwright/index.mjs'));browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});const errors=[],png=await randomImage();
 async function open(width=390){const p=await browser.newPage({viewport:{width,height:640}});p.on('pageerror',e=>errors.push(e.message));await p.goto(frontOrigin);await p.addStyleTag({content:'.modal:not(.show){display:none}'});await p.evaluate(()=>document.querySelector('#modal').classList.add('show'));await p.click('[data-payment-method]');await p.click('#paymentMethodContinue');await p.waitForSelector('#paymentReceiptInput',{state:'attached'});return p;}
 fs.mkdirSync('payment-test-artifacts/checkout-cancel-proxy',{recursive:true});
 for(const width of[320,360,390,430,768,1024,1440])for(const selector of['#paymentCancel','.paymentFlowClose']){const p=await open(width),n=cancelCalls,s=releases;await p.locator(selector).click();await p.waitForFunction(()=>window.__paymentOrder===null);eq(cancelCalls,n+1);eq(releases,s+1);eq(await p.isVisible('#modal'),false);eq(await p.evaluate(()=>sessionStorage.getItem('mirpanel-payment-checkout-v1')),null);eq(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);await p.close();}
 // Explicit dismissal is not cancellation: capability survives for recovery.
 for(const scenario of['network','wrong-endpoint','server']){const p=await open(),saved=await p.evaluate(()=>sessionStorage.getItem('mirpanel-payment-checkout-v1')),r=JSON.parse(saved),n=releases;
 if(scenario==='network')transportFailure=true;
 else await p.route('**/api/payments/reservations/cancel',route=>route.fulfill({status:scenario==='server'?500:404,contentType:'application/json',body:JSON.stringify({error:'Tapılmadı.',code:scenario==='server'?'PAYMENT_ERROR':'PAYMENT_PROXY_ROUTE_NOT_FOUND'})}));
 await p.click('.paymentFlowClose');await p.waitForSelector('#paymentDismissBox:not([hidden])');eq(await p.isVisible('#modal'),true);eq(f.reservations.get(r.reservationId).status,'reserved');eq(await p.evaluate(()=>sessionStorage.getItem('mirpanel-payment-checkout-v1')),saved);eq(await p.locator('#paymentDismissBox').textContent().then(x=>x.includes('stoku azad etmir')),true);
 await p.locator('#paymentDismiss').scrollIntoViewIfNeeded();eq(await p.locator('#paymentDismiss').evaluate(e=>e.getBoundingClientRect().height>=44),true);if(scenario==='network')await p.screenshot({path:'payment-test-artifacts/checkout-cancel-proxy/error-390.png'});await p.click('#paymentDismiss');await p.waitForFunction(()=>window.__paymentOrder===null);eq(await p.isVisible('#modal'),false);eq(await p.evaluate(()=>sessionStorage.getItem('mirpanel-payment-checkout-v1')),saved);eq(releases,n);const time=await p.locator('#paymentReservationCountdown').textContent();await p.waitForTimeout(1100);eq(await p.locator('#paymentReservationCountdown').textContent(),time);eq(await p.evaluate(()=>window.__navigations.length),0);transportFailure=false;await p.close();}
 const stale=await open(),cap=JSON.parse(await stale.evaluate(()=>sessionStorage.getItem('mirpanel-payment-checkout-v1')));f.reservations.delete(cap.reservationId);await stale.click('#paymentCancel');await stale.waitForFunction(()=>window.__paymentOrder===null);eq(await stale.isVisible('#modal'),false);eq(await stale.evaluate(()=>sessionStorage.getItem('mirpanel-payment-checkout-v1')),null);await stale.close();
 const late=await open();f.state.delay=700;await late.setInputFiles('#paymentReceiptInput',{name:'late.png',mimeType:'image/png',buffer:png});await late.waitForFunction(()=>document.querySelector('#paymentReceiptForm').classList.contains('isUploading'));transportFailure=true;await late.click('#paymentCancel');await late.waitForSelector('#paymentDismissBox:not([hidden])');await late.click('#paymentDismiss');await late.waitForFunction(()=>window.__paymentOrder===null);await late.waitForTimeout(900);eq(await late.isVisible('#modal'),false);eq(f.orders.size,0);eq(await late.evaluate(()=>window.__navigations.length),0);transportFailure=false;await late.close();eq(errors,[]);
 const result={ok:true,checks,failures:0,realProxyAndAPI:true,widths:[320,360,390,430,768,1024,1440],missingReservationVerified:true,generic404NotSuccess:true,ownershipProtected:true,explicitDismissPreservesRecovery:true,lateUploadSafe:true,ordersCreated:0,productionWrites:0};fs.writeFileSync('payment-test-artifacts/checkout-cancel-proxy/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{globalThis.fetch=originalFetch;await browser?.close();if(f)await new Promise(r=>f.server.close(r));await new Promise(r=>front.close(r));}
