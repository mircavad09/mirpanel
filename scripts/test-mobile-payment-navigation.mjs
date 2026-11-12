import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const before=process.argv.includes('--before');
const measureBefore=process.argv.includes('--measure-before');
const live=process.argv.includes('--live');
const baseline=measureBefore?execFileSync('git',['-c','safe.directory=*','show','e2088c8:mirpanel-admin/community/public/shop-ui.js']):null;
const header=await fs.readFile('customer-header.html','utf8');
const draftId='11111111-2222-4333-8444-555555555555';
const cart=[{productId:'synthetic',planIndex:1,quantity:2,draftId,lineId:draftId,draftIds:[draftId],termsVersion:'qa-terms'}];
const profile={id:'qa',user_id:'qa',display_name:'Synthetic customer',email:'qa@example.invalid',emailVerified:true,balanceCents:100};
const product={...cart[0],title:'Synthetic product',planName:'Synthetic 1 ay',unitCents:499,standardCents:499,available:10,maskedDetails:[{label:'Otaq kodu',value:'••••'}]};
const shop='<main id="shopApp" class="shop-page"></main>';
let writes=0;
function mock(p){
 if(p==='/api/community/state')return {profile};
 if(p==='/api/payments/shop/quote')return {items:[product],totalCents:998,balanceCents:100};
 if(p==='/api/payments/shop/wallet')return {cents:0,items:[],topups:[]};
 if(p==='/api/payments/shop/draft')return {values:{pin:'0012'}};
 if(p==='/api/payments/methods')return {methods:[{id:'qa-card',available:true,displayName:'Synthetic ABB',providerName:'ABB',last4:'1234'}]};
 if(p==='/api/payments/storefront')return {products:Array.from({length:4},(_,i)=>({id:'offer'+i,title:'Synthetic offer '+i,path:'/mehsul/offer-'+i,priceCents:100}))};
 return {items:[],topups:[],balanceCents:100};
}
const server=http.createServer(async(req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 const send=(data,type='application/json',code=200)=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(data):data);};
 try{
  if(p==='/api/community/presence')return send({});
  if(req.method!=='GET'&&p!=='/api/payments/shop/quote'){writes++;return send({},'application/json',405);}
  if(p==='/api/payments/methods')await new Promise(r=>setTimeout(r,700));
  if(p.startsWith('/api/'))return send(mock(p));
  if(['/','/sebet','/odenis','/balans','/profil'].includes(p)){
   const isShop=['/sebet','/odenis','/balans'].includes(p);
   const main=isShop?shop:p==='/profil'?'<main id="communityApp" data-profile-entry></main>':'<main><h1>QA home</h1></main>';
   return send('<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/shop.css"></head><body class="community-page">'+header+main+
    (isShop?'<script type="module" src="/community-assets/shop-ui.js?v=direct-test"></script>':p==='/profil'?'<script type="module" src="/community-assets/profile-entry.js"></script>':'')+'<script defer src="/site-header.js"></script></body></html>','text/html');
  }
  if(!/^\/[a-z0-9_/.-]+$/i.test(p)||p.includes('..'))return send({},'application/json',404);
  if(baseline&&p==='/community-assets/shop-ui.js')return send(baseline,'text/javascript');
  const name=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
  return send(await fs.readFile(name),p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':'application/octet-stream');
 }catch{send({},'application/json',404);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
try{
 for(const [engine,width] of [[chromium,390],[webkit,390],[chromium,1440]]){
  const mobile=width<761,browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   const ctx=await browser.newContext({viewport:{width,height:650},hasTouch:mobile,isMobile:mobile});
   await ctx.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.origin!==origin)return r.abort();
    if(live&&u.pathname.startsWith('/api/')){
     if(u.pathname==='/api/payments/methods')await new Promise(r=>setTimeout(r,700));
     if(r.request().method()!=='GET'&&!['/api/community/presence','/api/payments/shop/quote'].includes(u.pathname)){writes++;return r.abort();}
     return r.fulfill({json:mock(u.pathname)});
    }
    if(live&&r.request().method()!=='GET'){writes++;return r.abort();}
    return r.continue();
   });
   const p=await ctx.newPage();
   await p.route('**/api/payments/shop/wallet',route=>route.fulfill({json:{cents:0,items:[],topups:[]}}));
   let balance=100,delay=false,fail=false;
   await p.route('**/api/payments/shop/quote',async route=>{
    if(delay)await new Promise(r=>setTimeout(r,1200));
    if(!fail&&route.request().postDataJSON()?.items?.length===0)return route.fulfill({json:{items:[],totalCents:0,balanceCents:balance}});
    return route.fulfill({status:fail?503:200,json:fail?{error:'Sınaq bağlantı xətası'}:{...mock('/api/payments/shop/quote'),balanceCents:balance}});
   });
   await p.route('**/api/community/state**',async route=>{
    if(delay)await new Promise(r=>setTimeout(r,800));
    return route.fulfill({json:{profile}});
   });
   await p.addInitScript(({cart,product})=>{
    if(!localStorage.getItem('mirpanel.cart.v1'))localStorage.setItem('mirpanel.cart.v1',JSON.stringify(cart));
    if(!localStorage.getItem('mirpanel.cart.preview.v1'))localStorage.setItem('mirpanel.cart.preview.v1',JSON.stringify({[product.lineId]:{title:product.title,planName:product.planName,unitCents:product.unitCents}}));
   },{cart,product});
   const heading=p.getByRole('heading',{name:'Ödəniş',exact:true});
   const onScreen=()=>heading.evaluate(n=>{const r=n.getBoundingClientRect(),h=document.querySelector('.site-header').getBoundingClientRect();return r.top>=h.bottom-1&&r.bottom<innerHeight-72;});
   const waitAligned=()=>p.waitForFunction(()=>{const n=[...document.querySelectorAll('.checkout-choices h2')].find(x=>x.textContent==='Ödəniş');if(!n)return false;const r=n.getBoundingClientRect(),h=document.querySelector('.site-header').getBoundingClientRect();return r.top>=h.bottom-1&&r.bottom<innerHeight-72;});
   const checkoutPage=await p.goto(origin+'/odenis');
   if(live){
    const html=await checkoutPage.text();
    for(const asset of ['shop-ui.js','shop.css'])assert.ok(html.includes(asset+'?v=checkout-first-paint-2'),'Live checkout must reference current '+asset);
   }
   await p.locator('.checkout-methods').waitFor();
   if(!before)assert.equal(await p.locator('.checkout-amount strong').textContent(),'9,98 ₼');
   const direct=await onScreen();
   if(before&&mobile)assert(!direct);
   if(!before&&mobile)await waitAligned();
   await p.goto(origin+'/sebet');
   const payments=p.locator('.browser-bottom-nav [data-browser-nav=payments]');
   await payments.waitFor({state:'attached'});
   const previousHref=await payments.getAttribute('href');
   if(before){assert.equal(previousHref,'/balans#emeliyyatlar');console.log(JSON.stringify({engine:engine.name(),width,directPaymentHeadingVisible:direct,paymentsDestination:previousHref}));continue;}
   const stored=await p.evaluate(()=>MirpanelCart.read());
   await p.getByText('9,98 ₼',{exact:true}).first().waitFor();
   delay=true;
   const started=performance.now();
   await p.getByRole('button',{name:'Ödənişə keç',exact:true}).click();
   if(measureBefore){await p.locator('.checkout-methods').waitFor();console.log(JSON.stringify({phase:'before',engine:engine.name(),width,methodsMs:Math.round(performance.now()-started)}));continue;}
   await p.locator('.checkout-methods').waitFor();
   if(mobile)await waitAligned();
   else assert(await p.locator('.shop-checkout-grid').evaluate(n=>{const [a,b]=n.children;return b.offsetLeft>a.offsetLeft&&Math.abs(a.offsetTop-b.offsetTop)<2;}));
   const methodsMs=Math.round(performance.now()-started);
   assert(methodsMs<1200,'Methods should appear before the delayed quote');
   assert.equal(await p.locator('.checkout-amount strong').textContent(),'9,98 ₼');
   await p.locator('.checkout-tile input[value="wallet"] + .checkout-icon').waitFor();
   await p.getByText('Balans yoxlanılır…',{exact:true}).waitFor();
   assert.equal(await p.getByText('Ödəniş üsulları hazırlanır…',{exact:true}).count(),0);
   const complete=p.getByRole('button',{name:/Sifarişi tamamla/});
   assert(await complete.isDisabled());
   await p.getByText('1,00 ₼ var · 8,98 ₼ çatmır',{exact:true}).waitFor();
   const balanceMs=Math.round(performance.now()-started);
   assert.equal(await p.locator('.checkout-shortfall progress').evaluate(x=>x.value/x.max),100/998);
   await p.locator('.checkout-consent input').check();
   assert(await complete.isDisabled());
   assert(await p.locator('input[name="paymentMode"][value="card"]').isDisabled());
   balance=0;fail=true;
   await p.reload({waitUntil:'domcontentloaded'});
   await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).waitFor();
   assert(await complete.isDisabled());
   assert.equal(await p.locator('.checkout-amount strong').textContent(),'9,98 ₼');
   fail=false;
   await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();
   await p.getByText('0,00 ₼ var · 9,98 ₼ çatmır',{exact:true}).waitFor();
   assert.equal(await p.locator('.checkout-shortfall progress').evaluate(x=>x.value),0);
   assert(await p.locator('.checkout-shortfall').evaluate(n=>n.scrollWidth<=n.clientWidth));
   const increase=p.getByRole('link',{name:'+ Artır',exact:true});
   await increase.click();
   await p.waitForURL('**/balans?returnTo=%2Fodenis%3Fmode%3Dwallet#balansi-artir');
   assert.deepEqual(await p.evaluate(()=>MirpanelCart.read()),stored);
   balance=1000;delay=false;
   await p.getByRole('link',{name:/Alışa qayıt/}).click();
   await p.waitForURL('**/odenis?mode=wallet');
   await p.locator('.checkout-consent input:enabled').check();
   assert(await complete.isEnabled());
   assert.equal(await p.getByText('Balans kifayət etmir',{exact:true}).count(),0);
   if(mobile){
    const returnPage=live?'/':'/profil?tab=payments';
    if(live)await p.goto(origin+returnPage);
    else{
     await p.locator('.browser-bottom-nav [data-browser-nav=payments]').click();
     await p.waitForURL(origin+returnPage);
     await p.locator('.account-payments').waitFor();
     assert.equal(await p.locator('#shopApp').count(),0);
    }
    await p.locator('.browser-bottom-nav [data-browser-nav=cart]').click();
    await p.locator('.mir-cart-next:not(:disabled)').click();
    await p.waitForURL('**/odenis');
    await p.locator('.checkout-methods').waitFor();await waitAligned();
    await p.goBack({waitUntil:'commit'});
    await p.waitForURL(origin+returnPage);
   }
   console.log(JSON.stringify({phase:'after',engine:engine.name(),width,methodsMs,balanceMs,retry:true,topupReturn:true,liveAssets:live}));
   assert.deepEqual(await p.evaluate(()=>MirpanelCart.read()),stored);
   assert.equal(await p.evaluate(id=>fetch('/api/payments/shop/draft?id='+id).then(r=>r.json()).then(r=>r.values.pin),draftId),'0012');
   console.log(JSON.stringify({engine:engine.name(),width,liveAssets:live,heading:true,cartPreserved:true,desktopColumns:!mobile}));
  }finally{await browser.close();}
 }
 assert.equal(writes,0);
}finally{await new Promise(r=>server.close(r));}
