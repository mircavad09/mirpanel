import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';
import {createBankBackgrounds,bankKey,normalizeBankBackground,BANKS} from '../mirpanel-admin/bank-backgrounds.mjs';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {receiptFixture} from './receipt-gate-fixture.mjs';
import {onRequest} from '../functions/api/payments/[[path]].js';
const sharp=createRequire(import.meta.url)('../receipt-worker/node_modules/sharp');
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'mirpanel-bank-')),out='payment-test-artifacts/bank-backgrounds';fs.mkdirSync(out,{recursive:true});
// Isolated filesystem Storage adapter: actual decoder, bytes, HTTP and browser;
// no production objects or customer/reservation data are used.
let failUpload=false,failList=false;
const storage={async list(){if(failList)return{error:{}};return{data:fs.readdirSync(root).map(name=>({name,updated_at:fs.statSync(path.join(root,name)).mtimeMs.toString()}))};},async upload(p,b){if(failUpload)return{error:{}};fs.writeFileSync(path.join(root,path.basename(p)),b);return{};},async remove(paths){for(const p of paths)fs.rmSync(path.join(root,path.basename(p)),{force:true});return{};},async download(p){try{return{data:new Blob([fs.readFileSync(path.join(root,path.basename(p)))])};}catch{return{error:{statusCode:404}};}}};
const client={storage:{from:()=>storage}};let backgrounds=createBankBackgrounds(client),browser,fixture;
const fixtureNames={kapital:'85f20294-07f1-4646-93da-90271bf2d259',m10:'acdd3954-6c17-47c3-992d-31afab561b00',abb:'88051075-451a-4e2e-91c6-99cd6f2b5b32',leo:'7aae1301-10da-4ed5-adab-eb51f9f25fa6'};
const samples={};for(const[k,n]of Object.entries(fixtureNames)){const f='C:/Users/user/AppData/Local/Temp/codex-clipboard-'+n+'.png';samples[k]=fs.existsSync(f)?fs.readFileSync(f):await sharp({create:{width:1000,height:625,channels:3,background:{kapital:'#650a15',m10:'#10baa7',abb:'#123aab',leo:'#292929'}[k]}}).png().toBuffer();}
const bankIds={kapital:'10000000-0000-4000-8000-000000000001',m10:'10000000-0000-4000-8000-000000000002',leo:'10000000-0000-4000-8000-000000000003'};
try{
 eq(await backgrounds.list(),{});eq(bankKey({provider_name:'Birbank'}),'kapital');eq(bankKey({providerName:'Kapital Bank'}),'kapital');
 for(const [k,bytes]of Object.entries(samples)){
  const r=await backgrounds.write(k,bytes,'image/png');eq(r[k].startsWith('/api/payments/bank-backgrounds/'+k+'?v='),true);
  const m=await sharp((await backgrounds.image(k)).bytes).metadata();eq(m.format,'webp');eq(m.width<=1600&&m.height<=1000,true);
  eq((await backgrounds.decorate({id:'existing',theme:k})).backgroundUrl,(await backgrounds.decorate({id:'future',theme:k})).backgroundUrl);
 }
 backgrounds=createBankBackgrounds(client);eq(Object.keys(await backgrounds.list()).length,4,'restart persistence');
 for(const format of ['jpeg','png','webp']){const b=await sharp({create:{width:600,height:350,channels:3,background:'#163352'}}).toFormat(format).toBuffer();const normalized=await normalizeBankBackground(b,'image/'+format);eq((await sharp(normalized).metadata()).format,'webp');}
 for(const [b,mime,status]of [[Buffer.from('<svg><script/></svg>'),'image/png',422],[Buffer.from('bad'),'image/jpeg',422],[Buffer.alloc(5242881),'image/png',413],[samples.abb,'image/svg+xml',415]]){await assert.rejects(()=>normalizeBankBackground(b,mime),e=>e.status===status);checks++;}
 const huge=await sharp({create:{width:4100,height:4100,channels:3,background:'#111'}}).png().toBuffer();await assert.rejects(()=>normalizeBankBackground(huge,'image/png'),e=>e.status===422);checks++;
 const old=(await backgrounds.image('abb')).etag;failUpload=true;await assert.rejects(()=>backgrounds.write('abb',samples.leo,'image/png'));checks++;failUpload=false;eq((await backgrounds.image('abb')).etag,old);
 const oldUrl=(await backgrounds.list()).abb;await backgrounds.write('abb',samples.leo,'image/png');eq((await backgrounds.list()).abb!==oldUrl,true);eq((await backgrounds.image('abb')).etag!==old,true);await backgrounds.write('abb',samples.abb,'image/png');
 await backgrounds.remove('leo');eq((await backgrounds.decorate({theme:'leo'})).backgroundUrl,'');eq(Boolean((await backgrounds.list()).abb),true);await backgrounds.write('leo',samples.leo,'image/png');
 const concurrent=backgrounds.write('leo',samples.leo,'image/png');await assert.rejects(()=>backgrounds.write('leo',samples.abb,'image/png'),e=>e.status===409);checks++;await concurrent;
 fixture=await receiptFixture({createSystem:opts=>{
  const original=opts.store.publicMethods;opts.store.publicMethods=async()=>Object.keys(BANKS).map(k=>({id:k==='abb'?fixtureId:bankIds[k],providerName:BANKS[k],resolvedTheme:k,type:'bank_card',last4:'1234',available:true}));
  let fixtureId;original().then(m=>fixtureId=m[0].id);
  const raw=opts.store.rawMethod;opts.store.rawMethod=async id=>{const k=Object.keys(bankIds).find(k=>bankIds[k]===id)||'abb';return{...await raw(id),provider_name:BANKS[k],theme:k};};
  opts.store.adminMethods=async()=>[];opts.store.getSettings=async()=>({});
  const auth=(req,res)=>{if(req.headers['x-test-role']==='owner')return true;opts.json(res,req.headers['x-test-role']?403:401,{error:'İcazə yoxdur'});return false;};
  return createPaymentSystem({...opts,bankBackgrounds:backgrounds,requireAuth:auth,requireMutationAuth:(req,res)=>{if(!auth(req,res))return false;if(req.headers['x-csrf-token']!=='synthetic'){opts.json(res,403,{error:'CSRF'});return false;}return true;}});
 }});
 const call=async(p,options={})=>fetch(fixture.origin+p,options),admin='/api/admin/payment-bank-backgrounds';
 for(const role of ['', 'employee','customer']){eq((await call(admin,{headers:{'x-test-role':role}})).status,role?403:401);eq((await call(admin+'/abb',{method:'POST',headers:{'x-test-role':role,'Content-Type':'image/png'},body:samples.abb})).status,role?403:401);}
 eq((await call(admin+'/abb',{method:'POST',headers:{'x-test-role':'owner','Content-Type':'image/png'},body:samples.abb})).status,403);
 const ah={'x-test-role':'owner','x-csrf-token':'synthetic','Content-Type':'image/png'};
 eq((await call(admin+'/abb',{method:'POST',headers:ah,body:samples.abb})).status,200);
 eq((await call(admin+'/abb',{method:'POST',headers:ah,body:'not an image'})).status,422);
 const image=await call((await backgrounds.list()).abb);eq(image.status,200);eq(image.headers.get('content-type'),'image/webp');eq((await call((await backgrounds.list()).abb,{headers:{'If-None-Match':image.headers.get('etag')}})).status,304);
 const originalFetch=globalThis.fetch;let forwarded;
 try{globalThis.fetch=async(u,o)=>{forwarded=o.headers;const headers=new Headers(o.headers);headers.set('Origin',fixture.origin);return originalFetch(fixture.origin+new URL(u).pathname+new URL(u).search,{...o,headers});};
  const proxied=await onRequest({request:new Request('https://mirpanel.com'+(await backgrounds.list()).abb,{headers:{Cookie:'mirpanel_owner.session_token=synthetic; mirpanel_session=admin-secret-not-forwarded'}})});
  eq(proxied.status,200);eq(proxied.headers.get('cache-control'),'public, max-age=3600');eq(forwarded.has('Cookie'),false);eq(proxied.headers.has('Set-Cookie'),false);eq((await proxied.arrayBuffer()).byteLength,(await backgrounds.image('abb')).bytes.length);
  eq((await onRequest({request:new Request('https://mirpanel.com/api/admin/payment-bank-backgrounds')})).status,404);
  eq((await onRequest({request:new Request('https://mirpanel.com/api/payments/bank-backgrounds/abb',{headers:{Origin:'https://evil.invalid'}})})).status,403);
 }finally{globalThis.fetch=originalFetch;}
 const methods=(await(await call('/api/payments/methods')).json()).methods;eq(methods.length,4);eq(methods.every(m=>Boolean(m.backgroundUrl)),true);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,360,390,430,1440]){
  await page.setViewportSize({width,height:width===320?620:900});await page.goto(fixture.origin);await page.locator('.paymentBankBackground').first().waitFor();
  eq(await page.locator('.paymentMethodChoice.hasBankBackground').count(),4);
  eq(await page.locator('.paymentMethodChoice.hasBankBackground>span').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).display==='none')),true);
  eq(await page.locator('.paymentMethodChoice.hasBankBackground').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect(),type=n.querySelector('small').getBoundingClientRect();return type.top>=r.top+45;})),true);
  eq(await page.locator('.paymentBankBackground').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().then(()=>true)))),[true,true,true,true]);
  eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if([390,1440].includes(width))await page.screenshot({path:out+'/selection-'+width+'.png'});
  await page.locator('[data-payment-method="'+fixture.methodId+'"]').click();
  eq(await page.locator('.paymentMethodChoice.selected').evaluate(n=>getComputedStyle(n).borderTopWidth),'2px');
  eq(await page.locator('.paymentMethodChoice.selected i').isVisible(),true);
  if([390,1440].includes(width))await page.screenshot({path:out+'/selection-selected-'+width+'.png'});
  await page.locator('#paymentMethodContinue').click();await page.locator('.paymentSelectedCard.hasBankBackground').waitFor();
  eq(await page.locator('.paymentSelectedCard .paymentBankBackground').getAttribute('src'),(await backgrounds.list()).abb);
  eq(await page.locator('.paymentSelectedCard .paymentBankBackground').evaluate(i=>getComputedStyle(i).objectFit),'contain');
  eq(await page.locator('.paymentSelectedTop>div:first-child').isVisible(),false);
  eq(await page.locator('.paymentSelectedCard').evaluate(n=>{const card=n.getBoundingClientRect(),holder=n.querySelector('.paymentHolder').getBoundingClientRect(),amount=n.querySelector('.paymentAmount').getBoundingClientRect(),number=n.querySelector('.paymentNumber').getBoundingClientRect(),timer=n.querySelector('.paymentReservationFooter').getBoundingClientRect(),change=n.querySelector('#changePaymentMethod').getBoundingClientRect();return holder.top>=card.top+55&&holder.right<=amount.left+1&&number.top>=Math.max(holder.bottom,amount.bottom)&&timer.top>=number.bottom&&timer.bottom<=card.bottom&&change.right<=card.right;}),true);
  eq(await page.locator('.paymentHolder strong').textContent(),'TEST ONLY');eq(await page.locator('#paymentReservationCountdown').isVisible(),true);
  await page.locator('#copyPaymentNumber').click();eq(await page.evaluate(()=>navigator.clipboard.readText()),'4169 0000 0000 4655');
  eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if([390,1440].includes(width))await page.screenshot({path:out+'/details-'+width+'.png'});
  await page.locator('.paymentHolder strong').evaluate(n=>n.textContent='Sintetik Uzun Ad Soyad Test Nümunəsi');
  eq(await page.locator('.paymentSelectedCard').evaluate(n=>{const holder=n.querySelector('.paymentHolder').getBoundingClientRect(),number=n.querySelector('.paymentNumber').getBoundingClientRect(),card=n.getBoundingClientRect();return number.top>=holder.bottom&&n.scrollWidth<=n.clientWidth&&n.querySelector('.paymentReservationFooter').getBoundingClientRect().bottom<=card.bottom;}),true);
  await page.evaluate(()=>sessionStorage.clear());
 }
 for(const k of ['kapital','m10','leo']){await page.setViewportSize({width:390,height:900});await page.goto(fixture.origin);await page.locator('[data-payment-method="'+bankIds[k]+'"]').click();await page.locator('#paymentMethodContinue').click();await page.locator('.paymentSelectedCard.hasBankBackground').waitFor();eq(await page.locator('.paymentSelectedCard .paymentBankBackground').getAttribute('src'),(await backgrounds.list())[k]);eq(await page.locator('.paymentSelectedTop strong').textContent(),BANKS[k]);await page.screenshot({path:out+'/details-'+k+'-390.png'});await page.evaluate(()=>sessionStorage.clear());}
 // Run the actual admin UI against the same HTTP upload endpoints.
 await page.route('**/admin-test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin-test.css"><body style="margin:0;padding:12px;background:#121416;color:#fff"><button class="navBtn" data-view="paymentMethods">Ödəniş üsulları</button><div id="paymentMethodsList"></div><div id="paymentMethodEditor"></div><div id="paymentOrdersView" class="hidden"></div><div id="paymentReviewsView" class="hidden"></div><p id="notice"></p><script>window.toast=m=>document.getElementById('notice').textContent=m;window.api=async(p,o={})=>{const r=await fetch(p,{...o,headers:{'x-test-role':'owner','x-csrf-token':'synthetic',...o.headers}}),v=await r.json();if(!r.ok)throw Error(v.error);return v;};</script><script src="/admin-test.js"></script></body></html>`}));
 await page.route('**/admin-test.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('mirpanel-admin/public/payment-admin.js','utf8')}));
 await page.route('**/admin-test.css',r=>r.fulfill({contentType:'text/css',body:fs.readFileSync('mirpanel-admin/public/admin.css','utf8')}));
 await page.route('**/api/admin/payment-orders?*',r=>r.fulfill({json:{counts:{}}}));
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.goto(fixture.origin+'/admin-test');await page.locator('.navBtn').click();await page.locator('[data-bank-background="abb"]').waitFor();await page.waitForFunction(()=>document.querySelectorAll('#paymentBankBackgrounds img').length===4);
  eq(await page.locator('[data-bank-background]').count(),4);eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-bank-background="abb"]').setInputFiles({name:'abb.png',mimeType:'image/png',buffer:samples.abb});await page.getByText('Bank fonu saxlanıldı.',{exact:true}).waitFor();
  eq((await backgrounds.list()).abb.length>0,true);await page.screenshot({path:out+'/admin-'+width+'.png',fullPage:true});
  await page.locator('[data-bank-background-remove="abb"]').click();await page.getByText('Bank fonu silindi.',{exact:true}).waitFor();eq((await backgrounds.decorate({theme:'abb'})).backgroundUrl,'');
  await page.locator('[data-bank-background="abb"]').setInputFiles({name:'abb.webp',mimeType:'image/webp',buffer:await sharp(samples.abb).webp().toBuffer()});await page.getByText('Bank fonu saxlanıldı.',{exact:true}).waitFor();
  await page.reload();await page.locator('.navBtn').click();await page.waitForFunction(()=>document.querySelectorAll('#paymentBankBackgrounds img').length===4);eq(await page.locator('#paymentBankBackgrounds img').count(),4);
 }
 eq(errors,[]);eq(fixture.state.orderCalls,0);eq(fixture.state.uploadCalls,0);
 failList=true;const fallback=createBankBackgrounds(client);await assert.rejects(()=>fallback.list());checks++;failList=false;
 console.log(JSON.stringify({checks,failures:0,widths:[320,360,390,430,1440],storage:'isolated filesystem adapter',realDecoder:true,realPaymentHttp:true,productionWrites:0}));
}finally{await browser?.close();if(fixture)await new Promise(r=>fixture.server.close(r));fs.rmSync(root,{recursive:true,force:true});}
