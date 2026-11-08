import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const before=process.argv.includes('--before');
const live=process.argv.includes('--live');
const header=await fs.readFile('customer-header.html','utf8');
const draftId='11111111-2222-4333-8444-555555555555';
const cart=[{productId:'synthetic',planIndex:1,quantity:2,draftId,lineId:draftId,draftIds:[draftId],termsVersion:'qa-terms'}];
const profile={id:'qa',user_id:'qa',display_name:'Synthetic customer',email:'qa@example.invalid',emailVerified:true,balanceCents:100};
const product={...cart[0],title:'Synthetic product',planName:'Synthetic 1 ay',unitCents:499,available:10,maskedDetails:[{label:'Otaq kodu',value:'••••'}]};
const shop='<main id="shopApp" class="shop-page"></main>';
let writes=0;
function mock(p){
 if(p==='/api/community/state')return {profile};
 if(p==='/api/payments/shop/quote')return {items:[product],totalCents:998,balanceCents:100};
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
   await p.addInitScript(data=>{if(!localStorage.getItem('mirpanel.cart.v1'))localStorage.setItem('mirpanel.cart.v1',JSON.stringify(data));},cart);
   const heading=p.getByRole('heading',{name:'Ödəniş',exact:true});
   const onScreen=()=>heading.evaluate(n=>{const r=n.getBoundingClientRect(),h=document.querySelector('.site-header').getBoundingClientRect();return r.top>=h.bottom-1&&r.bottom<innerHeight-72;});
   const waitAligned=()=>p.waitForFunction(()=>{const n=[...document.querySelectorAll('.checkout-choices h2')].find(x=>x.textContent==='Ödəniş');if(!n)return false;const r=n.getBoundingClientRect(),h=document.querySelector('.site-header').getBoundingClientRect();return r.top>=h.bottom-1&&r.bottom<innerHeight-72;});
   await p.goto(origin+'/odenis');
   await p.locator('.checkout-methods').waitFor();
   const direct=await onScreen();
   if(before&&mobile)assert(!direct);
   if(!before&&mobile)await waitAligned();
   await p.goto(origin+'/sebet');
   const payments=p.locator('.browser-bottom-nav [data-browser-nav=payments]');
   await payments.waitFor({state:'attached'});
   const previousHref=await payments.getAttribute('href');
   if(before){assert.equal(previousHref,'/balans#emeliyyatlar');console.log(JSON.stringify({engine:engine.name(),width,directPaymentHeadingVisible:direct,paymentsDestination:previousHref}));continue;}
   const stored=await p.evaluate(()=>MirpanelCart.read());
   await p.getByRole('button',{name:'Ödənişə keç',exact:true}).click();
   if(mobile){await p.getByText('Ödəniş üsulları hazırlanır…',{exact:true}).waitFor();await waitAligned();}
   await p.locator('.checkout-methods').waitFor();
   if(mobile)await waitAligned();
   else assert(await p.locator('.shop-checkout-grid').evaluate(n=>{const [a,b]=n.children;return b.offsetLeft>a.offsetLeft&&Math.abs(a.offsetTop-b.offsetTop)<2;}));
   const complete=p.getByRole('button',{name:/Sifarişi tamamla/});
   assert(await complete.isDisabled());
   await p.locator('.checkout-consent input').check();
   await p.getByRole('radio',{name:/^Balans/}).check();
   await p.getByText('1,00 ₼ var, 8,98 ₼ çatmır.').waitFor();
   assert(await complete.isDisabled());
   await p.getByRole('radio',{name:/Kartdan karta/}).check();
   assert(await complete.isEnabled());
   if(mobile){
    await payments.click();
    await p.waitForURL('**/profil?tab=payments');
    await p.locator('.account-payments').waitFor();
    assert.equal(await p.locator('#shopApp').count(),0);
    assert.equal(await payments.getAttribute('aria-current'),'page');
    await p.goBack({waitUntil:'commit'});
    await p.waitForURL('**/sebet?checkout=1');
    await p.locator('.checkout-methods').waitFor();await waitAligned();
    await p.goto(origin+'/profil?tab=payments');
    await p.locator('.account-payments').waitFor();
    await p.locator('.browser-bottom-nav [data-browser-nav=cart]').click();
    await p.locator('.mir-cart-next:not(:disabled)').click();
    await p.waitForURL('**/odenis');
    await p.locator('.checkout-methods').waitFor();await waitAligned();
    await p.goBack({waitUntil:'commit'});
    await p.waitForURL('**/profil?tab=payments');
    await p.locator('.account-payments').waitFor();
   }
   assert.deepEqual(await p.evaluate(()=>MirpanelCart.read()),stored);
   assert.equal(await p.evaluate(id=>fetch('/api/payments/shop/draft?id='+id).then(r=>r.json()).then(r=>r.values.pin),draftId),'0012');
   console.log(JSON.stringify({engine:engine.name(),width,liveAssets:live,heading:true,paymentsHistory:mobile,browserBack:mobile,drawer:mobile,cartPreserved:true,desktopColumns:!mobile}));
  }finally{await browser.close();}
 }
 assert.equal(writes,0);
}finally{await new Promise(r=>server.close(r));}
