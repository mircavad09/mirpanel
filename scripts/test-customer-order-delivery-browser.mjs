import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const sample='E-poçt: buyer@example.test\nŞifrə: synthetic-only\n\nİkinci sətir ✨\n  Son sətir';
const order='12345678-1234-4234-8234-000000000001',delivery='12345678-1234-4234-8234-000000000002';
const repeat={productId:'synthetic',title:'Synthetic first',planIndex:0,planName:'1 ay'};
const price=725,field={key:'room',label:'Otaq adı',type:'text',required:true,minLength:1,maxLength:40};
let status='reviewing',reveals=0,available=1,drafts=0,payments=0,receiptReads=0,expiresOn,preview=false,autoDelivered=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=body=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(body));};
 if(u.pathname==='/api/payments/my-orders'){
  assert.equal(u.searchParams.get('order'),'9180');
  const items=[{title:'CapCut Pro',quantity:1,planName:'1 aylıq (Telefon)',unitCents:500,repeat,expiresOn,image:'/assets/capcut.png'}];
  if(!preview)items.push({title:'Əlavə sınaq paketi',quantity:1,planName:'1 aylıq uzun paket adı — uzun sətir üçün sınaq',unitCents:600,warranty:'7 gün zəmanət'});
  return json({orders:[{id:order,orderCode:'9180',product:'CapCut Pro · Sınaq sifarişi',amount:preview?5:11,status,autoDelivered,createdAt:'2026-11-08T09:03:00Z',receiptAvailable:true,items,deliveries:[{id:delivery,line:0,quantity:1}]}],nextCursor:null});
 }
 if(u.pathname==='/api/payments/my-orders/codes')return json({codes:[
  {id:delivery,title:'CapCut Pro',plan:'1 ay',image:'/assets/capcut.png',quantity:1,purchasedAt:'2026-11-08T20:05:00Z',category:{key:'video',label:'Video montajı'}},
  {id:'12345678-1234-4234-8234-000000000003',title:'Netflix Şəxsi',plan:'7 gün',quantity:1,purchasedAt:'2026-11-08T09:05:00Z',category:{key:'film',label:'Film'}}
 ]});
 if(u.pathname==='/api/payments/my-orders/codes/'+delivery){reveals++;return json({text:sample});}
 if(u.pathname==='/api/payments/my-orders/'+order+'/receipt'){receiptReads++;return json({mime:'image/png',url:'https://synthetic.supabase.co/private.png'});}
 if(u.pathname==='/api/payments/shop/quote')return json({items:[{...repeat,terms:'Yeni şərtlər',termsVersion:'current',unitCents:price,available,fields:[field]}],totalCents:price,balanceCents:10000});
 if(u.pathname==='/api/payments/shop/drafts')return json({items:[]});
 if(u.pathname==='/api/payments/shop/draft'){let body='';for await(const c of req)body+=c;const x=JSON.parse(body);drafts++;assert.deepEqual(x.values,{room:'Yeni otaq'});return json({...repeat,draftId:x.id,lineId:x.id,termsVersion:x.termsVersion,unitCents:price});}
 if(u.pathname==='/api/payments/shop/checkout'){payments++;return json({});}
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
try{
 for(const [engine,name,width]of [[chromium,'Chrome desktop',1440],[chromium,'Chrome mobil ölçü',320],[webkit,'WebKit mobil ölçü',390]]){
  status='reviewing';reveals=drafts=payments=receiptReads=0;available=1;expiresOn='2026-12-09';autoDelivered=false;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const page=await browser.newPage({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
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
   await page.goto(origin+'/profil?tab=orders&order=9180');
   const card=page.locator('details.browser-order');
   await card.getByText('Yoxlanılır').waitFor();assert.equal(await card.getAttribute('open'),'');
   const expiry=card.locator('.browser-order-expiry');
   assert.equal(await expiry.count(),0);
   assert.equal(await card.getByText('Alınmış hesablar',{exact:true}).count(),0);
   await card.locator('summary').click();assert.equal(await card.getAttribute('open'),null);
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),0);
   status='preparing';await card.getByText('Hazırlanır').waitFor();
   assert.equal(await expiry.count(),0);
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
   await card.getByRole('button',{name:'Qəbzə bax'}).click();await page.locator('#browserReceipt[open] img').waitFor({state:'attached'});await page.locator('#browserReceiptClose').click();assert.equal(receiptReads,1);
   const show=card.getByRole('button',{name:'Məlumat və təlimat'}).first();
   await show.click();await card.getByText('İkinci sətir',{exact:false}).waitFor();
   await card.getByRole('heading',{name:'Alınmış hesablar'}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await card.getByRole('button',{name:'Gizlət',exact:true}).click();assert.equal(await card.locator('pre').textContent(),'');
   assert.equal(reveals,1);
   await card.getByRole('button',{name:'Kopyala',exact:true}).click();await card.getByText('Məlumat kopyalandı').waitFor();assert.equal(await page.evaluate(()=>window.__copied),sample);
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
   expiresOn='2026-12-09';status='rejected';await page.reload();await card.getByText('Rədd edildi').waitFor();assert.equal(await card.getByText('Alınmış hesablar',{exact:true}).count(),0);assert.equal(await expiry.count(),0);
   await page.goto(origin+'/profil?tab=codes');await page.getByRole('heading',{name:'CapCut Pro'}).waitFor();assert.equal(reveals,2);
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
    await page.goto(origin+'/profil?tab=orders&order=9180');await show.click();
    await card.getByRole('heading',{name:'Alınmış hesablar'}).waitFor();
    await card.getByText('İkinci sətir',{exact:false}).waitFor();
    await card.locator('summary img').evaluate(async img=>img.decode());
    const output=process.env.MIRPANEL_ORDER_SCREENSHOTS;fs.mkdirSync(output,{recursive:true});
    await page.locator('main').screenshot({path:path.join(output,width===1440?'mirpanel-order-desktop.png':'mirpanel-order-mobile.png')});
    preview=false;
   }
   autoDelivered=true;status='completed';
   await page.goto(origin+'/profil?tab=orders&order=9180');
   await card.getByRole('heading',{name:'Alınmış hesablar'}).waitFor();
   await card.getByText('İkinci sətir',{exact:false}).waitFor();
   console.log('PASS '+name+' — status, deep link, protected receipt, private reveal and exact copy, repurchase/current price/fields');
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
