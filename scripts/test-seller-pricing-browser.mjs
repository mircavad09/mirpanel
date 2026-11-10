import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {shopFixture} from './shop-test-fixture.mjs';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles,generateProductListingPageFiles,productSeoSlug} from '../mirpanel-admin/product-pages.mjs';
import {saveUserControls,userControls,catalogPlans} from '../mirpanel-admin/community/user-controls.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
const f=await shopFixture(),state=extractAdminState(fs.readFileSync('app.js','utf8'));
f.catalog.products=state.products;
await f.pool.query("insert into wallet_accounts(user_id,cents) values('a',10000),('b',10000)");
const capcut=state.products.find(p=>p.id==='capcut');capcut.plans.forEach((p,i)=>p.price=i?9:5);
const syntheticApp=patchAppSource(fs.readFileSync('app.js','utf8'),state);
const plan=catalogPlans(f.catalog).find(p=>p.productId==='capcut');
await f.pool.query('insert into "user"(id,name,email,"emailVerified") values(\'c\',\'Ordinary\',\'c@example.test\',true)');
for(const [user,amount]of [['a','3'],['b','3.50']]){await saveUserControls(f.pool,{id:'owner'},{userId:user,kind:'seller',enabled:true},f.catalog);await saveUserControls(f.pool,{id:'owner'},{userId:user,kind:'price',productId:plan.productId,planKey:plan.planKey,amount},f.catalog);}
const pages=new Map([...generateProductPageFiles(state.products,state.siteSections,state.cms,state.content),...generateProductListingPageFiles(state.products,state.siteSections,state.cms)].map(([file,html])=>['/'+file.replace(/\.page$/,''),html]));
const out='payment-test-artifacts/seller-pricing';fs.mkdirSync(out,{recursive:true});
let delayNext=false;
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local'),user=req.headers.cookie?.match(/synthetic=([abc])/i)?.[1]??null;
 const json=v=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','private,no-store');res.end(JSON.stringify(v));};
 if(u.pathname==='/api/payments/shop/prices'){const data=await f.shop.prices({user});if(delayNext){delayNext=false;await new Promise(r=>setTimeout(r,400));}return json(data);}
 if(u.pathname==='/api/payments/shop/quote'){let raw='';for await(const b of req)raw+=b;return json(await f.shop.quote({user},JSON.parse(raw).items,'a'.repeat(64)));}
 if(u.pathname==='/odenis'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/shop.css"><main id="shopApp" class="shop-page"></main><script type="module">import {mountShop} from "/community-assets/shop-ui.js";mountShop();</script>');}
 if(u.pathname==='/api/community/state')return json({profile:user?{user_id:user,emailVerified:true,display_name:'Synthetic',balanceCents:10000}:null});
 if(u.pathname==='/test-controls'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/mirpanel-admin/public/admin.css"><main id="controls" class="panel" style="max-width:900px;margin:20px auto;padding:16px"></main>');}
 if(u.pathname==='/test-api/user-controls'){
  if(req.method==='POST'){let raw='';for await(const b of req)raw+=b;return json(await saveUserControls(f.pool,{id:'owner'},JSON.parse(raw),f.catalog));}
  return json(await userControls(f.pool,null,u.searchParams.get('userId'),f.catalog));
 }
 if(pages.has(u.pathname)){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(pages.get(u.pathname));}
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice('/community-assets/'.length):u.pathname==='/'?'index.html':u.pathname.slice(1);if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(file==='app.js'?syntheticApp:fs.readFileSync(file));
 }catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.message}));}});
let checks=0,browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 for(const [engine,type]of [['chrome',chromium],['webkit',webkit]]){
  browser=await type.launch({headless:true,...(engine==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:900}});await ctx.addCookies([{name:'synthetic',value:'a',url:base}]);
   await ctx.route('**/*',r=>{const u=new URL(r.request().url());
    if(u.pathname==='/api/payments/inventory')return r.fulfill({json:{products:state.products.map(p=>inventoryAvailability(p,{scope:'product',unlimited:true}))}});
    if(u.pathname==='/api/product-sales')return r.fulfill({json:{productId:u.searchParams.get('productId'),initialized:true,productTotal:1234}});
    if(u.pathname.startsWith('/api/')&&!['/api/payments/shop/prices','/api/payments/shop/quote','/api/community/state'].includes(u.pathname))return r.fulfill({json:{}});
    if(u.origin!==base)return r.fulfill({body:''});return r.continue();});
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>{console.log('PAGEERROR',engine,width,e.stack);errors.push(e.message);});
   await p.goto(base+'/mehsul/'+productSeoSlug(capcut));
   await p.waitForFunction(()=>document.querySelector('.pp-plan-label .pp-new-price')?.textContent.includes('3,00'));
   assert.match(await p.locator('.product-detail-summary').innerText(),/3,00/);checks++;
   if(engine==='chrome')await p.screenshot({path:out+'/seller-product-'+width+'.png',fullPage:false});
   for(const [user,expected]of [['b','3,50'],['c','5,00'],['a','3,00']]){
    await ctx.addCookies([{name:'synthetic',value:user,url:base}]);await p.evaluate(user=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:user}})),user);
    await p.waitForFunction(expected=>document.querySelector('.pp-plan-label .pp-new-price')?.textContent.includes(expected),expected);checks++;
   }
   // Reject a delayed response from the preceding account.
   delayNext=true;const old=p.evaluate(()=>MirpanelPricing.refresh());await p.waitForTimeout(50);
   await ctx.addCookies([{name:'synthetic',value:'b',url:base}]);await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'b'}})));await old;await p.waitForTimeout(450);
   assert.match(await p.locator('.pp-plan-label .pp-new-price').first().innerText(),/3,50/);checks++;
   await p.goto(base+'/mehsul');await p.waitForFunction(()=>document.querySelector('[data-product-id="capcut"] .homeCardPrices strong')?.textContent.includes('3.50'));checks++;
   await p.goto(base+'/');await p.waitForFunction(()=>document.querySelector('[data-product-id="capcut"] .homeCardPrices strong')?.textContent.includes('3.50'));checks++;
   await ctx.clearCookies();await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null})));await p.waitForFunction(()=>document.querySelector('[data-product-id="capcut"] .homeCardPrices strong')?.textContent.includes('5.00'));checks++;
   assert.equal(await p.evaluate(()=>JSON.stringify(localStorage).includes('"unitCents":350')),false);checks++;
   await p.waitForLoadState('networkidle');
   await ctx.addCookies([{name:'synthetic',value:'a',url:base}]);
   await p.evaluate(()=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'capcut',planIndex:0,quantity:1}])));
   await p.goto(base+'/odenis');await p.waitForFunction(()=>document.querySelector('.checkout-amount strong')?.textContent.includes('3,00'));checks++;
   await ctx.addCookies([{name:'synthetic',value:'b',url:base}]);await p.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'b',emailVerified:true}})));await p.waitForFunction(()=>document.querySelector('.checkout-amount strong')?.textContent.includes('3,50'));checks++;
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.v1')).length),1);checks++;
   await p.waitForLoadState('networkidle');
   await p.goto(base+'/test-controls');await p.evaluate(async()=>{const {renderControlsTab}=await import('/mirpanel-admin/public/admin-user-controls.js');const call=async(path,body)=>{const r=await fetch('/test-api'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};window.draw=()=>renderControlsTab({content:document.getElementById('controls'),tab:'prices',selected:{user:{id:'a'}},call,valid:()=>true});await window.draw();});
   await p.getByLabel('Məhsul',{exact:true}).selectOption('capcut');assert.equal(await p.getByLabel('İstifadəçinin qiyməti (₼)',{exact:true}).inputValue(),'3.00');checks++;
   await p.getByLabel('İstifadəçinin qiyməti (₼)',{exact:true}).fill('3,10');await p.getByRole('button',{name:'Qiyməti saxla',exact:true}).click();await p.waitForFunction(()=>document.getElementById('controls').textContent.includes('3,10 \u20bc'));checks++;
   await p.evaluate(()=>window.draw());assert.match(await p.locator('#controls').innerText(),/3,10 \u20bc/);checks++;
   await p.getByRole('button',{name:'Redaktə et'}).click();await p.getByLabel('İstifadəçinin qiyməti (₼)',{exact:true}).fill('3.00');await p.getByRole('button',{name:'Qiyməti saxla',exact:true}).click();await p.waitForFunction(()=>document.getElementById('controls').textContent.includes('3,00 \u20bc'));
   if(engine==='chrome')await p.screenshot({path:out+'/seller-admin-'+width+'.png',fullPage:true});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile fit');checks++;
   assert.deepEqual(errors,[]);checks++;await ctx.close();
  }
  await browser.close();browser=null;
 }
 console.log(JSON.stringify({checks,failures:0,engines:['Chrome','WebKit'],widths:[390,1280],accountIsolation:true,lateResponseDiscarded:true,adminSaveReload:true,productionWrites:0}));
}finally{await browser?.close();await new Promise(r=>server.close(r));await f.close();}
