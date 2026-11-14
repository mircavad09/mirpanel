// Fixed, isolated responses: no customer credentials, orders or uploads.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const before=process.argv.includes('--before'),live=process.argv.includes('--live-assets'),results=[];
const files=new Map();
async function asset(p){
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(!files.has(file)){
  let body=before?execFileSync('git',['show','655dcd5:'+file]):await fs.readFile(file);
  if(live){const r=await fetch('https://mirpanel.com'+p+'?v=customer-perf-1');assert(r.ok);const deployed=await r.text();assert.equal(deployed.replaceAll('\r\n','\n'),body.toString().replaceAll('\r\n','\n'),file);body=deployed;}
  files.set(file,body);
 }return files.get(file);
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Exclude reading a Git revision from the browser timing in BOTH variants.
for(const path of ['/customer-pricing.js','/catalog-listing.js','/page-navigation.js','/request-lifecycle.mjs','/checkout-sounds.js','/community-assets/topup-amount.js','/community-assets/shop-ui.js'])await asset(path);
for(const [engine,width] of [[chromium,390],[chromium,1440],[webkit,390]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
 const ctx=await browser.newContext({viewport:{width,height:850}}),p=await ctx.newPage();
 let prices=[{productId:'fixture',planIndex:0,cents:400,standardCents:500}],priceOwner='synthetic-a',priceFailure=false,stockCalls=0,walletModules=0;
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await ctx.route('https://performance.test/**',async route=>{
  const u=new URL(route.request().url());
  if(['/balans','/sebet'].includes(u.pathname))return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width"><div id="shopApp"></div><script type="module">import {mountShop} from "/community-assets/shop-ui.js?v=shell-test";mountShop();</script>'});
  if(u.pathname==='/pricing')return route.fulfill({contentType:'text/html',body:'<div id="grid"></div><script>const DATA={products:[{id:"fixture",plans:[{price:5}]}]};window.renders=0;window.events=0;function renderGrid(){renders++};window.addEventListener("mirpanel:prices",()=>events++);</script><script src="/customer-pricing.js"></script>'});
  if(u.pathname==='/mehsul')return route.fulfill({contentType:'text/html',body:`<div class="catalog-grid"><article class="card" data-product-id="fixture"><div class="pad"><button class="homeCardAdd"></button><span data-home-sales-id="fixture"></span></div></article></div><script type="application/json" id="catalogCartProducts">[{"id":"fixture","plans":[{"price":5}]}]</script><script>AbortSignal.any=undefined;AbortSignal.timeout=undefined;</script><script src="/catalog-listing.js"></script>`});
  if(u.pathname==='/cart-ready.js')return route.fulfill({contentType:'text/javascript',body:'window.MirpanelCart={read:()=>[],checkout:()=>[]};export async function ensureCart(){}'});
  if(u.pathname==='/session-state.js')return route.fulfill({contentType:'text/javascript',body:'export async function getCommunityState(){await new Promise(r=>setTimeout(r,2500));return {ok:true,data:{profile:{user_id:"synthetic-a"}}};}'});
  if(u.pathname==='/community-assets/wallet-topup.js'){walletModules++;await delay(300);return route.fulfill({contentType:'text/javascript',body:'export const topupReviewTime="5–10 dəqiqə";export function createWalletTopup({profile}){window.draftOwner=profile.user_id;return {element:document.createElement("section"),updateAmount(){},resume(){}}}'});}
  if(u.pathname==='/api/payments/shop/wallet'){await delay(200);return route.fulfill({json:{accountId:'synthetic-a',cents:1234,items:[],topups:[]}});}
  if(u.pathname==='/api/payments/shop/prices'){await delay(40);return route.fulfill({status:priceFailure?503:200,json:{accountId:priceOwner,prices}});}
  if(u.pathname==='/api/payments/inventory'){stockCalls++;return route.fulfill({json:{products:[{productId:'fixture',scope:'product',available:5,canOrder:true,plans:[]}]}});}
  if(/\.(js|mjs)$/.test(u.pathname))return route.fulfill({contentType:'text/javascript',body:await asset(u.pathname)});
  return route.fulfill({status:204,body:''});
 });
 await p.goto('https://performance.test/sebet');await p.locator('.shop-empty').waitFor();
 const cartMs=Math.round(await p.evaluate(()=>performance.now())),cartWalletModules=walletModules;
 if(!before)assert.equal(cartWalletModules,0,'cart cannot wait for the unused receipt-form module');
 await p.goto('https://performance.test/balans');await p.locator('.shop-presets button').first().waitFor();
 const walletMs=Math.round(await p.evaluate(()=>performance.now()));assert.equal(await p.evaluate(()=>draftOwner),'synthetic-a');
 if(!before)assert(walletMs<1800,'wallet must not wait for unrelated 2.5s session request');
 await p.goto('https://performance.test/pricing');await p.waitForFunction(()=>window.MirpanelPricing);await p.evaluate(()=>MirpanelPricing.refresh());
 const initial=await p.evaluate(()=>({renders,events}));await p.evaluate(()=>MirpanelPricing.refresh());
 const repeat=await p.evaluate(()=>({renders,events}));
 if(!before)assert.deepEqual(repeat,initial,'unchanged prices cannot rebuild cards or requote checkout');
 prices=[{...prices[0],cents:350}];await p.evaluate(()=>MirpanelPricing.refresh());assert.equal(await p.evaluate(()=>DATA.products[0].plans[0].price),3.5);
 priceFailure=true;await p.evaluate(()=>MirpanelPricing.refresh());if(!before)assert.equal(await p.evaluate(()=>DATA.products[0].plans[0].price),3.5,'transient errors must retain this account’s confirmed price');priceFailure=false;
 // A known account switch clears private prices immediately, before any reply.
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'synthetic-b'}})));
 assert.equal(await p.evaluate(()=>DATA.products[0].plans[0].price),5);priceOwner='synthetic-b';prices=[];await p.evaluate(()=>MirpanelPricing.refresh());
 await p.goto('https://performance.test/mehsul');await p.waitForTimeout(250);
 const stockPainted=await p.locator('.cardStockLine').count();const firstCalls=stockCalls;
 await p.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(250);
 if(!before){assert.equal(stockPainted,1,'inventory must work without AbortSignal.any/timeout');assert.equal(stockCalls,firstCalls,'focus and visibility must reuse the loaded catalog');}
 if(!before)assert.deepEqual(errors,[]);
 results.push({engine:engine.name(),width,walletMs,cartMs,cartWalletModules,unchangedPriceRebuilds:repeat.renders-initial.renders,unchangedPriceEvents:repeat.events-initial.events,stockPainted,stockCalls,errors});
 console.log(JSON.stringify(results.at(-1)));
 let cssReads=0;
 await ctx.route('https://navigation.test/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/'||u.pathname==='/mehsul')return route.fulfill({contentType:'text/html',body:`<!doctype html><head><link rel="stylesheet" href="/${u.pathname==='/'?'home':'listing'}.css"></head><body><main class="${u.pathname==='/mehsul'?'catalog-grid':''}"><h1>${u.pathname==='/'?'Home':'Catalog'}</h1></main><script src="/page-navigation.js"></script></body>`,headers:{'Cache-Control':'no-store'}});
  if(u.pathname.endsWith('.css')){cssReads++;await delay(200);return route.fulfill({contentType:'text/css',body:'main{color:rgb(100,100,100)}',headers:{'Cache-Control':'no-store'}});}
  if(u.pathname==='/page-navigation.js')return route.fulfill({contentType:'text/javascript',body:await asset(u.pathname)});
  return route.fulfill({contentType:'text/javascript',body:''});
 });
 await p.goto('https://navigation.test/');await p.waitForFunction(()=>window.MirpanelNavigation);
 await p.evaluate(()=>MirpanelNavigation.go('/mehsul'));await p.evaluate(()=>MirpanelNavigation.go('/'));
 const reads=cssReads,at=performance.now();await p.evaluate(()=>MirpanelNavigation.go('/mehsul'));
 const returnMs=Math.round(performance.now()-at),extraReads=cssReads-reads;
 if(!before)assert.equal(extraReads,0,'return navigation must reuse parsed route styles');
 results.at(-1).routeReturn={ms:returnMs,cssReloads:extraReads};console.log(JSON.stringify({engine:engine.name(),width,routeReturn:results.at(-1).routeReturn}));await ctx.close();
 }finally{await browser.close();}
}
await fs.mkdir('outputs/customer-performance',{recursive:true});await fs.writeFile(`outputs/customer-performance/${before?'before':live?'live':'after'}-isolated.json`,JSON.stringify({results,productionMutations:0},null,2));
