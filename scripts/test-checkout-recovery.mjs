import fs from 'node:fs';import {execFileSync} from 'node:child_process';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {shopFixture} from './shop-test-fixture.mjs';import {createShop} from '../mirpanel-admin/shop.mjs';import {handleShop} from '../mirpanel-admin/shop-http.mjs';import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';import {createBrowserOrders} from '../mirpanel-admin/browser-orders.mjs';import {validateReceiptFile} from '../mirpanel-admin/receipt-file-safety.mjs';import {imageReceipt,pdfReceipt,randomImage} from './receipt-synthetic-fixtures.mjs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,method}=f,config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),maxReceiptBytes:5242880,receiptsBucket:'synthetic',whatsappPhone:'994515243545'},security=createPaymentSecurity(config),dir='payment-test-artifacts/shop-browser/private-storage';fs.mkdirSync(dir,{recursive:true});let browser,server,checks=0,safetyCalls=0,storageFail=false;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},stored=new Map(),files=[];
const store={...f.store,rawMethod:async()=>({id:method,active:true,display_name:'Synthetic ABB',provider_name:'ABB',holder_name:'Synthetic only',encrypted_number:security.encryptNumber('4000000000001234'),method_type:'bank_card',last4:'1234'}),uploadReceipt:async(p,r)=>{if(storageFail)throw Object.assign(Error('Private yaddaşa yükləmək mümkün olmadı. Yenidən cəhd edin.'),{status:503});const file=path.join(dir,crypto.createHash('sha256').update(p).digest('hex'));fs.writeFileSync(file,r.buffer);stored.set(p,file);},verifyUploadedReceipt:async(p,size)=>{if(!stored.has(p)||fs.statSync(stored.get(p)).size!==size)throw Error('STORAGE_NOT_CONFIRMED');},getSettings:async()=>({receiptRetentionDays:90}),removeReceipt:async()=>{}};
const second=crypto.randomUUID();await pool.query("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit,limit_mode,active) values($1,'synthetic-second','Synthetic Leo','LeoBank','bank_card','5678','synthetic',2,5,'limited',true)",[second]);
await pool.query("update payment_methods set daily_limit=1,limit_mode='limited' where id=$1",[method]);
store.rawMethod=async id=>({...((await pool.query('select * from payment_methods where id=$1',[id])).rows[0]),holder_name:'Synthetic only',encrypted_number:security.encryptNumber('4000000000001234')});
const context=async req=>({pool,user:(req.headers.cookie||'').includes('synthetic_account=a')?'a':null}),shop=createShop({context,catalog:async()=>f.catalog,snapshot:()=>f.rpc('inventory_snapshot'),store,config}),browserOrders=createBrowserOrders({security,store,enabled:true});const json=(req,res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private,no-store'});res.end(JSON.stringify(data));},raw=async(req,max)=>{let n=0,a=[];for await(const b of req){n+=b.length;if(n>max)throw Object.assign(Error('Fayl maksimum 5 MB ola bilər.'),{status:413});a.push(b);}return Buffer.concat(a);},body=async(req,max)=>JSON.parse((await raw(req,max)).toString());
f.catalog.products.push({id:'spotify',title:'Spotify',active:true,plans:[{price:5,months:1,terms:'Sintetik istifadə şərtləri'}],formFields:[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}]},{id:'netflix',title:'Netflix',active:true,plans:[{price:6,months:1,terms:'Sintetik Netflix şərtləri',formFields:[{key:'name',label:'Ad',placeholder:'Adınızı yazın',required:true},{key:'pin',label:'Otaq kodu',placeholder:'Otaq 4 rəqəmli kod (PIN) təyin edin',digits:4,required:true}]}]});
try{await pool.query("select wallet_credit('owner','a',2000,'Synthetic browser credit',$1)",[crypto.randomUUID()]);server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),signed=(req.headers.cookie||'').includes('synthetic_account=a');if(url.pathname.startsWith('/api/payments/shop/'))return await handleShop({req,res,url,shop,browserOrders,security,readBody:body,readRawBody:raw,validateFile:async r=>{safetyCalls++;return validateReceiptFile(r);},store,config,json,rate:async()=>{},withBackground:async m=>({...m,backgroundUrl:'/api/payments/bank-backgrounds/abb?v=synthetic'})});if(url.pathname==='/api/payments/methods'){await f.rpc('payment_method_queue_snapshot',[false,false]);const rows=(await pool.query("select * from payment_methods where not manual_disabled and not archived and deleted_at is null")).rows;return json(req,res,200,{methods:rows.map(m=>({id:m.id,displayName:m.id===method?'Synthetic ABB':'Synthetic Leo',providerName:m.provider_name,available:m.active,last4:m.last4,backgroundUrl:'/api/payments/bank-backgrounds/'+(m.id===method?'abb':'leo')+'?v=synthetic'}))});}if(url.pathname.startsWith('/api/payments/bank-backgrounds/')){res.setHeader('Content-Type','image/png');return res.end(await randomImage());}if(url.pathname==='/api/community/state'){const p=signed?{id:'a',display_name:'Reader A',email:'a@example.test',avatar:0,balanceCents:Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents)}:null;return json(req,res,200,{profile:p});}
 if(['/sebet','/balans','/odenis'].includes(url.pathname)){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/shop.css"><body style="margin:0;background:#0b1016"><main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script><script src="/browser-nav.js"></script></body></html>');}
 if(url.pathname==='/mehsul/synthetic'){res.setHeader('Content-Type','text/html');return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{background:#151719;color:#eee;font:16px system-ui}#modal:not(.show){display:none}#modal{max-width:480px;margin:auto}#pp-main-img{width:90px}</style><header class="site-header"><div class="site-header-tools"></div></header><img id="pp-main-img" src="/synthetic.png"><div id="pp-plans-container"><button class="pp-plan-label" onclick="currentPlanIdx=0">1 aylıq</button><button class="pp-plan-label" onclick="currentPlanIdx=1">2 aylıq</button><button class="pp-plan-label" onclick="currentPlanIdx=2">3 aylıq</button></div><div><a class="product-page-action is-about" href="#about">Məhsul haqqında</a><button id="pp-order-btn">Sifariş et</button></div><a data-browser-nav="cart" href="/sebet">Səbət</a><div id="modal"><div class="modalCard"><div class="mTop"><h1 id="mTitle"></h1></div><div id="mInfo"></div><div id="mForm"></div></div></div><script>const DATA=${JSON.stringify(f.catalog)};let currentProduct=DATA.products.find(p=>p.id===new URLSearchParams(location.search).get('p'))||DATA.products[0],currentPlanIdx=0;window.openProductPage=id=>location.assign('/mehsul/synthetic?p='+id);function lockBodyScroll(){};window.MirpanelPaymentFlow={start(){document.getElementById('mForm').textContent='Mövcud kart axını açıldı';return null;}};</script><script src="/cart-store.js"></script><script src="/order-confirmation.js"></script>`);}
 let file=url.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+url.pathname.slice(18):url.pathname.slice(1);if(file==='synthetic.png'){res.setHeader('Content-Type','image/png');return res.end(await randomImage());}if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch(e){json(req,res,e.status||503,{error:e.status?e.message:'Xidmət xətası. Yenidən cəhd edin.'});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;


 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[];
 // Same cold-load scenario with the previous released entry, delayed stylesheet.
 const priorEntry=execFileSync('git',['show','7a53f4b:mirpanel-admin/community/public/cart-entry.js'],{encoding:'utf8'});
 const prior=await browser.newContext({viewport:{width:390,height:844}}),bp=await prior.newPage();
 let releaseBefore;const beforeHold=new Promise(r=>releaseBefore=r);
 await bp.route('**/community-assets/cart-entry.js?*',r=>r.fulfill({contentType:'text/javascript',body:priorEntry}));
 await bp.route('**/community-assets/cart-entry.css?*',async r=>{await beforeHold;return r.continue();});
 await bp.goto(origin+'/mehsul/synthetic?p=netflix');await bp.locator('#pp-order-btn').click();
 await bp.locator('dialog.cart-entry[open]').waitFor();
 const beforeStyle=await bp.locator('dialog.cart-entry').evaluate(n=>({background:getComputedStyle(n).backgroundColor,iconWidth:n.querySelector('svg').getBoundingClientRect().width}));
 eq(beforeStyle.background,'rgb(255, 255, 255)');eq(beforeStyle.iconWidth>100,true);
 await bp.screenshot({path:'payment-test-artifacts/shop-browser/recovery-before-unstyled-390.png'});
 releaseBefore();await prior.close();
 for(const width of [390,1440]){
  await pool.query("update payment_methods set manual_disabled=false,active=true,daily_limit=case when id=$1 then 1 else 5 end where id=any($2::uuid[])",[method,[method,second]]);
  await pool.query('delete from payment_method_daily_counters'); // isolated fixture only
  const ctx=await browser.newContext({viewport:{width,height:844}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await ctx.route('https://wa.me/**',r=>r.abort());
  let release;const hold=new Promise(r=>release=r);
  await p.route('**/community-assets/cart-entry.css?*',async r=>{await hold;return r.continue();});
  await p.goto(origin+'/mehsul/synthetic?p=netflix');
  eq(await p.locator('dialog[open]').count(),0);
  const cssRequest=p.waitForRequest(r=>r.url().includes('/cart-entry.css'));
  await p.locator('#pp-order-btn').click();await cssRequest;eq(await p.locator('dialog[open]').count(),0);release();
  const d=p.locator('dialog.cart-entry');await d.getByRole('heading',{name:'Diqqət!'}).waitFor();
  eq(await d.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(25, 25, 25)');
  eq(await d.locator('svg').evaluate(n=>n.getBoundingClientRect().width<=24),true);
  await p.screenshot({path:'payment-test-artifacts/shop-browser/recovery-warning-'+width+'.png'});
  await d.getByRole('checkbox').check();await d.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();
  await d.getByLabel('Ad',{exact:true}).fill('Sintetik ad');await d.getByLabel('Otaq kodu',{exact:true}).fill('0012');
  await p.screenshot({path:'payment-test-artifacts/shop-browser/recovery-netflix-'+width+'.png'});
  await d.getByRole('button',{name:'Davam et',exact:true}).click();await p.locator('.mir-cart-drawer[open]').waitFor();await p.locator('.mir-cart-drawer').getByRole('button',{name:'Səbəti bağla'}).click();
  // Initialize the actual router AFTER the dynamic style exists, then navigate.
  // Its old stylesheet registry disabled this sheet on the next route.
  await p.route('**/mehsul',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><main><button id="pp-order-btn">Sifariş et</button></main>'}));
  await p.addScriptTag({path:'page-navigation.js'});await p.evaluate(()=>MirpanelNavigation.go('/mehsul'));
  eq(await p.evaluate(()=>document.querySelector('[data-cart-entry-css]').disabled),false);
  // Also recover a sheet disabled by an older already-running router.
  await p.evaluate(()=>{document.querySelector('[data-cart-entry-css]').disabled=true;});
  await p.locator('#pp-order-btn').click();await d.getByRole('heading',{name:'Diqqət!'}).waitFor();
  eq(await d.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(25, 25, 25)');
  await d.getByRole('button',{name:'Ləğv et',exact:true}).click();
  await p.goto(origin+'/mehsul/synthetic?p=ordinary');await p.locator('#pp-order-btn').click();await d.getByRole('checkbox').check();await d.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();
  const drawer=p.locator('.mir-cart-drawer[open]');await drawer.waitFor();eq(await p.evaluate(()=>MirpanelCart.read().length),2);
  await drawer.getByRole('button',{name:'Ödənişə keç'}).click();const finish=p.getByRole('button',{name:'Sifarişi tamamla',exact:true});await finish.waitFor();
  await p.getByRole('radio',{name:'Balans',exact:false}).check();eq(await finish.isDisabled(),true);await p.getByRole('link',{name:'Balansı artır',exact:true}).waitFor();
  await p.getByRole('radio',{name:'Kartdan karta köçürmə'}).check();await finish.click();await p.getByRole('button',{name:/ABB/}).click();await p.getByRole('button',{name:/Bu kartla davam et/}).click();
  await p.getByRole('button',{name:'Qalereyadan çek seç'}).waitFor();
  let group=await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.checkout.v1')).id);
  await f.rpc('payment_method_queue_snapshot',[false,false]);eq((await pool.query('select active from payment_methods where id=$1',[method])).rows[0].active,false);
  await p.reload();await p.getByRole('button',{name:'Qalereyadan çek seç'}).waitFor();
  eq((await pool.query("select count(*)::int n from payment_reservations where not capacity_shadow and status='reserved' and method_id=$1",[method])).rows[0].n,1);
  await pool.query('update payment_methods set manual_disabled=true,active=false where id=$1',[method]);await p.reload();
  await p.getByRole('heading',{name:'Ödəniş kartını yenidən seçin'}).waitFor();eq(await p.evaluate(()=>MirpanelCart.read().length),2);
  await p.getByRole('button',{name:'Başqa kart seç',exact:true}).click();await p.getByRole('heading',{name:'Bank kartını seçin'}).waitFor();
  eq((await pool.query('select state from shop_checkouts where id=$1',[group])).rows[0].state,'cancelled');
  await p.getByRole('button',{name:/Leo/}).click();await p.getByRole('button',{name:/Bu kartla davam et/}).click();await p.getByRole('button',{name:'Qalereyadan çek seç'}).waitFor();
  group=await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.checkout.v1')).id);
  await pool.query("update shop_checkouts set expires_at=clock_timestamp()-interval '1 second' where id=$1",[group]);
  await pool.query("update payment_reservations set expires_at=clock_timestamp()-interval '1 second' where id=(select main_reservation_id from shop_checkouts where id=$1) or cart_parent_reservation_id=(select main_reservation_id from shop_checkouts where id=$1)",[group]);
  await f.rpc('expire_payment_reservations');await p.reload();await finish.waitFor();await p.getByText('Əvvəlki rezervin vaxtı bitib.',{exact:false}).waitFor();eq(await p.evaluate(()=>MirpanelCart.read().length),2);
  await finish.click();await p.getByRole('button',{name:/Leo/}).click();await p.getByRole('button',{name:/Bu kartla davam et/}).click();await p.getByRole('button',{name:'Qalereyadan çek seç'}).waitFor();
  group=await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.checkout.v1')).id);
  await p.getByLabel('Çek faylı',{exact:true}).setInputFiles({name:'Sintetik çek.png',mimeType:'image/png',buffer:await randomImage()});await p.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();
  await p.screenshot({path:'payment-test-artifacts/shop-browser/recovery-bank-'+width+'.png',fullPage:true});
  const response=p.waitForResponse(r=>r.url().endsWith('/shop/submit')&&r.status()===200);await p.getByRole('button',{name:'Davam et',exact:true}).click();await response;await p.waitForTimeout(300);
  await p.goto(origin+'/odenis?completed='+group);await p.getByRole('link',{name:'WhatsApp-da aç'}).waitFor();
  const o=(await pool.query('select order_id from shop_checkouts where id=$1',[group])).rows[0].order_id;
  eq((await pool.query('select checkout_snapshot from payment_orders where id=$1',[o])).rows[0].checkout_snapshot.items.length,2);
  eq((await pool.query('select count(distinct order_id)::int n from shop_lines where checkout_id=$1',[group])).rows[0].n,1);
  // All cards really full: explain capacity, keep the cart, do not create an order.
  await pool.query('update payment_methods set daily_limit=1 where id=$1',[second]);
  await p.goto(origin+'/mehsul/synthetic?p=ordinary');await p.locator('#pp-order-btn').click();await d.getByRole('checkbox').check();await d.getByRole('button',{name:'Təsdiqləyirəm',exact:true}).click();
  await p.locator('.mir-cart-drawer[open]').getByRole('button',{name:'Ödənişə keç'}).click();await p.getByText('Kartların hazırda boş ödəniş limiti yoxdur.',{exact:false}).waitFor();eq(await finish.isDisabled(),true);eq(await p.evaluate(()=>MirpanelCart.read().length),1);
  eq(errors,[]);results.push({width,cssDelayed:true,routerStylePreserved:true,disabledCssRecovered:true,lastSlot:true,manualDisableAlternative:true,expiry:true,allCardsFull:true,receiptAndOneOrder:true});await ctx.close();
 }
 console.log(JSON.stringify({checks,unstyledFirstOpenReproduced:true,results,productionWrites:0,scope:'isolated PostgreSQL + local storage and real safety validation; not live financial writes'}));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
