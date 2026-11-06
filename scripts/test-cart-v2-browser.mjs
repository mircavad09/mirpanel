import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {shopFixture} from './shop-test-fixture.mjs';import {createShop} from '../mirpanel-admin/shop.mjs';import {handleShop} from '../mirpanel-admin/shop-http.mjs';import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';import {createBrowserOrders} from '../mirpanel-admin/browser-orders.mjs';import {validateReceiptFile} from '../mirpanel-admin/receipt-file-safety.mjs';import {imageReceipt,pdfReceipt,randomImage} from './receipt-synthetic-fixtures.mjs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,method}=f,config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),maxReceiptBytes:5242880,receiptsBucket:'synthetic',whatsappPhone:'994515243545'},security=createPaymentSecurity(config),dir='payment-test-artifacts/shop-browser/private-storage';fs.mkdirSync(dir,{recursive:true});let browser,server,checks=0,safetyCalls=0,storageFail=false;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},stored=new Map(),files=[];
const store={...f.store,rawMethod:async()=>({id:method,active:true,display_name:'Synthetic ABB',provider_name:'ABB',holder_name:'Synthetic only',encrypted_number:security.encryptNumber('4000000000001234'),method_type:'bank_card',last4:'1234'}),uploadReceipt:async(p,r)=>{if(storageFail)throw Object.assign(Error('Private yaddaşa yükləmək mümkün olmadı. Yenidən cəhd edin.'),{status:503});const file=path.join(dir,crypto.createHash('sha256').update(p).digest('hex'));fs.writeFileSync(file,r.buffer);stored.set(p,file);},verifyUploadedReceipt:async(p,size)=>{if(!stored.has(p)||fs.statSync(stored.get(p)).size!==size)throw Error('STORAGE_NOT_CONFIRMED');},getSettings:async()=>({receiptRetentionDays:90}),removeReceipt:async()=>{}};
const context=async req=>({pool,user:(req.headers.cookie||'').includes('synthetic_account=a')?'a':null}),shop=createShop({context,catalog:async()=>f.catalog,snapshot:()=>f.rpc('inventory_snapshot'),store,config}),browserOrders=createBrowserOrders({security,store,enabled:true});const json=(req,res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private,no-store'});res.end(JSON.stringify(data));},raw=async(req,max)=>{let n=0,a=[];for await(const b of req){n+=b.length;if(n>max)throw Object.assign(Error('Fayl maksimum 5 MB ola bilər.'),{status:413});a.push(b);}return Buffer.concat(a);},body=async(req,max)=>JSON.parse((await raw(req,max)).toString());
f.catalog.products.push({id:'spotify',title:'Spotify',active:true,plans:[{price:5,months:1,terms:'Sintetik istifadə şərtləri'}],formFields:[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}]},{id:'netflix',title:'Netflix',active:true,plans:[{price:6,months:1,terms:'Sintetik Netflix şərtləri',formFields:[{key:'pin',label:'4 rəqəmli kod',digits:4,required:true}]}]});
try{await pool.query("select wallet_credit('owner','a',2000,'Synthetic browser credit',$1)",[crypto.randomUUID()]);server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),signed=(req.headers.cookie||'').includes('synthetic_account=a');if(url.pathname.startsWith('/api/payments/shop/'))return await handleShop({req,res,url,shop,browserOrders,security,readBody:body,readRawBody:raw,validateFile:async r=>{safetyCalls++;return validateReceiptFile(r);},store,config,json,rate:async()=>{},withBackground:async m=>({...m,backgroundUrl:'/api/payments/bank-backgrounds/abb?v=synthetic'})});if(url.pathname==='/api/payments/methods')return json(req,res,200,{methods:[{id:method,available:true,displayName:'Synthetic ABB',maskedNumber:'****1234',backgroundUrl:'/api/payments/bank-backgrounds/abb?v=synthetic'},...['m10','leo','kapital'].map((bank,i)=>({id:'synthetic-'+bank,available:true,providerName:bank,type:i===0?'wallet':'bank_card',last4:'987'+i,backgroundUrl:'/api/payments/bank-backgrounds/'+bank+'?v=synthetic'}))]});if(url.pathname.startsWith('/api/payments/bank-backgrounds/')){res.setHeader('Content-Type','image/png');return res.end(await randomImage());}if(url.pathname==='/api/community/state'){const p=signed?{id:'a',display_name:'Reader A',email:'a@example.test',avatar:0,balanceCents:Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents)}:null;return json(req,res,200,{profile:p});}
 if(['/sebet','/balans','/odenis'].includes(url.pathname)){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/shop.css"><body style="margin:0;background:#0b1016"><main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script><script src="/browser-nav.js"></script></body></html>');}
 if(url.pathname==='/mehsul/synthetic'){res.setHeader('Content-Type','text/html');return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{background:#151719;color:#eee;font:16px system-ui}#modal:not(.show){display:none}#modal{max-width:480px;margin:auto}#pp-main-img{width:90px}</style><header class="site-header"><div class="site-header-tools"></div></header><img id="pp-main-img" src="/synthetic.png"><div id="pp-plans-container"><button class="pp-plan-label" onclick="currentPlanIdx=0">1 aylıq</button><button class="pp-plan-label" onclick="currentPlanIdx=1">2 aylıq</button><button class="pp-plan-label" onclick="currentPlanIdx=2">3 aylıq</button></div><div><a class="product-page-action is-about" href="#about">Məhsul haqqında</a><button id="pp-order-btn">Sifariş et</button></div><a data-browser-nav="cart" href="/sebet">Səbət</a><div id="modal"><div class="modalCard"><div class="mTop"><h1 id="mTitle"></h1></div><div id="mInfo"></div><div id="mForm"></div></div></div><script>const DATA=${JSON.stringify(f.catalog)};let currentProduct=DATA.products.find(p=>p.id===new URLSearchParams(location.search).get('p'))||DATA.products[0],currentPlanIdx=0;window.openProductPage=id=>location.assign('/mehsul/synthetic?p='+id);function lockBodyScroll(){};window.MirpanelPaymentFlow={start(){document.getElementById('mForm').textContent='Mövcud kart axını açıldı';return null;}};</script><script src="/cart-store.js"></script><script src="/order-confirmation.js"></script>`);}
 let file=url.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+url.pathname.slice(18):url.pathname.slice(1);if(file==='synthetic.png'){res.setHeader('Content-Type','image/png');return res.end(await randomImage());}if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch(e){json(req,res,e.status||503,{error:e.status?e.message:'Xidmət xətası. Yenidən cəhd edin.'});}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;

 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const findings=[];
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:844},permissions:['clipboard-read','clipboard-write']}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://wa.me/**',r=>r.abort());
  let dropDraft=width===390,dropSubmit=width===390;
  await p.route('**/api/payments/shop/draft',async r=>{if(r.request().method()==='POST'&&dropDraft){dropDraft=false;await r.fetch();return r.abort('connectionreset');}return r.continue();});
  await p.route('**/api/payments/shop/submit',async r=>{if(dropSubmit){dropSubmit=false;await r.fetch();return r.abort('connectionreset');}return r.continue();});
  async function add(product,values){
   await p.goto(origin+'/mehsul/synthetic?p='+product);
   await p.locator('#pp-order-btn').click();
   const d=p.locator('dialog.cart-entry');
   await d.getByRole('heading',{name:'Diqqət!'}).waitFor();
   eq(await d.getByRole('button',{name:'Təsdiqləyirəm'}).isDisabled(),true);
   await d.getByRole('checkbox').check();
   await d.getByRole('button',{name:'Təsdiqləyirəm'}).click();
   if(Object.keys(values).length){for(const [k,v] of Object.entries(values))await d.getByLabel(k,{exact:true}).fill(v);await p.screenshot({path:'payment-test-artifacts/shop-browser/cart-fields-'+product+'-'+width+'.png'});await d.getByRole('button',{name:'Davam et',exact:true}).click();if(width===390&&product==='spotify'){await d.locator('.cart-entry-error').filter({hasText:/fetch/i}).waitFor();eq(await d.getByLabel('Şifrə',{exact:true}).inputValue(),values['Şifrə']);await d.getByRole('button',{name:'Davam et',exact:true}).click();}}
   await p.locator('.mir-cart-drawer[open]').waitFor();
   await p.locator('.mir-cart-drawer').getByRole('button',{name:'Səbəti bağla'}).click();
  }
  await add('spotify',{'E-poçt':'synthetic@example.invalid','Şifrə':'Only-synthetic-password'});
  await add('netflix',{'4 rəqəmli kod':'0012'});
  await add('ordinary',{});
  await add('ordinary',{});
  eq(await p.evaluate(()=>MirpanelCart.read().find(x=>x.productId==='ordinary').quantity),2);
  eq(await p.evaluate(()=>MirpanelCart.read().length),3);
  eq((await pool.query('select count(*)::int n from shop_drafts where removed_at is null')).rows[0].n,4);
  eq(await p.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('Only-synthetic-password')),false);
  eq(await p.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('0012')),false);
  // Reload restores only opaque metadata, then reads protected draft for editing.
  await ctx.addCookies([{name:'synthetic_account',value:'a',url:origin}]);await p.goto(origin+'/sebet');await p.locator('.shop-card').filter({hasText:'Netflix'}).getByRole('button',{name:'Məlumatları redaktə et'}).click();
  await p.getByLabel('4 rəqəmli kod',{exact:true}).waitFor();eq(await p.getByLabel('4 rəqəmli kod',{exact:true}).inputValue(),'0012');
  await p.getByRole('button',{name:'Davam et',exact:true}).click();
  await p.locator('.mir-cart-drawer[open]').waitFor();
  await p.locator('.mir-cart-drawer').getByRole('button',{name:'Ödənişə keç'}).click();
  const finish=p.getByRole('button',{name:'Sifarişi tamamla',exact:true});await finish.waitFor();eq(await finish.isEnabled(),true);
  await p.getByRole('radio',{name:'Balans',exact:false}).check();eq(await finish.isDisabled(),true);await p.getByRole('link',{name:'Balansı artır',exact:true}).waitFor();
  await p.getByRole('radio',{name:'Kartdan karta köçürmə'}).check();await finish.click();await p.getByRole('button',{name:/Synthetic ABB/}).click();
  await p.getByRole('button',{name:/Bu kartla davam et/}).click();await p.getByRole('button',{name:'Qalereyadan çek seç'}).waitFor();
  for(const file of [{name:'Android ekran şəkli uzun ad.jpeg',mimeType:'image/jpeg',buffer:await imageReceipt('ABB',{},'image/jpeg')},{name:'safe.pdf',mimeType:'application/pdf',buffer:pdfReceipt()},{name:'receipt.png',mimeType:'image/png',buffer:await randomImage()}]){
   await p.getByLabel('Çek faylı',{exact:true}).setInputFiles(file);await p.getByText('Çek uğurla yükləndi',{exact:true}).waitFor();eq(await p.getByRole('button',{name:'Davam et',exact:true}).isEnabled(),true);
  }
  await p.screenshot({path:'payment-test-artifacts/shop-browser/cart-v2-transfer-'+width+'.png',fullPage:true});
  const group=await p.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.checkout.v1')).id);
  if(width===390){await p.getByRole('button',{name:'Davam et',exact:true}).click();await p.locator('.shop-error').filter({hasText:/fetch/i}).waitFor();}
  const submitted=p.waitForResponse(r=>r.url().endsWith('/api/payments/shop/submit')&&r.status()===200);
  const external=p.waitForRequest(r=>r.url().startsWith('https://wa.me/'));
  await p.getByRole('button',{name:'Davam et',exact:true}).click();await submitted;const summary=new URL((await external).url()).searchParams.get('text');eq(summary.includes('4 rəqəmli kod: 0012'),true);eq(summary.includes('E-poçt: synthetic@example.invalid'),true);eq(summary.includes('Şifrə: Only-synthetic-password'),true);eq(summary.includes('Say: 2 ədəd'),true);
  await p.waitForTimeout(300); // Let the intercepted external navigation settle.
  await p.goto(origin+'/odenis?completed='+group);await p.getByRole('link',{name:'WhatsApp-da aç'}).waitFor();
  const o=(await pool.query('select order_id from shop_checkouts where id=$1',[group])).rows[0];
  const order=(await pool.query('select checkout_snapshot,receipt_path from payment_orders where id=$1',[o.order_id])).rows[0];
  eq(order.checkout_snapshot.items.length,3);eq(!!order.receipt_path,true);
  eq((await pool.query('select count(*)::int n from payment_reservations where id=(select main_reservation_id from shop_checkouts where id=$1) and not capacity_shadow',[group])).rows[0].n,1);
  await p.reload();await p.getByRole('link',{name:'WhatsApp-da aç'}).waitFor();eq((await pool.query('select count(distinct order_id)::int n from shop_lines where checkout_id=$1',[group])).rows[0].n,1);
  eq(errors,[]);findings.push({width,guest:true,fields:true,masked:true,oneOrder:true,receiptLinked:true});await ctx.close();
 }
 console.log(JSON.stringify({checks,findings,productionWrites:0,scope:'isolated loopback PostgreSQL + private local storage; Chrome mobile viewport (not physical Safari)'}));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
