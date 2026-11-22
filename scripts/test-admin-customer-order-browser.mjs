import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import{chromium,webkit}from'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='http://localhost:45938',out='outputs/user-order-detail';await fs.mkdir(out,{recursive:true});
for(const engine of[chromium,webkit]){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of[320,390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copied=text}});});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let details=0,deny=false;
 const user={id:'synthetic',name:'Sınaq Müştərisi',memberNumber:'1234',orderCount:5};
 const orders=['completed','preparing','cancelled','preparing','completed'].map((status,n)=>({id:'00000000-0000-4000-8000-00000000000'+n,order_code:String(1001+n),product_title:'Uzun məhsul adı — sınaq',plan_name:'3 ay',amount:10,currency:'AZN',quantity:2,status,created_at:'2026-11-22T12:00:00Z',items:[{index:0,product:'Uzun məhsul adı — sınaq',package:'3 ay',quantity:2,unitCents:500}]}));
 const result=o=>({...o,statusLabel:{completed:'Tamamlandı',preparing:'Təhvil gözlənilir',cancelled:'Ləğv edildi'}[o.status],customer:user,payment:{method:'MirPanel balansı',status:'Ödəniş təsdiqlənib',confirmed:true},dates:{created:o.created_at,confirmed:o.created_at,delivered:o.created_at,completed:o.status==='completed'?o.created_at:null,cancelled:o.status==='cancelled'?o.created_at:null},items:o.items.map(x=>({...x,delivered:o.status==='completed'?2:1,cancelled:o.status==='cancelled'?1:0})),customerFields:[{index:0,fields:[{label:'E-poçt',value:'buyer@example.test',sensitive:false},{label:'Məhsul şifrəsi',value:'BUYER-SECRET',sensitive:true},{label:'Oyunçu ID-si',value:'0012',sensitive:false}]}],deliveries:[{id:'delivery',line:0,quantity:1,at:o.created_at,message:'Tarixi təlimat: [https://example.test/help].\nİkinci keçid http://example.test/code, <script>window.xss=true</script>',fields:[{label:'Təhvil e-poçtu',value:'delivered@example.test',sensitive:false},{label:'Təhvil şifrəsi',value:'DELIVERED-SECRET',sensitive:true}]}],cancellation:o.status==='cancelled'?{reason:'Sınaq ləğvi [https://example.test/reset].',refundStatus:'card_pending'}:null,refundedCents:0});
 await page.route(base+'/**',async route=>{const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><main id="root" style="margin:12px"></main><script type="module">import{mountUsers}from"/admin-wallet-users.js";window.end=await mountUsers({root:document.querySelector("#root"),alive:()=>true,call:async path=>{const r=await fetch("/api/admin/community"+path);if(!r.ok)throw Error("İcazə yoxdur");return r.json();}});</script>'});
  if(p.startsWith('/api/admin/community/')){
   if(p.endsWith('/users'))return route.fulfill({json:{users:[{...user,balanceCents:100,spentCents:500}],total:1}});
   if(p.endsWith('/users/synthetic'))return route.fulfill({json:{user,orders,totalCents:500,profile:{}}});
   if(p.includes('/orders/')){details++;if(deny)return route.fulfill({status:403,json:{error:'İcazə yoxdur'}});return route.fulfill({json:result(orders.find(o=>p.endsWith(o.id)))});}
   if(p.endsWith('/wallet'))return route.fulfill({json:{cents:100,items:[]}});return route.fulfill({json:{enabled:false}});
  }
  return route.fulfill({path:'mirpanel-admin/public'+p,contentType:p.endsWith('.css')?'text/css':'text/javascript'});
 });
 await page.goto(base);await page.locator('.wu-identity').click();await page.locator('[data-user-tab=orders]').click();
 assert.equal(details,0);assert.equal(await page.locator('.wu-order-card').count(),5);assert(!(await page.locator('.wu-order-list').innerText()).match(/reviewing|cancelled|preparing/));
 for(let i=0;i<5;i++){
  await page.locator('.wu-order-card').nth(i).click();const d=page.getByRole('dialog');await d.getByRole('heading',{name:'Sifariş və ödəniş',exact:true}).waitFor();
  assert.equal(await d.getByLabel('Məhsul şifrəsi',{exact:true}).getAttribute('type'),'password');assert.equal(await d.getByLabel('Təhvil şifrəsi',{exact:true}).getAttribute('type'),'password');
  await d.getByRole('button',{name:'Məhsul şifrəsi göstər',exact:true}).click();assert.equal(await d.getByLabel('Məhsul şifrəsi',{exact:true}).getAttribute('type'),'text');
  await d.getByRole('button',{name:'Məhsul şifrəsi gizlət',exact:true}).click();await d.getByRole('button',{name:'Oyunçu ID-si kopyala',exact:true}).click();assert.equal(await page.evaluate(()=>window.copied),'0012');
  await d.getByRole('button',{name:'Mesaj və təlimatı göstər'}).click();assert.deepEqual(await d.locator('pre a').evaluateAll(as=>as.map(a=>a.href)),['https://example.test/help','http://example.test/code']);assert.equal(await page.evaluate(()=>window.xss),undefined);if(i===2)assert.equal(await d.locator('.wu-order-section').last().locator('a').getAttribute('href'),'https://example.test/reset');
  assert.equal(await d.evaluate(e=>e.scrollWidth>e.clientWidth),false,'dialog overflow '+width);
  if(i===0)await d.screenshot({path:out+'/'+engine.name()+'-'+width+'.png'});
  await d.getByRole('button',{name:'← Sifarişlərə qayıt'}).click();await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.locator('dialog').count(),0,JSON.stringify(await page.locator('dialog').evaluateAll(es=>es.map(e=>({open:e.open,text:e.textContent.slice(0,100)})))));
 }
 await page.locator('[data-order-search]').fill('1002');await page.locator('[data-order-status]').selectOption('preparing');await page.locator('.wu-order-card').click();await page.getByRole('dialog').getByRole('heading',{name:'Sifariş və ödəniş',exact:true}).waitFor();await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.locator('[data-order-search]').inputValue(),'1002');assert.equal(await page.locator('[data-order-status]').inputValue(),'preparing');
 deny=true;await page.locator('.wu-order-card').click();await page.getByRole('dialog').getByText('İcazə yoxdur',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').locator('input').count(),0);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await page.close();console.log(JSON.stringify({engine:engine.name(),width,lazyDetails:true,secretsMasked:true,copyLeadingZero:true,safeLinks:true,backPreservesFilters:true,statusCases:5,denial:true}));
 }}finally{await browser.close();}}
