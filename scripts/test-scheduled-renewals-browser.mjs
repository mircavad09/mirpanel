import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='outputs/scheduled-renewals';fs.mkdirSync(out,{recursive:true});
const source='12345678-1234-4234-8234-000000000001';let created=[],renewals=[];
const row={id:source,orderCode:'SINAQ-1001',sourceLine:1,productId:'capcut',title:'CapCut Pro',plan:'7 gün',days:3,progress:42,expiresOn:'2026-11-25',renewalCents:112,options:[{index:0,key:'7days',label:'7 gün',cents:112,canRenew:true},{index:1,key:'month',label:'1 Ay (endirim) — uzun paket adı',cents:499,canRenew:true}]};
const renew={id:source,sourceId:source,sourceOrderCode:'SINAQ-1001',title:'CapCut Pro',plan:'7 gün',cents:112,dueAt:'2026-11-25T20:00:00.000Z',state:'paid_waiting',status:'Ödənilib — yenilənmə tarixi gözlənilir',customer:'Sınaq müştərisi',customerId:99999};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
 if(u.pathname==='/api/payments/shop/subscriptions')return json({accountId:'synthetic',subscriptions:[row],renewals});
 if(u.pathname==='/api/payments/shop/renewal'){const parts=[];for await(const p of req)parts.push(p);const b=JSON.parse(Buffer.concat(parts));if(b.action==='quote')return json({cents:b.planIndex===0?112:499,dueAt:renew.dueAt,method:'new_account',plan:b.planIndex===0?'7 gün':'1 Ay (endirim)'});created.push(b);renewals=[renew];return json(renew);}
 if(u.pathname==='/api/admin/community/renewals')return json({rows:[{...renew,...(u.searchParams.get('filter')==='delivery'?{state:'awaiting_delivery',status:'Ödənilib — hesab təhvili gözlənilir',orderCode:'SINAQ-1002'}:{})}],total:1,page:1,pages:1,pollSeconds:30,policies:[{productId:'capcut',title:'CapCut Pro',plan:'7 gün',planIndex:0,method:'new_account'},{productId:'netflix',title:'Netflix Şəxsi',plan:'1 ay',planIndex:0,method:'extend_existing'}]});
 if(u.pathname==='/profil'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html lang="az"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/account-panel.css"><body class="profile-screen"><main id="communityApp"><p style="color:#ffd600">İzolyasiya edilmiş sınaq — real ödəniş yoxdur</p><div id="app"></div></main><script type="module">
   import {mountSubscriptions} from '/community-assets/account-subscriptions.js';
   const el=(tag,a={},...children)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(a))if(v!==undefined)e.setAttribute(k,String(v));e.append(...children.flat().filter(v=>v!=null));return e;};
   const button=(text,fn)=>{const e=el('button',{type:'button'},text);e.onclick=fn;return e;};
   const api=async(url,data)=>{const r=await fetch(url,{method:data?'POST':'GET',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return r.json();};
   mountSubscriptions({content:document.querySelector('#app'),el,button,link:(text,href)=>el('a',{href},text),api,validate:d=>{if(d.accountId!=='synthetic')throw Error();}});
  </script></body></html>`);
 }
 if(u.pathname==='/admin'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html lang="az"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin.css"><body style="padding:12px"><main><p>İzolyasiya edilmiş sınaq — real müştəri məlumatı yoxdur</p><section id="paymentOrdersView"><button data-payment-order-tab="expiring">Bitən məhsullar</button><div id="paymentOrdersStatus"></div><div id="paymentOrdersList"></div></section></main><script>window.toast=console.log;window.api=async(url)=>{if(url.startsWith('/api/admin/community/renewals'))return fetch(url).then(r=>r.json());return {orders:[],counts:{},filters:{products:[],plans:[],methods:[]},pagination:{page:1,totalPages:1},permissions:{},selection:{ids:[]}};};</script><script src="/payment-admin.js"></script></body></html>`);
 }
 let file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):'mirpanel-admin/public/'+u.pathname.slice(1);
 if(fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));}res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,430,1440]){
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});const errors=[];page.on('pageerror',e=>errors.push(e.message));created=[];renewals=[];
  await page.goto(base+'/profil');await page.getByRole('button',{name:'Yenilə',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Yenilənməni planlaşdır'});await modal.getByRole('button',{name:'7 gün 1,12 ₼'}).click();await modal.getByText('Planlaşdırılan başlanğıc:',{exact:false}).waitFor();
  const next=modal.getByRole('button',{name:'Yenilənməni təsdiqlə'});assert(await next.isDisabled());await modal.getByRole('checkbox').check();assert(!await next.isDisabled());
  assert.equal(await modal.locator('input:not([type=checkbox])').count(),0);
  assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth));
  if(engine===chromium&&[390,1440].includes(width))await page.screenshot({path:out+'/customer-'+width+'.png',fullPage:true});
  await next.click();await page.locator('.subs-renewal-history').getByText(renew.status,{exact:true}).waitFor();assert.equal(created.length,1);assert.equal(created[0].mode,'prepaid');assert.equal(created[0].expectedCents,112);
  await page.goto(base+'/admin');await page.getByRole('button',{name:'Bitən məhsullar',exact:true}).click();await page.getByRole('heading',{name:'Müddətli məhsul yenilənmələri'}).waitFor();
  await page.getByRole('button',{name:'Ödənilib — təhvil gözlənilir',exact:true}).click();await page.getByText('Ödənilib — hesab təhvili gözlənilir · Yeni № SINAQ-1002',{exact:true}).waitFor();
  await page.getByText('Məhsul və paket üzrə yenilənmə qaydaları',{exact:true}).click();assert.equal(await page.locator('[data-renewal-policy]').first().inputValue(),'new_account');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(engine===chromium&&[390,1440].includes(width))await page.screenshot({path:out+'/admin-'+width+'.png',fullPage:true});
  assert.deepEqual(errors,[]);await page.close();console.log('PASS '+engine.name()+' '+width+'px: renewal consent, price/start, prepay, admin filters/policy, no overflow');
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
