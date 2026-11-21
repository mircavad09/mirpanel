import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';import {createShop} from '../mirpanel-admin/shop.mjs';import {handleShop} from '../mirpanel-admin/shop-http.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';import {termsInfo} from '../mirpanel-admin/cart-drafts.mjs';import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture();let browser,server;
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),receiptsBucket:'synthetic',whatsappPhone:'994514113545'},security=createPaymentSecurity(config);
const source=fs.readFileSync('app.js','utf8'),state=extractAdminState(source),prime=state.products.find(p=>p.id==='prime');
assert.equal(prime.confirmationModal.enabled,false);assert.equal(extractAdminState(patchAppSource(source,state)).products.find(p=>p.id==='prime').confirmationModal.enabled,false);
f.catalog.products=[{id:'prime',title:'Amazon Prime Video',active:true,formFields:[],plans:[{price:5,months:1,label:'1 ay'}],confirmationModal:{enabled:false,description:'Sintetik Amazon xəbərdarlığı'}},
 {id:'capcut',title:'CapCut Pro',active:true,formFields:[],plans:[{price:5,months:1,label:'1 ay'}],confirmationModal:{enabled:true,description:'Sintetik CapCut xəbərdarlığı'}},
 {id:'spotify',title:'Spotify Premium',active:true,plans:[{price:5,months:1,label:'1 ay'}],confirmationModal:{enabled:true,description:'Sintetik Spotify xəbərdarlığı'},formFields:[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}]}];
const shop=createShop({context:async()=>({pool:f.pool,user:'a'}),catalog:async()=>f.catalog,snapshot:()=>f.rpc('inventory_snapshot'),store:f.store,config});
const json=(req,res,status,d)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(d));};
const body=async req=>{let s='';for await(const b of req)s+=b;return JSON.parse(s);};
const out='outputs/confirmation-toggle';fs.mkdirSync(out,{recursive:true});
try{
 await f.pool.query("insert into wallet_accounts(user_id,cents) values('a',10000) on conflict(user_id) do update set cents=excluded.cents");
 // This presentation flag must not rewrite historical terms/drafts.
 const p=f.catalog.products[0],v=termsInfo(p,p.plans[0],0).termsVersion;p.confirmationModal.enabled=true;assert.equal(termsInfo(p,p.plans[0],0).termsVersion,v);p.confirmationModal.enabled=false;
 const item={productId:'prime',planIndex:0,quantity:1};
 await assert.rejects(shop.checkout({},'a'.repeat(64),{items:[item],mode:'wallet',requestId:f.id(),consentAccepted:false}),{status:400});
 server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://local');
   if(u.pathname.startsWith('/api/payments/shop/'))return handleShop({req,res,url:u,shop,browserOrders:{ensure:()=> 'a'.repeat(64)},security,readBody:body,config,store:f.store,json,rate:async()=>{}});
   if(u.pathname==='/api/community/state')return json(req,res,200,{profile:{id:'a',display_name:'Sintetik alıcı',balanceCents:10000}});
   if(u.pathname==='/api/payments/epoint/status')return json(req,res,200,{enabled:false,methods:{}});
   if(u.pathname==='/api/payments/methods')return json(req,res,200,{methods:[]});
   if(u.pathname==='/odenis'||u.pathname==='/sebet'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><meta name="viewport" content="width=device-width"><main id="shopApp"></main><script type="module" src="/community-assets/shop-ui.js"></script>');}
   if(u.pathname==='/'||u.pathname==='/mehsul/amazon-prime-video'){
    const data=structuredClone(f.catalog),id=u.searchParams.get('p')||'prime';if(u.searchParams.has('stale'))data.products.find(x=>x.id===id).confirmationModal.enabled=!data.products.find(x=>x.id===id).confirmationModal.enabled;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><style>body{background:#151719;color:#eee;font:16px system-ui}#modal:not(.show){display:none}</style><body class="${u.pathname==='/'?'home-page':''}"><div id="homePageView"><div id="grid"><article data-product-id="${id}"><button class="homeCardAdd">+</button></article></div></div><button id="pp-order-btn">İndi al</button><div id="modal"><div class="modalCard"><h1 id="mTitle"></h1><div id="mInfo"></div><div id="mForm"></div></div></div><script>const DATA=${JSON.stringify(data)};let currentProduct=DATA.products.find(x=>x.id===${JSON.stringify(id)}),currentPlanIdx=0;function lockBodyScroll(){};window.MirpanelInventory={refresh:async()=>true,productState:p=>({canOrder:true,plans:p.plans.map(()=>({canOrder:true}))}),planState:()=>({canOrder:true})};</script><script src="/cart-store.js"></script><script src="/order-confirmation.js"></script>`);
   }
   const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
   if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
   res.writeHead(200,{'Content-Type':file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/png'});res.end(fs.readFileSync(file));
  }catch(e){json(req,res,e.status||503,{error:e.message});}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [390,1440])for(const id of ['prime','capcut','spotify'])for(const enabled of [false,true])for(const route of ['home','product']){
  const product=f.catalog.products.find(p=>p.id===id);product.confirmationModal.enabled=enabled;
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=origin+(route==='home'?'/':'/mehsul/amazon-prime-video')+'?p='+id+(id==='prime'?'&stale=1':'');
  await page.goto(url);await page.reload();
  await page.evaluate(()=>{sessionStorage.setItem('warningSeen','false');new MutationObserver(()=>{if(document.querySelector('.cart-entry-warning'))sessionStorage.setItem('warningSeen','true');}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});});
  await page.locator(route==='home'?'.homeCardAdd':'#pp-order-btn').click();
  if(enabled){const warning=page.locator('dialog.cart-entry-warning[open]');await warning.waitFor();assert(await warning.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).isDisabled());await warning.getByRole('checkbox').check();await warning.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();}
  if(id==='spotify'){
   const form=page.locator('.cart-entry-fields');await form.waitFor();await form.locator('button[type=submit]').click();assert.equal(await page.locator('.mir-cart-drawer[open]').count(),0);
   await form.locator('input[type=email]').fill('synthetic@example.test');await form.locator('input[type=password]').fill('Synthetic-secret');await form.locator('button[type=submit]').click();
  }
  try{await page.locator('.mir-cart-drawer[open]').waitFor({timeout:15000});}catch(e){console.log(JSON.stringify({width,id,enabled,route,errors,text:await page.locator('body').innerText()}));throw e;}assert.equal(await page.evaluate(()=>sessionStorage.getItem('warningSeen')==='true'),enabled);
  await page.screenshot({path:out+'/'+id+'-'+enabled+'-'+route+'-'+width+'.png'});
  if(id==='spotify'){
   await page.locator('.mir-cart-drawer').getByRole('button',{name:'Məlumatları redaktə et',exact:true}).click();await page.locator('.cart-entry-fields').waitFor();assert.equal(await page.locator('.cart-entry-warning').count(),0);await page.locator('.cart-entry-fields button[type=submit]').click();await page.locator('.mir-cart-drawer[open]').waitFor();
  }
  // Final payment consent is independent and remains required even with warning off.
  await page.goto(origin+'/odenis');await page.locator('.checkout-consent input[type=checkbox]').waitFor();assert.equal(await page.locator('.checkout-consent input[type=checkbox]').isChecked(),false);
  await ctx.close();console.log('PASS '+width+' '+id+' '+enabled+' '+route+' + reload/cart/final consent');
 }
 assert.equal((await f.pool.query("select count(*)::int n from payment_orders")).rows[0].n,0);
 console.log('PASS no orders/payments created; false preserved through admin serialization and server quote; terms hash unchanged');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
