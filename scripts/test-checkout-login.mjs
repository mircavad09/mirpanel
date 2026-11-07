import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';import {createShop} from '../mirpanel-admin/shop.mjs';import {handleShop} from '../mirpanel-admin/shop-http.mjs';import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';import {createBrowserOrders} from '../mirpanel-admin/browser-orders.mjs';import {authFormPolicy,registrationDetails} from '../mirpanel-admin/community/auth-form-policy.mjs';import {authReturn} from '../mirpanel-admin/community/public-service.mjs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {receiptFixture} from './receipt-gate-fixture.mjs';import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,catalog,method,id}=f;let browser,server,checks=0,signupCallback='',pendingEmail='';const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const config={encryptionKey:Buffer.alloc(32,7).toString('base64'),tokenSecret:Buffer.alloc(32,9).toString('base64'),receiptsBucket:'synthetic-private'},security=createPaymentSecurity(config),browserOrders=createBrowserOrders({security,store:f.store,enabled:true});
const signed=req=>/synthetic_account=([ab])/.exec(req.headers.cookie||'')?.[1]||null,profile=uid=>uid?{user_id:uid,id:uid,display_name:'Sintetik İstifadəçi',email:uid+'@example.invalid',avatar:0,balanceCents:0}:null;
const shopStore={...f.store,rawMethod:async id=>({...await f.store.rawMethod(id),encrypted_number:security.encryptNumber('4000000000001234')})};
const shop=createShop({context:async req=>({pool,user:signed(req)}),catalog:async()=>catalog,snapshot:()=>f.rpc('inventory_snapshot'),store:shopStore,config});
catalog.products[0].image='/assets/capcut.png';
catalog.products.push({id:'netflix',title:'Netflix Şəxsi — Mobil və masaüstü cihazlar üçün uzun məhsul adı',image:'/assets/netflix.png',active:true,plans:[{label:'1 aylıq',price:5.99,formFields:[{key:'name',label:'Otaq adı',required:true},{key:'pin',label:'Otaq kodu',digits:4,required:true}]}]});
catalog.products.push({id:'hbomax',title:'HBO Max',active:true,plans:[{label:'1 aylıq',price:5.99,terms:'HBO Max — sintetik xəbərdarlıq',formFields:[{key:'name',label:'HBO Max profil adı',required:true},{key:'code_4',label:'Profil kodu / PIN',digits:4,required:true}]}]});
const hboButton=fs.readFileSync('mehsul/hbo-max.page','utf8').match(/<button[^>]*id="pp-order-btn"[^>]*>[^<]*<\/button>/)[0];
const header=fs.readFileSync('customer-header.html','utf8'),json=(res,status,d)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private,no-store'});res.end(JSON.stringify(d));},body=async req=>{let s='';for await(const x of req)s+=x;return JSON.parse(s||'{}');};
try{
 const owner='f'.repeat(64),req={headers:{}},q=await shop.quote(req,[{productId:'ordinary',planIndex:0,quantity:1}],owner),saved=await shop.saveDraft(req,owner,{id:id(),productId:'ordinary',planIndex:0,values:{},termsVersion:q.items[0].termsVersion}),args={items:[{productId:'ordinary',planIndex:0,quantity:1,...saved}],mode:'card',methodId:method,requestId:id(),consentAccepted:true};
 for(const mode of ['card','wallet']){await assert.rejects(shop.checkout(req,owner,{...args,mode}),e=>e.status===401);checks++;}eq((await pool.query('select count(*)::int n from payment_reservations')).rows[0].n,0);
 const paid=await shop.checkout({headers:{cookie:'synthetic_account=a'}},owner,args);eq(paid.state,'reserved');await shop.cancel({headers:{cookie:'synthetic_account=a'}},owner,paid.id);
 const legacy=await receiptFixture({createSystem:o=>createPaymentSystem({...o,accountForCheckout:async()=>null})});try{for(const route of ['reservations','orders']){const r=await fetch(legacy.origin+'/api/payments/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});eq(r.status,401);eq((await r.json()).code,'CHECKOUT_LOGIN_REQUIRED');}}finally{await new Promise(r=>legacy.server.close(r));}
 const historical=await shop.checkout({headers:{cookie:'synthetic_account=a'}},owner,{...args,requestId:id()}),receipt={path:'cart/'+historical.id+'/synthetic.png',mimeType:'image/png',size:3,sha256:crypto.createHash('sha256').update('abc').digest('hex')};f.files.set(receipt.path,Buffer.from('abc'));await shop.savedReceipt({headers:{cookie:'synthetic_account=a'}},owner,'cart',historical.id,receipt);const order=await shop.submit({headers:{cookie:'synthetic_account=a'}},owner,historical.id);await pool.query('update shop_checkouts set user_id=null where id=$1',[historical.id]);eq((await shop.get(req,owner,historical.id)).orderId,order.orderId);eq((await shop.submit(req,owner,historical.id)).orderId,order.orderId);
 server=http.createServer(async(req,res)=>{try{const origin='http://127.0.0.1:'+server.address().port,u=new URL(req.url,origin),uid=signed(req);
  if(u.pathname.startsWith('/api/payments/shop/'))return await handleShop({req,res,url:u,shop,browserOrders,security,readBody:body,readRawBody:body,validateFile:async()=>{},store:f.store,config,json:(req,res,status,d)=>json(res,status,d),rate:async()=>{}});
  if(u.pathname==='/api/community/state')return json(res,200,{profile:profile(uid),authFormPolicy,googleEnabled:true,publicCommunity:true});
  if(u.pathname==='/api/community/notifications')return json(res,200,{items:[],unread:0});
  if(u.pathname==='/api/payments/methods')return json(res,200,{methods:[{id:method,available:true,displayName:'Synthetic ABB',providerName:'ABB',last4:'1234'}]});
  if(u.pathname==='/api/payments/storefront')return json(res,200,{completedOrders:283,banks:['abb','m10','kapital'],products:[{id:'offer',title:'Sintetik təklif',path:'/mehsul/synthetic',category:'film',priceCents:499}]});
  if(u.pathname==='/api/auth/sign-in/email'){const b=await body(req);assert.equal(b.email,'a@example.invalid');res.setHeader('Set-Cookie','synthetic_account=a; Path=/; HttpOnly; SameSite=Lax');return json(res,200,{ok:true});}
  if(u.pathname==='/api/auth/sign-up/email'){const b=await body(req);registrationDetails(b);signupCallback=authReturn(origin,b.callbackURL);return json(res,200,{user:{id:'synthetic-new',email:b.email}});}
  if(u.pathname==='/api/auth/confirm-email/status'){const email=pendingEmail;pendingEmail='';return json(res,200,{email});}
  if(u.pathname==='/api/auth/confirm-email/start'){const b=await body(req);pendingEmail=b.email;return json(res,200,{email:b.email});}
  if(u.pathname==='/api/auth/confirm-email/send')return json(res,200,{email:'b@example.invalid',codeSent:true,retryAfter:60});
  if(u.pathname==='/api/auth/confirm-email/verify'){eq((await body(req)).code,'001234');res.setHeader('Set-Cookie','synthetic_account=b; Path=/; HttpOnly; SameSite=Lax');return json(res,200,{verified:true});}
  if(u.pathname==='/api/auth/sign-out'){res.setHeader('Set-Cookie','synthetic_account=; Path=/; Max-Age=0');return json(res,200,{ok:true});}
  if(u.pathname==='/api/auth/sign-in/social'){const b=await body(req);eq(authReturn(origin,b.callbackURL),origin+'/sebet');return json(res,200,{url:origin+'/synthetic-google'});}
  if(u.pathname==='/synthetic-google'){res.writeHead(302,{'Set-Cookie':'synthetic_account=a; Path=/; HttpOnly; SameSite=Lax',Location:'/sebet'});return res.end();}
  if(['/','/mehsul','/odenis','/balans','/sebet','/sifarislerim','/profil','/qrup','/hesab','/mehsul/synthetic'].includes(u.pathname)){
   const isAuth=u.pathname==='/hesab',isShop=['/odenis','/balans','/sebet'].includes(u.pathname);let main='<main><h1>Sintetik səhifə</h1></main>';
   if(isAuth)main='<main id="communityApp" class="community-shell"></main><script type="module" src="/community-assets/community.js"></script>';
   if(isShop)main='<main id="shopApp" class="shop-page"></main><link rel="stylesheet" href="/community-assets/shop.css"><script type="module" src="/community-assets/shop-ui.js"></script>';
   if(u.pathname==='/mehsul')main='<main><a href="/mehsul/synthetic?product=hbomax">HBO Max</a></main>';
   if(u.pathname==='/mehsul/synthetic'){const hbo=u.searchParams.get('product')==='hbomax';main=`<main><h1>${hbo?'HBO Max':'Netflix Şəxsi'}</h1>${hbo?hboButton:'<button id="pp-order-btn">Sifariş et</button>'}</main><script>const DATA=${JSON.stringify(catalog)};let currentProduct=DATA.products.find(p=>p.id===${JSON.stringify(u.searchParams.get('product')||'netflix')}),currentPlanIdx=0;</script><script src="/order-confirmation.js"></script>${hbo?'<script>const order=document.getElementById("pp-order-btn");order.disabled=false;order.textContent="Sifariş et";</script>':''}`;}
   res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/community.css"><body class="community-page">'+header+main+'<script src="/site-header.js"></script></body></html>');
  }
  const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 }catch(e){json(res,e.status||500,{error:e.status?e.message:'Synthetic error'});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});fs.mkdirSync('payment-test-artifacts/checkout-login',{recursive:true});
 for(const [width,fromList] of [[390,false],[1440,true]]){
  const ctx=await browser.newContext({viewport:{width,height:850}}),p=await ctx.newPage();
  let unblockBootstrap,unblockModule,unblockQuote,draftCalls=0,quoteCalls=0;
  const bootstrap=new Promise(r=>{unblockBootstrap=r;}),moduleGate=new Promise(r=>{unblockModule=r;}),quoteGate=new Promise(r=>{unblockQuote=r;});
  await p.route('**/order-confirmation.js',async r=>{await bootstrap;await r.continue();});
  await p.route('**/community-assets/cart-entry.js?v=checkout-sounds-20261108*',async r=>{await moduleGate;await r.continue();});
  await p.route('**/api/payments/shop/quote',async r=>{if(++quoteCalls===1){await quoteGate;return r.fulfill({status:503,contentType:'application/json',body:'{}'});}await r.continue();});
  await p.route('**/api/payments/shop/draft',async r=>{draftCalls++;await r.continue();});
  if(fromList){await p.goto(origin+'/mehsul');await p.getByRole('link',{name:'HBO Max'}).click({noWaitAfter:true});}
  else await p.goto(origin+'/mehsul/synthetic?product=hbomax',{waitUntil:'commit'});
  const order=p.locator('#pp-order-btn');await order.waitFor({state:'visible'});eq(await order.isDisabled(),true);
  unblockBootstrap();await p.locator('#pp-order-btn:not([disabled])').waitFor({state:'visible'});
  await order.evaluate(b=>{b.click();b.click();});const dialog=p.locator('dialog.cart-entry[open]');
  await dialog.getByRole('heading',{name:'Diqqət!'}).waitFor();eq(await dialog.count(),1);
  eq(await dialog.getByRole('status').innerText(),'Sifariş şərtləri yoxlanılır…');
  unblockModule();await p.waitForFunction(()=>!!document.querySelector('.cart-entry-loading'));eq(await dialog.count(),1);
  unblockQuote();await dialog.getByText('Sifariş şərtlərini almaq mümkün olmadı.').waitFor();
  await dialog.getByRole('button',{name:'Yenidən cəhd et'}).click();await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).evaluate(b=>{b.click();b.click();});
  await dialog.getByLabel('HBO Max profil adı').fill('Sintetik otaq');await dialog.getByLabel('Profil kodu / PIN').fill('0012');
  await dialog.getByRole('button',{name:'Davam et',exact:true}).evaluate(b=>{b.click();b.click();});
  await p.waitForURL('**/hesab?next=%2Fsebet&from=cart');await p.getByText('Səbətinizdə 1 məhsul · 5,99 ₼',{exact:true}).waitFor();
  eq(draftCalls,1);eq(await p.evaluate(()=>MirpanelCart.read().map(x=>[x.productId,x.quantity])),[['hbomax',1]]);
  console.log(JSON.stringify({width,fromList,firstClick:true,slowScript:true,slowQuote:true,retry:true,oneDraft:true,guestLogin:true}));
  await ctx.close();
 }
 for(const width of (process.argv.includes('--combined')?[390,430,1440]:process.argv.includes('--smoke')?[390]:[320,360,390,430,1440])){
  const ctx=await browser.newContext({viewport:{width,height:900}}),p=await ctx.newPage();
  for(const route of ['/','/mehsul','/odenis','/balans','/sebet','/sifarislerim','/profil']){await p.goto(origin+route);const toggle=p.getByRole('button',{name:'Daxil ol',exact:true});await toggle.waitFor();await p.evaluate(()=>document.body.style.minHeight='1800px');eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(await p.locator('#accountGuest').isHidden())await toggle.click();await p.locator('#accountGuest').waitFor({state:'visible'});eq(await p.locator('#accountGuest').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth;}),true);eq(await p.locator('#accountGuest').getByRole('link',{name:'Qeydiyyat',exact:true}).count(),1);await toggle.click();eq(await p.locator('#accountGuest').isHidden(),true);await toggle.click();await p.mouse.click(4,300);eq(await p.locator('#accountGuest').isHidden(),true);await toggle.click();await p.keyboard.press('Escape');eq(await p.locator('#accountGuest').isHidden(),true);}
  await p.goto(origin+'/mehsul/synthetic?product=ordinary');
  if(width===390){
   await p.getByRole('button',{name:'Səbətə əlavə et',exact:true}).click();
   await p.locator('dialog.cart-entry').getByRole('checkbox').check();await p.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();
   const drawer=p.locator('.mir-cart-drawer[open]');await drawer.waitFor();eq(new URL(p.url()).pathname,'/mehsul/synthetic');
   await drawer.getByRole('button',{name:'Sil: Synthetic ordinary'}).click();await drawer.getByText('Səbətiniz boşdur.').waitFor();
   await drawer.getByRole('button',{name:'Səbəti bağla'}).click();
  }
  await p.getByRole('button',{name:'Sifariş et',exact:true}).click();await p.locator('dialog.cart-entry').getByRole('checkbox').check();await p.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();await p.waitForURL('**/hesab?next=%2Fsebet&from=cart');
  await p.getByRole('heading',{name:'Xoş gəldin 👋',exact:true}).waitFor();
  await p.getByText('Səbətinizdə 1 məhsul · 5,00 ₼',{exact:true}).waitFor();
  eq(await p.locator('.auth-order-rows article').count(),1);
  await p.waitForFunction(()=>[...document.querySelectorAll('.auth-order-rows img')].every(i=>i.complete&&i.naturalWidth>0));
  if(width===390||width===1440)await p.screenshot({path:'payment-test-artifacts/checkout-login/guest-one-'+width+'.png'});
  await p.goto(origin+'/mehsul/synthetic');await p.getByRole('button',{name:'Sifariş et',exact:true}).click();await p.locator('dialog.cart-entry').getByRole('checkbox').check();await p.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();await p.getByLabel('Otaq adı',{exact:true}).fill('Sintetik otaq');await p.getByLabel('Otaq kodu',{exact:true}).fill('0012');await p.getByRole('button',{name:'Davam et',exact:true}).click();await p.waitForURL('**/hesab?next=%2Fsebet&from=cart');
  await p.getByRole('heading',{name:'Daxil ol',exact:true}).waitFor();await p.getByText('Səbətinizdə 2 məhsul · 10,99 ₼',{exact:true}).waitFor();eq(await p.locator('.auth-order-rows article').count(),2);
  eq(await p.locator('.auth-order-rows article').last().evaluate(row=>{const [image,detail,price]=row.children,a=detail.getBoundingClientRect(),b=price.getBoundingClientRect(),r=row.getBoundingClientRect();return image instanceof HTMLImageElement&&a.right<b.left&&b.right<=r.right+1&&b.height<24&&document.documentElement.scrollWidth<=innerWidth;}),true);
  eq(await p.locator('.auth-submit').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(8, 121, 69)');
  const google=p.getByRole('button',{name:'Google ilə davam edin',exact:true});await google.scrollIntoViewIfNeeded();eq(await google.evaluate(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);await p.evaluate(()=>window.scrollTo(0,0));
  const before=await p.evaluate(()=>MirpanelCart.read());eq(before.length,2);eq(before.find(x=>x.productId==='netflix').quantity,1);eq(await p.locator('.mir-cart-drawer[open]').count(),0);
  await p.waitForFunction(()=>[...document.querySelectorAll('.auth-order-rows img')].every(i=>i.complete&&i.naturalWidth>0));
  if(width===390||width===1440)await p.screenshot({path:'payment-test-artifacts/checkout-login/guest-two-'+width+'.png'});
  if(width===430){await p.locator('.auth-switch').click();await p.locator('#account-firstName').fill('Sintetik');await p.locator('#account-lastName').fill('İstifadəçi');await p.locator('#account-email').fill('b@example.invalid');await p.locator('#account-phone').fill('501234567');await p.locator('#account-password').fill('Synthetic-password');await p.locator('#account-terms').check();let resumeRouter;const waitRouter=new Promise(resolve=>resumeRouter=resolve);await p.route('**/page-navigation.js?*',async route=>{await waitRouter;await route.continue();},{times:1});await p.getByRole('button',{name:'Qeydiyyatdan keç',exact:true}).click();try{await p.locator('dialog.auth-code-sheet:modal').waitFor();}finally{resumeRouter();}await p.waitForFunction(()=>window.mirpanelPageNavigation);eq(await p.locator('dialog.auth-code-sheet:modal').count(),1);await p.getByRole('button',{name:'Kod göndər',exact:true}).click();await p.locator('.auth-code-grid input').first().fill('001234');const reload=p.waitForEvent('domcontentloaded');await p.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await reload;eq(signupCallback,origin+'/sebet');}
  else if(width===1440){await p.getByRole('button',{name:'Google ilə davam edin',exact:true}).click();}
  else{await p.locator('#account-email').fill('a@example.invalid');await p.locator('#account-password').fill('Synthetic-password');await p.locator('.auth-submit').click();}
  await p.waitForURL('**/sebet');await p.getByRole('heading',{name:'Səbətim',exact:true}).waitFor();eq(await p.evaluate(()=>MirpanelCart.read()),before);await p.getByRole('button',{name:'Hesab menyusunu aç',exact:true}).waitFor();eq(await p.getByRole('button',{name:'Daxil ol',exact:true}).count(),0);
  eq(await p.getByRole('radio',{name:'Kartdan karta köçürmə',exact:false}).count(),0);
  await p.getByRole('button',{name:'Ödənişə keç',exact:true}).click();await p.waitForURL('**/sebet?checkout=1');await p.getByRole('radio',{name:'Kartdan karta köçürmə',exact:false}).waitFor();
  eq(await p.locator('.shop-checkout-cart .shop-product').count(),2);
  eq(await p.locator('.shop-checkout-grid').evaluate(n=>{const [a,b]=n.children;return b.getBoundingClientRect().top>a.getBoundingClientRect().top;}),width<761);
  await p.getByRole('link',{name:'Sintetik təklif seç'}).waitFor();
  const footer=p.locator('#customerFooter');await footer.getByText('283 tamamlanmış sifariş',{exact:true}).waitFor();
  eq(await footer.getByRole('link',{name:'Canlı dəstək',exact:true}).getAttribute('href'),'https://wa.me/994515243545');
  const values=await p.evaluate(id=>fetch('/api/payments/shop/draft?id='+id,{credentials:'same-origin'}).then(r=>r.json()),before.find(x=>x.productId==='netflix').draftId);eq(values.values.pin,'0012');eq(values.values.name,'Sintetik otaq');eq(await p.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('0012')),false);
  await p.reload();await p.getByRole('radio',{name:'Kartdan karta köçürmə',exact:false}).waitFor();eq(await p.evaluate(()=>MirpanelCart.read()),before);
  const complete=p.getByRole('button',{name:'Sifarişi tamamla · 10,99 ₼',exact:true});
  eq(await complete.isDisabled(),true);await p.locator('.checkout-consent input').check();eq(await complete.isEnabled(),true);
  await p.getByRole('radio',{name:/^Balans/}).check();await p.getByText('0,00 ₼ var, 10,99 ₼ çatmır.').waitFor();eq(await complete.isDisabled(),true);
  if(width===390||width===1440){
   await p.locator('.shop-checkout-grid').screenshot({path:'payment-test-artifacts/checkout-login/combined-'+width+'.png'});
   await p.getByRole('button',{name:'Artır: Synthetic ordinary'}).click();
   const updated=p.getByRole('button',{name:'Sifarişi tamamla · 15,99 ₼',exact:true});
   await updated.waitFor({timeout:12000}).catch(async e=>{console.log(await p.locator('#shopApp').innerText());throw e;});eq(await updated.isDisabled(),true);
   await p.getByRole('button',{name:'Azalt: Synthetic ordinary'}).click();await complete.waitFor();
   await p.locator('.checkout-consent input').check();
   await p.getByRole('radio',{name:'Kartdan karta köçürmə',exact:false}).check();await complete.click();
   await p.getByRole('heading',{name:'Bank kartını seçin'}).waitFor();
   await p.locator('.wallet-bank-grid').getByRole('button',{name:/ABB/}).click();
   await p.getByRole('button',{name:/Bu kartla davam et/}).click();await p.getByRole('button',{name:'Qalereyadan çek seç'}).waitFor();
   await p.getByRole('button',{name:'Ləğv et',exact:true}).click();await p.locator('.checkout-methods').waitFor();
  }
  if(width===390){await p.goto(origin+'/mehsul/synthetic?product=ordinary');await p.getByRole('button',{name:'Sifariş et',exact:true}).click();await p.locator('dialog.cart-entry').getByRole('checkbox').check();await p.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();await p.locator('.mir-cart-next:not(:disabled)').waitFor();await p.getByRole('button',{name:'Səbəti bağla'}).click();eq(new URL(p.url()).pathname,'/mehsul/synthetic');}
  if(process.argv.includes('--combined')){await ctx.close();console.log(JSON.stringify({width,combined:true,guestCartRestored:true,signup:width===430,receiptStage:width!==430,productionWrites:0}));continue;}
  for(const route of ['/','/mehsul','/odenis','/balans','/sebet','/sifarislerim','/profil']){await p.goto(origin+route);await p.getByRole('button',{name:'Hesab menyusunu aç',exact:true}).waitFor();eq(await p.getByRole('button',{name:'Daxil ol',exact:true}).count(),0);eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await p.evaluate(()=>window.MirpanelRequireLogin('/odenis'));eq(await p.locator('#accountGuest').isVisible(),true);await p.evaluate(()=>window.refreshCommunityNav());await p.getByRole('button',{name:'Hesab menyusunu aç',exact:true}).waitFor();
  await p.getByRole('button',{name:'Hesab menyusunu aç',exact:true}).click();await p.locator('#accountDropdown').getByRole('button',{name:'Çıxış',exact:true}).click();await p.getByRole('button',{name:'Daxil ol',exact:true}).waitFor();eq(await p.locator('.account-avatar').count(),0);
  await ctx.close();console.log(JSON.stringify({width,guestHeader:true,restored:true,signup:width===430,productionWrites:0}));
 }
 console.log(JSON.stringify({checks,oauthExternalTested:false,emailDeliveryTested:false,productionWrites:0}));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
