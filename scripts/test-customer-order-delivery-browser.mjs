import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const sample='E-poçt: buyer@example.test\nŞifrə: synthetic-only\n\nİkinci sətir ✨\n  Son sətir';
const order='12345678-1234-4234-8234-000000000001',delivery='12345678-1234-4234-8234-000000000002';
const legacy='12345678-1234-4234-8234-000000000003',email='buyer@example.test',password='synthetic-only';
const ready='Giriş qaydası\n\nİkinci sətir ✨\n  Son sətir';
const repeat={productId:'synthetic',title:'Synthetic first',planIndex:0,planName:'1 ay'};
const price=725,field={key:'room',label:'Otaq adı',type:'text',required:true,minLength:1,maxLength:40};
const guides=[{information:'# Əsas qaydalar\n\n- Sintetik telefon qaydası.\n\n'+('Yalnız sınaq üçün yazılmış əlavə izah.\n'.repeat(40)),tracks:{phone:[{image:'https://guide.example.test/1.png',description:'Tətbiqi açın.'},{image:'https://guide.example.test/2.png',description:'Sınaq profilini seçin.'}]}},{information:'İkinci məhsula aid qayda.',tracks:{desktopQr:[{image:'https://guide.example.test/3.png',description:'Sınaq ekranını açın.'}]}}];
let status='reviewing',reveals=0,available=1,drafts=0,payments=0,receiptReads=0,expiresOn,preview=false,autoDelivered=false,newerStatus=null,realProfile=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=body=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(body));};
 if(u.pathname==='/api/payments/my-orders'){
  assert([null,'9180'].includes(u.searchParams.get('order')));
  const items=[{title:'CapCut Pro',quantity:1,planName:'1 aylıq (Telefon)',unitCents:500,repeat,expiresOn:status==='completed'?expiresOn:undefined,image:'/assets/capcut.png'}];
  if(!preview)items.push({title:'Əlavə sınaq paketi',quantity:1,planName:'1 aylıq uzun paket adı — uzun sətir üçün sınaq',unitCents:600,warranty:'7 gün zəmanət'});
  const original={id:order,orderCode:'9180',product:'CapCut Pro · Sınaq sifarişi',amount:preview?5:11,status,autoDelivered,createdAt:'2026-11-08T09:03:00Z',receiptAvailable:true,items,deliveries:[{id:delivery,line:0,quantity:1},...(!preview&&status==='completed'?[{id:legacy,line:1,quantity:1}]:[])]};
  const newer={...original,id:'newer-order',orderCode:'9181',status:newerStatus,createdAt:'2026-11-09T09:03:00Z',deliveries:[]};
  return json({accountId:'synthetic-orders',orders:newerStatus?[newer,original]:[original],nextCursor:null});
 }
 if(u.pathname==='/api/payments/my-orders/codes')return json({codes:[
  {id:delivery,title:'CapCut Pro',plan:'1 ay',image:'/assets/capcut.png',quantity:1,purchasedAt:'2026-11-08T20:05:00Z',category:{key:'video',label:'Video montajı'}},
  {id:'12345678-1234-4234-8234-000000000003',title:'Netflix Şəxsi',plan:'7 gün',quantity:1,purchasedAt:'2026-11-08T09:05:00Z',category:{key:'film',label:'Film'}}
 ]});
 if(u.pathname==='/api/payments/my-orders/codes/'+delivery){reveals++;return json({text:sample,email,password});}
 if(u.pathname==='/api/payments/my-orders/codes/'+legacy)return json({text:ready});
 if(u.pathname.startsWith('/api/payments/my-orders/'+order+'/guide/'))return json(guides[Number(u.pathname.split('/').at(-1))]);
 if(u.pathname==='/api/payments/my-orders/'+order+'/receipt'){receiptReads++;return json({mime:'image/png',url:'https://synthetic.supabase.co/private.png'});}
 if(u.pathname==='/api/payments/shop/quote')return json({items:[{...repeat,terms:'Yeni şərtlər',termsVersion:'current',unitCents:price,available,fields:[field]}],totalCents:price,balanceCents:10000});
 if(u.pathname==='/api/payments/shop/drafts')return json({items:[]});
 if(u.pathname==='/api/payments/shop/draft'){let body='';for await(const c of req)body+=c;const x=JSON.parse(body);drafts++;assert.deepEqual(x.values,{room:'Yeni otaq'});return json({...repeat,draftId:x.id,lineId:x.id,termsVersion:x.termsVersion,unitCents:price});}
 if(u.pathname==='/api/payments/shop/checkout'){payments++;return json({});}
 if(u.pathname==='/sifarislerim'||u.pathname==='/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const standalone=fs.readFileSync('sifarislerim.html','utf8');
  return res.end(u.pathname==='/sifarislerim'?standalone:standalone.replace(/<main class="browser-orders-main">.*?<\/main>/s,'<main><h1>Başlanğıc</h1></main>').replace(/<script src="\/browser-orders\.js[^"]*"><\/script>/,''));
 }
 if(u.pathname==='/api/community/profile-summary')return json({orderCount:1,savingsCents:0,latestOrder:null});
 if(u.pathname==='/api/community/state')return json({profile:{user_id:'synthetic-orders',display_name:'Sınaq',member_number:1001,balanceCents:2475,emailVerified:true,tier:{id:'standard',progress:0}}});
 if(u.pathname==='/profil'&&realProfile){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><meta name="viewport" content="width=device-width"><main id="communityApp" data-profile-entry></main><script type="module" src="/community-assets/profile-entry.js"></script>');
 }
 if(u.pathname==='/profil'){
  const codes=u.searchParams.get('tab')==='codes';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#0e1113;color:white"><main class="account-panel" style="max-width:920px;margin:24px auto;font:14px system-ui,'Segoe UI',Arial,sans-serif">${codes?
   '<section id="codes"></section><script type="module">import {mountCodes} from "/community-assets/account-codes.js";const el=(tag,a,...children)=>{const e=document.createElement(tag);for(const [k,v]of Object.entries(a))v===true?e.setAttribute(k,""):e.setAttribute(k,v);e.append(...children);return e;};const button=(label,fn)=>{const b=el("button",{type:"button"},label);b.onclick=fn;return b;};mountCodes({content:document.getElementById("codes"),el,button});</script>':
   '<h1 style="font-size:21px;margin:0 0 14px">Sifarişlərim</h1><section id="browserOrders"></section><p id="browserOrdersError" hidden></p><button id="browserOrdersMore" hidden>Daha çox göstər</button><dialog id="browserReceipt"><button id="browserReceiptClose">Bağla</button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>'}</main>`);
 }
 if(u.pathname==='/checkout-sounds.js'){res.setHeader('Content-Type','text/javascript');return res.end('export function playCheckoutSound(k,id){sessionStorage.setItem("played",(Number(sessionStorage.getItem("played"))+1).toString());}');}
 if(u.pathname==='/assets/capcut.png'){res.setHeader('Content-Type','image/png');return res.end(fs.readFileSync('assets/capcut.png'));}
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
 if(/\.(js|css)$/.test(file)&&!file.includes('..')&&fs.existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const live=process.argv.includes('--live'),site=live?'https://mirpanel.com':origin;
try{
 for(const [engine,name,width]of [[chromium,'Chrome desktop',1440],[chromium,'Chrome mobil ölçü',320],[webkit,'WebKit mobil ölçü',390]]){
  status='reviewing';reveals=drafts=payments=receiptReads=0;available=1;expiresOn='2026-12-09';autoDelivered=false,newerStatus=null,realProfile=false;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const page=await browser.newPage({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
   if(live){
    await page.route('**/*',async r=>{
     const u=new URL(r.request().url());
     if(u.origin!==site||r.request().method()!=='GET')return r.abort();
     if(u.pathname==='/profil'||u.pathname.startsWith('/api/')||u.pathname==='/checkout-sounds.js'){
      const result=await fetch(origin+u.pathname+u.search);
      return r.fulfill({status:result.status,contentType:result.headers.get('content-type'),body:await result.text()});
     }
     return r.continue();
    });
   }
   await page.clock.setFixedTime(new Date('2026-11-08T20:30:00Z')); // 09 November in Baku.
   await page.addInitScript((mobile)=>{
    if(mobile)window.ClipboardItem=class{constructor(types){this.types=types;}};
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:mobile?{
     write:async items=>{if(window.__copyResponseReady)throw Error('The write must begin before the request resolves');window.__copied=await (await items[0].types['text/plain']).text();}
    }:{writeText:async text=>{window.__copied=text;}}});
    document.addEventListener('click',e=>{if(e.target.closest('button')?.textContent==='Kopyala')window.__copyResponseReady=false;},{capture:true});
    const fetchOriginal=window.fetch;window.fetch=async(...args)=>{const result=await fetchOriginal(...args);if(String(args[0]).includes('/my-orders/codes/'))window.__copyResponseReady=true;return result;};
    const timer=window.setInterval;window.setInterval=(fn,ms,...args)=>timer(fn,ms===12000?100:ms,...args);
   },width<600);
   if(live){
    status='completed';
    const assets=Promise.all(['js','css'].map(async ext=>{
     const response=await page.waitForResponse(r=>new URL(r.url()).pathname==='/browser-orders.'+ext&&r.ok());
     assert.equal((await response.text()).replaceAll('\r\n','\n'),fs.readFileSync('browser-orders.'+ext,'utf8').replaceAll('\r\n','\n'));
    }));
    await page.goto(site+'/profil?tab=orders');await assets;
    const fresh=page.locator('[data-delivery="'+delivery+'"]'),legacyCard=page.locator('[data-delivery="'+legacy+'"]');
    const copy=async(box,name,expected)=>{await page.evaluate(()=>{window.__copyResponseReady=false;window.__copied='';});await box.getByRole('button',{name,exact:true}).click();await page.waitForFunction(value=>window.__copied===value,expected);await box.getByText('Kopyalandı',{exact:true}).waitFor();};
    await fresh.locator('pre').waitFor();await legacyCard.locator('pre').waitFor();
    assert.equal(await legacyCard.locator('[data-copy-delivery-field]').count(),0);
    await copy(fresh,'E-poçt kopyala',email);await copy(fresh,'Şifrə kopyala',password);
    await copy(fresh,'Kopyala','E-poçt: '+email+'\nŞifrə: '+password+'\n\n'+sample);await copy(legacyCard,'Kopyala',ready);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const output=process.env.MIRPANEL_ORDER_SCREENSHOTS;
    if(output&&width!==320){fs.mkdirSync(output,{recursive:true});await page.locator('main').screenshot({path:path.join(output,width===1440?'mirpanel-order-live-desktop.png':'mirpanel-order-live-mobile.png')});}
    console.log('PASS live '+name+' — deployed files and exact clipboard values with synthetic data');continue;
   }
   await page.goto(origin+'/profil?tab=orders&order=9180');
   const card=page.locator('details.browser-order');
   await card.getByText('Yoxlanılır',{exact:true}).waitFor();assert.equal(await card.getAttribute('open'),'');
   const expiry=card.locator('.browser-order-expiry');
   assert.equal(await expiry.count(),0);
   assert.equal(await card.getByText('Alınmış hesablar',{exact:true}).count(),0);
   await card.locator('summary').click();assert.equal(await card.getAttribute('open'),null);
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),0);
   status='preparing';await card.locator('[data-status="preparing"]').waitFor();
   assert.equal(await expiry.count(),0);
   assert.equal(await card.locator('.browser-order-line').nth(0).locator('[data-delivery]').count(),1);
   assert.equal(await card.locator('.browser-order-line').nth(1).locator('[data-delivery]').count(),0);
   await page.waitForFunction(()=>Number(sessionStorage.getItem('played'))===1);
   status='completed';await card.locator('[data-status="completed"]').waitFor();
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),1);
   await page.reload();await card.locator('[data-status="completed"]').waitFor();assert.equal(await card.getAttribute('open'),'');
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),1);
   assert.equal(await card.getByText('7 gün zəmanət').count(),1);
   await expiry.getByText('Bu paketin müddəti təxminən 1 ay sonra bitir').waitFor();
   assert.equal(await expiry.locator('time').textContent(),'09.12.2026 · Bakı vaxtı');
   assert.equal(await expiry.count(),1);
   assert.equal(await card.locator('.browser-order-line').first().locator('.browser-order-warranty').count(),0);
   await page.route('https://synthetic.supabase.co/private.png',r=>r.fulfill({status:200,body:''}));
   const amountBox=await card.locator('.browser-order-total strong').boundingBox(),receiptBox=await card.locator('[data-receipt]').boundingBox();
   assert(receiptBox.y>=amountBox.y+amountBox.height&&Math.abs(receiptBox.x+receiptBox.width-amountBox.x-amountBox.width)<2);
   await page.route('https://guide.example.test/*.png',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(r.request().url().endsWith('/2.png')?'assets/logo.png':'assets/capcut.png')}));
   await card.getByRole('button',{name:'Qəbzə bax'}).click();await page.locator('#browserReceipt[open] img').waitFor({state:'attached'});await page.locator('#browserReceiptClose').click();assert.equal(receiptReads,1);
   await card.locator('pre:visible').first().waitFor();
   await card.locator('pre:visible').nth(1).waitFor();
   const actions=card.getByRole('button',{name:'Məlumat və təlimat'}),show=actions.first(),guide=page.locator('.browser-order-guide[open]');
   await actions.nth(1).click();await guide.getByText('İkinci məhsula aid qayda.').waitFor();
   await guide.getByRole('button',{name:'Təlimat',exact:true}).click();await guide.getByRole('button',{name:'Kompüterdə QR ilə giriş'}).waitFor();
   await guide.getByRole('button',{name:'Təlimatı bağla'}).click();await guide.waitFor({state:'hidden'});
   await show.click();await guide.getByText('Sintetik telefon qaydası.',{exact:false}).waitFor();await card.locator('pre').first().waitFor();
   await guide.getByRole('heading',{name:'Əsas qaydalar'}).waitFor();
   await guide.locator('ul li').getByText('Sintetik telefon qaydası.').waitFor();
   assert(await guide.locator('.browser-guide-body').evaluate(n=>{n.scrollTop=n.scrollHeight;return n.scrollTop>0;}));
   const footer=await guide.getByRole('button',{name:'Bağla',exact:true}).boundingBox();assert(footer.y+footer.height<=820);
   await guide.getByRole('button',{name:'Təlimat',exact:true}).click();
   await guide.getByRole('button',{name:'Telefonda giriş'}).waitFor();assert.equal(await guide.getByRole('button',{name:'Kompüterdə QR ilə giriş'}).count(),0);
   await guide.getByText('Tətbiqi açın.').waitFor();await guide.getByRole('button',{name:/Növbəti/}).click();await guide.getByText('Sınaq profilini seçin.').waitFor();
   assert.match(await guide.locator('img').getAttribute('src'),/2\.png$/);
   await guide.getByRole('button',{name:/Əvvəlki/}).click();await guide.getByText('Tətbiqi açın.').waitFor();
   const out=path.resolve('../../outputs/order-guide');fs.mkdirSync(out,{recursive:true});
   if(width!==320)await page.screenshot({path:path.join(out,width<600?'telimat-mobil.png':'telimat-desktop.png')});
   await guide.getByRole('button',{name:'Bağla',exact:true}).click();await guide.waitFor({state:'hidden'});
   await card.getByRole('heading',{name:'Alınmış hesablar'}).first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const fresh=card.locator('[data-delivery="'+delivery+'"]'),legacyCard=card.locator('[data-delivery="'+legacy+'"]');
   assert.equal(await card.getByRole('button',{name:'Gizlət',exact:true}).count(),0);
   const copy=async(box,name,expected)=>{await page.evaluate(()=>{window.__copyResponseReady=false;window.__copied='';});await box.getByRole('button',{name,exact:true}).click();await page.waitForFunction(value=>window.__copied===value,expected);await box.getByText('Kopyalandı',{exact:true}).waitFor();};
   await copy(fresh,'E-poçt kopyala',email);await copy(fresh,'Şifrə kopyala',password);
   await copy(fresh,'Kopyala','E-poçt: '+email+'\nŞifrə: '+password+'\n\n'+sample);
   assert.equal(await legacyCard.locator('[data-copy-delivery-field]').count(),0);assert.equal(await legacyCard.locator('pre').textContent(),ready);
   await copy(legacyCard,'Kopyala',ready);
   const again=card.getByRole('button',{name:'Yenidən al'}),repeatDialog=page.getByRole('dialog',{name:'Yenidən almaq'}),entry=page.locator('dialog.cart-entry');
   await again.nth(1).click();assert.equal(await repeatDialog.getByRole('button',{name:'Səbətə əlavə et'}).isDisabled(),true);await repeatDialog.getByRole('button',{name:'Ləğv et'}).click();
   available=0;await again.first().click();await repeatDialog.getByRole('button',{name:'Səbətə əlavə et'}).click();await entry.getByText('Bu paket hazırda stokda yoxdur.').waitFor();assert.equal(drafts,0);
   available=1;await entry.getByRole('button',{name:'Yenidən cəhd et'}).click();await entry.getByRole('checkbox').check();await entry.getByRole('button',{name:'Təsdiqləyirəm'}).click();
   await entry.getByLabel('Otaq adı').fill('Yeni otaq');await entry.getByRole('button',{name:'Davam et'}).click();
   await page.locator('.mir-cart-drawer[open]').waitFor();await page.getByText(/7[,.]25/).first().waitFor();
   assert.equal(drafts,1);assert.equal(payments,0);assert.equal(new URL(page.url()).pathname,'/profil');
   for(const [date,label] of [['2026-11-15','Bu paketin müddəti 6 gün sonra bitir'],['2026-11-08','Paketin müddəti bitib'],['2026-02-30',null],[null,null]]){
    expiresOn=date;await page.reload();await card.locator('[data-status="completed"]').waitFor();
    if(label)await expiry.getByText(label,{exact:true}).waitFor();else assert.equal(await expiry.count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
   expiresOn='2026-12-09';status='rejected';await page.reload();await card.locator('[data-status="rejected"]').waitFor();assert.equal(await card.getByText('Alınmış hesablar',{exact:true}).count(),0);assert.equal(await expiry.count(),0);
   await page.goto(origin+'/profil?tab=codes');await page.getByRole('heading',{name:'CapCut Pro'}).waitFor();
   const cap=page.locator('.codes-card').filter({hasText:'CapCut Pro'}),netflix=page.locator('.codes-card').filter({hasText:'Netflix Şəxsi'}),search=page.getByRole('searchbox');
   assert.equal(await page.locator('.codes-count').textContent(),'2 ədəd');
   await page.getByRole('button',{name:'Hamısı 2',exact:true}).waitFor();
   await page.getByRole('button',{name:'Video montajı 1',exact:true}).click();
   assert.equal(await netflix.isVisible(),false);
   await search.fill('NETFLIX');await page.getByText('Axtarışa uyğun məhsul tapılmadı.').waitFor();
   await page.getByRole('button',{name:'Film 1',exact:true}).click();assert.equal(await netflix.isVisible(),true);assert.equal(await cap.isVisible(),false);
   await search.clear();await page.getByRole('button',{name:'Hamısı 2',exact:true}).click();
   assert.equal(await cap.locator('time').getAttribute('datetime'),'2026-11-08T20:05:00.000Z');assert.match(await cap.locator('time').textContent(),/09.*00:05/);
   assert.equal(await cap.locator('.codes-details').isVisible(),false);
   await cap.getByRole('button',{name:'Göstər',exact:true}).click();await cap.getByText('İkinci sətir',{exact:false}).waitFor();
   assert.deepEqual(await cap.locator('.codes-credential strong').allTextContents(),['buyer@example.test','synthetic-only']);
   assert.equal(await cap.locator('pre').textContent(),sample);
   await cap.getByRole('button',{name:'Gizlət',exact:true}).click();assert.equal(await cap.locator('pre').textContent(),'');assert.equal(await cap.locator('.codes-credential').count(),0);
   await cap.getByRole('button',{name:'Kopyala',exact:true}).click();await cap.getByText('Məlumat kopyalandı').waitFor();
   assert.equal(await page.evaluate(()=>window.__copied),sample);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.env.MIRPANEL_ORDER_SCREENSHOTS&&width!==320){
    preview=true;status='completed';
    await page.goto(origin+'/profil?tab=orders');
    await card.getByRole('heading',{name:'Alınmış hesablar'}).first().waitFor();
    await card.locator('pre').first().waitFor();
    await card.locator('summary img').evaluate(async img=>img.decode());
    const output=process.env.MIRPANEL_ORDER_SCREENSHOTS;fs.mkdirSync(output,{recursive:true});
    await page.locator('main').screenshot({path:path.join(output,width===1440?'mirpanel-order-desktop.png':'mirpanel-order-mobile.png')});
    preview=false;
   }
   autoDelivered=true;status='completed';
   await page.goto(origin+'/profil?tab=orders&order=9180');
   await card.getByRole('heading',{name:'Alınmış hesablar'}).first().waitFor();
   await card.locator('pre').first().waitFor();
   status='preparing';
   await page.goto(origin+'/profil?tab=orders&order=9180');
   await card.locator('pre:visible').first().waitFor();
   assert.equal(await card.locator('.browser-order-line').first().getByRole('heading',{name:'Alınmış hesablar'}).isVisible(),true);
   assert.equal(await card.locator('.browser-order-line').nth(1).locator('pre').count(),0);
   status='completed';
   newerStatus='preparing';
   await page.goto(origin+'/profil?tab=orders');
   const old=page.locator('[data-order-code="9180"]'),newer=page.locator('[data-order-code="9181"]');
   await old.locator('pre:visible').first().waitFor();
   assert.equal(await old.getAttribute('open'),'');
   assert.equal(await newer.getAttribute('open'),null);
   await newer.locator('summary').click();
   assert.equal(await newer.locator('[data-delivery]').count(),0);
   await newer.locator('summary').click();
   newerStatus='completed';
   await page.locator('[data-order-code="9181"][open] [data-status="completed"]').waitFor();
   assert.equal(await old.getAttribute('open'),null);
   await page.goto(origin+'/profil?tab=orders&order=9180');
   await old.locator('pre:visible').first().waitFor();
   assert.equal(await newer.getAttribute('open'),null);
   newerStatus=null;
   await page.addInitScript(()=>sessionStorage.setItem('mirpanel.account.present','1'));
   realProfile=true;
   await page.goto(origin+'/');
   await page.waitForFunction(()=>window.MirpanelNavigation);
   const ordersLink=page.locator(width<600?'.browser-bottom-nav [data-browser-nav="orders"]':'.site-header-nav [data-browser-nav="orders"]');
   await ordersLink.waitFor();
   assert.equal(await ordersLink.getAttribute('href'),'/profil?tab=orders');
   const frames=[];
   const capture=frame=>{if(frame===page.mainFrame())frames.push(new URL(frame.url()).pathname+new URL(frame.url()).search);};
   page.on('framenavigated',capture);
   let release;
   const hold=new Promise(resolve=>{release=resolve;});
   const delayOrders=async route=>{await hold;await route.continue();};
   await page.route('**/api/payments/my-orders',delayOrders);
   try{
    await ordersLink.click();
    await page.waitForURL('**/profil?tab=orders');
    await page.locator('.account-panel').getByRole('heading',{name:'Sifarişlərim'}).waitFor();
    await page.locator('#browserOrders .account-tab-spinner').waitFor();
    assert.equal(await page.locator('.browser-orders-main').count(),0);
    assert.equal(await page.locator('#browserOrders').innerText(),'');
    assert.deepEqual([...new Set(frames)],['/profil?tab=orders']);
   }finally{release();}
   await page.locator('[data-order-code="9180"][open] pre:visible').first().waitFor();
   await page.unroute('**/api/payments/my-orders',delayOrders);
   await page.goBack();
   await page.getByRole('heading',{name:'Başlanğıc'}).waitFor();
   assert.equal(new URL(page.url()).pathname,'/');
   await page.goForward();
   await page.locator('[data-order-code="9180"][open] pre:visible').first().waitFor();
   assert.equal(new URL(page.url()).pathname,'/profil');
   newerStatus='completed';
   await page.goto(origin+'/profil?tab=orders&order=9180');
   await page.locator('[data-order-code="9180"][open] pre:visible').first().waitFor();
   assert.equal(new URL(page.url()).search,'?tab=orders&order=9180');
   assert.equal(await page.locator('[data-order-code="9181"]').getAttribute('open'),null);
   newerStatus=null;
   const gold=async selector=>{
    await page.waitForFunction(selector=>{
     const button=document.querySelector(selector);
     if(!button)return false;
     const style=getComputedStyle(button);
     return style.color==='rgb(10, 8, 5)'&&style.fontWeight==='800'&&style.backgroundImage.includes('linear-gradient')&&style.boxShadow!=='none';
    },selector);
   };
   await gold('.account-sidebar-topup');
   assert.equal(await page.locator('.account-sidebar-topup').isVisible(),width>=1000);
   await page.evaluate(()=>window.MirpanelNavigation?.go('/profil')??location.assign('/profil'));
   await gold('.profile-balance > button.primary');
   await page.getByRole('button',{name:'Balansı artır',exact:true}).waitFor();
   realProfile=false;
   page.off('framenavigated',capture);
   console.log('PASS '+name+' — status, deep link, protected receipt, private reveal and exact copy, repurchase/current price/fields');
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
