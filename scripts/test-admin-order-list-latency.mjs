import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT||'playwright');
const before=process.argv.includes('--before');
const old=before?execFileSync('git',['show','9355b19:mirpanel-admin/public/payment-admin.js']):null;
const state=extractAdminState(await readFile('app.js','utf8'));
const origin='http://mirpanel.test';
const publicDir=new URL('../mirpanel-admin/public/',import.meta.url);
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css'};
const endpoint='/api/admin/payment-orders';
try {
for(const width of [390,1440])for(const delay of [180,900]){
 const c=await browser.newContext({viewport:{width,height:900},isMobile:width<650,hasTouch:width<650});
 let fail=false,slowPayment=false,deliveryRequests=0,detailRequests=0,reportRequests=0;
 await c.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin)return route.abort();
  if(u.pathname===endpoint){
   const stage=u.searchParams.get('pendingStage')==='delivery'?'delivery':'payment';
   const delivery=stage==='delivery';
   if(delivery)deliveryRequests++;
   const shouldFail=fail&&delivery;
   await new Promise(r=>setTimeout(r,delay+(!delivery&&slowPayment?250:0)));
   if(shouldFail)return route.fulfill({status:503,json:{error:'Sınaq xətası'}});
   const orders=Array.from({length:20},(_,i)=>({id:stage+'-'+i,orderCode:String(i),productTitle:'Sınaq məhsulu',status:delivery?'preparing':'reviewing',amount:2,currency:'AZN'}));
   return route.fulfill({json:{orders,permissions:{fields:true},counts:{pending:20,delivery:20,pendingTotal:40,today:5,all:70,expiring:3},pagination:{page:1,totalPages:1,total:20}}});
  }
  if(u.pathname===endpoint+'/delivery-0/details'){detailRequests++;return route.fulfill({json:{lines:[]}});}
  if(u.pathname==='/api/admin/payment-monthly-reports')reportRequests++;
  if(u.pathname==='/api/admin/state')return route.fulfill({json:{data:state,sha:'fixture',csrfToken:'fixture'}});
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{products:[],orders:[],methods:[],items:[],settings:{}}});
  try {
   const name=u.pathname.slice(1);
   return route.fulfill({body:old&&name==='payment-admin.js'?old:await readFile(new URL(name,publicDir)),contentType:types[name.split('.').at(-1)]});
  }catch{return route.fulfill({status:404});}
 });
 const p=await c.newPage();
 await p.goto(origin+'/admin.html#dashboard');
 const nav=async view=>{
  if(width<650)await p.locator('.mobileMenuToggle').click();
  await p.locator('.navBtn[data-view="'+view+'"]').click();
 };
 await nav('paymentOrders');
 const stage=name=>p.locator('[data-payment-pending-stage="'+name+'"]');
 const card=name=>p.locator('[data-payment-order-id="'+name+'-0"]');
 await card('payment').waitFor();
 const metrics=[];
 for(const name of ['delivery','payment','delivery']){
  const button=stage(name);
  const response=p.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&new URL(r.url()).searchParams.get('pendingStage')===name);
  const time=await button.evaluate((b,name)=>new Promise(resolve=>{
   b.addEventListener('click',()=>{
    const start=performance.now();
    let reaction;
    function frame(){
     const now=performance.now();
     if(reaction===undefined&&b.getAttribute('aria-pressed')==='true')reaction=now-start;
     if(document.querySelector('[data-payment-order-id="'+name+'-0"]'))resolve({reaction:Math.round(reaction),visible:Math.round(now-start)});
     else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
   },{capture:true,once:true});
   b.click();
  }),name);
  const res=await response;await res.finished();
  await p.locator('#paymentOrdersList:not([aria-busy])').waitFor();
  metrics.push(time);
 }
 if(!before){
  assert(metrics[2].visible<delay/2,JSON.stringify(metrics));
  assert.equal(reportRequests,0);
  if(width<650){
   assert.equal(detailRequests,0);
   await card('delivery').locator('[data-order-toggle]').click();
   await p.waitForFunction(()=>!document.querySelector('[data-payment-order-id="delivery-0"] .paymentOrderCardDetails').hidden);
   assert.equal(detailRequests,1);
  }
  const requestCount=deliveryRequests;
  slowPayment=true;
  const late=p.waitForResponse(r=>new URL(r.url()).searchParams.get('pendingStage')==='payment');
  await p.evaluate(()=>['payment','delivery','payment','delivery'].forEach(name=>document.querySelector('[data-payment-pending-stage="'+name+'"]').click()));
  await p.locator('#paymentOrdersList:not([aria-busy])').waitFor();
  await (await late).finished();
  slowPayment=false;
  assert.equal(deliveryRequests,requestCount+1);
  await card('delivery').waitFor();
  assert.equal(await card('payment').count(),0);
  fail=true;
  await p.locator('#paymentOrdersRefresh').evaluate(b=>b.click());
  const retry=p.getByRole('button',{name:'Yenidən cəhd et',exact:true});
  await retry.waitFor();
  fail=false;
  await retry.click();
  await retry.waitFor({state:'detached'});
  await card('delivery').waitFor();
  assert.equal(await p.locator('#paymentPendingCount').innerText(),'20');
  assert.equal(await p.locator('#paymentDeliveryCount').innerText(),'20');
 }
 const views={};
 for(const view of ['products','categories','settings','paymentMethods','paymentCosts','paymentReviews']){
  const button=p.locator('.navBtn[data-view="'+view+'"]');
  if(!await button.count())continue;
  views[view]=await button.evaluate(b=>new Promise(resolve=>{
   b.addEventListener('click',()=>{const start=performance.now();requestAnimationFrame(()=>resolve({ms:Math.round(performance.now()-start),active:b.classList.contains('active')}));},{capture:true,once:true});
   b.click();
  }));
 }
 console.log(JSON.stringify({mode:before?'before':'after',width,delay,first:metrics[0],repeat:metrics[2],views}));
 await c.unrouteAll({behavior:'wait'});
 await c.close();
}
}finally{await browser.close();}
