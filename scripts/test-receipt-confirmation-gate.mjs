import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {receiptFixture} from './receipt-gate-fixture.mjs';
import {createPaymentStore} from '../mirpanel-admin/payment-store.mjs';
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const sharp=createRequire(import.meta.url)(path.join(process.env.MIRPANEL_NODE_MODULES,'sharp'));
const fixture=await receiptFixture(),{state,origin,orders,files,reservations}=fixture;
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const pic=sharp({create:{width:12,height:12,channels:3,background:'#cccccc'}}),jpg=await pic.clone().jpeg().toBuffer();
const receipts=[{name:'receipt.jpg',mimeType:'image/jpeg',buffer:jpg},{name:'receipt.png',mimeType:'image/png',buffer:await pic.clone().png().toBuffer()},{name:'receipt.webp',mimeType:'image/webp',buffer:await pic.clone().webp().toBuffer()},{name:'receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n%%EOF')}];
const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
const errors=[],checks=[];
let popups=0;
async function open(w=390,h=844,before=false,shortTimeout=false){
 const page=await browser.newPage({viewport:{width:w,height:h},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.on('popup',()=>popups++);
 await page.addInitScript(()=>Object.defineProperty(globalThis,'FileReader',{value:undefined,configurable:true}));
 await page.context().grantPermissions(['clipboard-write','clipboard-read']);
 if(shortTimeout)await page.addInitScript(()=>{const Base=XMLHttpRequest;window.__receiptTimeouts=0;window.XMLHttpRequest=class extends Base{constructor(){super();this.addEventListener('timeout',()=>window.__receiptTimeouts++);}set timeout(value){super.timeout=value===120000?80:value;}get timeout(){return super.timeout;}};});
 await page.goto(origin+(before?'/?before':'/'),{waitUntil:'networkidle'});await page.click('[data-payment-method]');
 if(!before)await page.click('#paymentMethodContinue');
 await page.waitForSelector('#paymentReceiptInput',{state:'attached'});return page;
}
async function ready(page){await page.waitForSelector('.paymentReceiptSuccess');assert.equal(await page.isDisabled('#paymentSubmit'),false);assert.equal(await page.textContent('.paymentReceiptSuccess'),'✓ Çek uğurla əlavə edildi');assert.equal(await page.getAttribute('[aria-current="step"]','data-receipt-step'),'3');}
async function layout(page,w,h){
 const value=await page.evaluate(()=>{const actions=document.querySelector('.paymentSubmitActions').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,buttonsVisible:actions.top>=0&&actions.bottom<=innerHeight,hitAreas:[...document.querySelectorAll('.paymentSubmitActions button')].every(e=>e.getBoundingClientRect().height>=44),scale:visualViewport.scale};});
 assert.equal(value.overflow,0);assert.equal(value.buttonsVisible,true,`${w}x${h} actions offscreen`);assert.equal(value.hitAreas,true);assert.equal(value.scale,1);return value;
}
try{
 const confirmation=fs.readFileSync('order-confirmation.js','utf8');
 const legacy=confirmation.slice(confirmation.indexOf('function patchLegacySendWhatsApp()'),confirmation.indexOf('document.addEventListener(',confirmation.indexOf('function patchLegacySendWhatsApp()')));
 assert.match(legacy,/return runOrderFlow\(product, plan\)/);assert.doesNotMatch(legacy,/original\.call|window\.open/);
 const storageStore=createPaymentStore({supabaseUrl:origin,supabaseSecretKey:'test-only',receiptsBucket:'private-test'});
 const removed=[],linked=`pending/${crypto.randomUUID()}/linked.jpg`;
 storageStore.client.from=()=>({select(){return this;},lt(){return this;},order(){return this;},async limit(){return{data:[{id:linked.split('/')[1]}],error:null};}});
 storageStore.client.storage.from=()=>({async list(prefix){return{data:prefix==='pending'?[{name:linked.split('/')[1]}]:[{name:'linked.jpg',created_at:'2020-01-01',metadata:{size:3}},{name:'orphan.jpg',created_at:'2020-01-01',metadata:{size:4}}]};},async remove(paths){removed.push(...paths);return{error:null};}});
 storageStore.getOrderByReservation=async()=>({receipt_path:linked});
 await storageStore.verifyUploadedReceipt(linked,3);await assert.rejects(()=>storageStore.verifyUploadedReceipt(linked,9),/təsdiqlənmədi/);
 assert.equal(await storageStore.cleanupStagedReceipts(),1);assert.deepEqual(removed,[linked.replace('linked.jpg','orphan.jpg')]);
 // Actual API: no browser MIME trust, encrypted capability tied to one checkout.
 const reservationId=crypto.randomUUID(),checkoutKey=crypto.randomUUID(),uploadKey=crypto.randomUUID();
 reservations.set(reservationId,{id:reservationId,checkout_key:checkoutKey,product_id:'test',plan_id:'0',status:'reserved',expires_at:new Date(Date.now()+600000).toISOString()});
 const post=async(data)=>fetch(origin+'/api/payments/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':uploadKey},body:JSON.stringify({reservationId,checkoutKey,productId:'test',planIndex:0,consentAccepted:true,...data})});
 assert.equal((await post({})).status,400);
 const form=new FormData();for(const [key,value]of Object.entries({reservationId,checkoutKey,productId:'test',planIndex:'0',consentAccepted:'true'}))form.append(key,value);form.append('receipt',new Blob([jpg],{type:'image/jpeg'}),'receipt.jpg');
 const uploaded=await fetch(origin+'/api/payments/receipts',{method:'POST',headers:{'X-Idempotency-Key':uploadKey},body:form});assert.equal(uploaded.status,200);
 const proof=await uploaded.json();assert.equal(proof.receiptUploaded,true);assert.equal(orders.size,0);assert.equal(proof.url,undefined);
 const claims=JSON.parse(fixture.security.decryptSecret(proof.receiptUploadToken));assert.ok(files.has(claims.path));
 assert.equal((await post({receiptUploadToken:proof.receiptUploadToken+'x'})).status,400);
 assert.equal((await post({checkoutKey:crypto.randomUUID(),receiptUploadToken:proof.receiptUploadToken})).status,400);
 assert.equal((await post({receiptUploadToken:fixture.security.encryptSecret(JSON.stringify({...claims,expiresAt:1}))})).status,400);
 files.delete(claims.path);assert.equal((await post({receiptUploadToken:proof.receiptUploadToken})).status,409);
 const uploadAgain=await fetch(origin+'/api/payments/receipts',{method:'POST',headers:{'X-Idempotency-Key':uploadKey},body:form});assert.equal(uploadAgain.status,200);
 const oversized=new FormData();for(const [key,value]of form.entries())if(key!=='receipt')oversized.append(key,value);oversized.append('receipt',new Blob([Buffer.alloc(5*1024*1024+1)],{type:'image/jpeg'}),'large.jpg');
 assert.equal((await fetch(origin+'/api/payments/receipts',{method:'POST',headers:{'X-Idempotency-Key':uploadKey},body:oversized})).status,413);
 assert.equal(files.size,1);assert.equal(orders.size,0);
 const final=await post(proof);assert.equal(final.status,201);const order=await final.json();assert.equal(order.receiptUploaded,true);assert.match(order.whatsappUrl,/^https:\/\/wa.me\//);assert.equal(orders.size,1);
 await post(proof);assert.equal(orders.size,1);
 await fetch(origin+'/api/payments/receipts/discard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reservationId,checkoutKey,receiptUploadToken:proof.receiptUploadToken})});assert.ok(files.has(claims.path),'Never delete a linked receipt');
 // Screenshot the original and new empty receipt step without creating a real reservation.
 const before=await open(390,844,true);if(visual)await before.screenshot({path:path.join(visual,'before-empty-390.png')});await before.close();
 for(const [w,h]of [[320,568],[320,640],[390,844],[430,932],[768,900],[1440,900]]){
  const page=await open(w,h);const baseOrders=orders.size;
  assert.equal(await page.textContent('#paymentSubmit'),'Əvvəlcə çeki yükləyin');assert.equal(await page.isDisabled('#paymentSubmit'),true);
  await page.evaluate(()=>{document.getElementById('paymentSubmit').disabled=false;document.getElementById('paymentReceiptForm').requestSubmit();});
  assert.equal(orders.size,baseOrders);assert.equal(await page.evaluate(()=>window.__paymentOrder),undefined);
  await page.click('#copyPaymentNumber');await page.waitForSelector('.receiptAttention');
  await layout(page,w,h);
  if(visual)await page.screenshot({path:path.join(visual,`after-empty-${w}-${h}.png`)});
  let resume;const hold=new Promise(r=>resume=r);await page.route('**/api/payments/receipts',async route=>{await hold;await route.continue();},{times:1});
  await page.setInputFiles('#paymentReceiptInput',receipts[0]);
  await page.waitForFunction(()=>document.getElementById('paymentSubmit').textContent==='Çek yüklənir — gözləyin');assert.equal(await page.isDisabled('#paymentSubmit'),true);
  assert.equal(await page.locator('.paymentReceiptSuccess').count(),0);assert.equal(orders.size,baseOrders);assert.equal(await page.getAttribute('[aria-current="step"]','data-receipt-step'),'2');
  await page.evaluate(()=>document.getElementById('paymentReceiptForm').requestSubmit());assert.equal(orders.size,baseOrders);
  if(visual)await page.screenshot({path:path.join(visual,`uploading-${w}-${h}.png`)});resume();await ready(page);
  const g=await layout(page,w,h);assert.equal(orders.size,baseOrders,'Upload must not create an order');
  if(visual)await page.screenshot({path:path.join(visual,`success-${w}-${h}.png`)});
  await page.evaluate(()=>{document.getElementById('paymentSubmit').click();document.getElementById('paymentSubmit').click();document.getElementById('paymentReceiptForm').requestSubmit();});
  await page.waitForFunction(()=>!!window.__paymentOrder);assert.equal(orders.size,baseOrders+1);assert.equal(await page.evaluate(()=>window.__navigations.length),1);
  checks.push({viewport:`${w}x${h}`,...g});await page.close();
 }
 const edit=await open();
 for(const receipt of receipts){await edit.setInputFiles('#paymentReceiptInput',receipt);await ready(edit);assert.equal(await edit.textContent('.paymentReceiptPreviewInfo strong'),receipt.name);}
 const change=edit.waitForEvent('filechooser');await edit.click('#changePaymentReceipt');await(await change).setFiles(receipts[0]);await ready(edit);
 await edit.click('#removePaymentReceipt');assert.equal(await edit.isDisabled('#paymentSubmit'),true);assert.equal(await edit.locator('.paymentReceiptSuccess').count(),0);
 await edit.setInputFiles('#paymentReceiptInput',receipts[0]);await ready(edit);
 const boundary=Buffer.concat([jpg.subarray(0,-2),Buffer.alloc(5*1024*1024-jpg.length),jpg.subarray(-2)]);
 await edit.setInputFiles('#paymentReceiptInput',{name:'boundary.jpg',mimeType:'image/jpeg',buffer:boundary});await ready(edit);
 for(const bad of [{name:'too-big.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(5*1024*1024+1)},{name:'fake.png',mimeType:'image/png',buffer:jpg},{name:'bad.html',mimeType:'text/html',buffer:Buffer.from('<script>bad</script>')},{name:'bad.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken file')},{name:'camera.heic',mimeType:'image/heic',buffer:Buffer.from('not supported')},{name:'active.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n/JavaScript (bad)\n%%EOF')}]){
  await edit.setInputFiles('#paymentReceiptInput',bad);await edit.waitForFunction(()=>!document.getElementById('paymentReceiptError').hidden&&!document.querySelector('#paymentReceiptForm.isUploading'));assert.equal(await edit.isDisabled('#paymentSubmit'),true);assert.equal(await edit.locator('.paymentReceiptSuccess').count(),0);
 }
 await edit.close();
 for(const status of [502,503,504]){
  const page=await open();const n=orders.size,r=state.reservationCalls,key=state.uploadKeys.length;state.failureStatus=status;state.failures=3;
  await page.setInputFiles('#paymentReceiptInput',receipts[0]);await ready(page);
  assert.equal(orders.size,n);assert.equal(state.reservationCalls,r);assert.equal(new Set(state.uploadKeys.slice(key)).size,1);await page.close();
 }
 const retry=await open(320,568);state.failures=4;const n=orders.size;await retry.setInputFiles('#paymentReceiptInput',receipts[0]);
 await retry.waitForSelector('#paymentReceiptRetry:not([hidden])');assert.equal(await retry.isDisabled('#paymentSubmit'),true);assert.equal(await retry.locator('#paymentReceiptPreview img').count(),1);assert.equal(orders.size,n);
 await retry.click('#paymentReceiptRetry');await ready(retry);await retry.close();
 for(const mode of ['network','timeout']){
  const page=await open(390,844,false,mode==='timeout');let attempts=0;await page.route('**/api/payments/receipts',async route=>{attempts++;if(attempts===1){if(mode==='timeout')await new Promise(r=>setTimeout(r,250));return route.abort('timedout').catch(()=>{});}return route.continue();});
  await page.setInputFiles('#paymentReceiptInput',receipts[0]);await ready(page);assert.equal(attempts,2);if(mode==='timeout')assert.ok(await page.evaluate(()=>window.__receiptTimeouts>0));await page.close();
 }
 assert.deepEqual(errors,[]);assert.equal(popups,0);
 console.log(JSON.stringify({checks,formats:['JPG','PNG','WEBP','PDF'],emptyAndUploadingBlocked:true,serverConfirmationRequired:true,retry:3,manualRetry:true,sameFileReselection:true,replaceRemove:true,tokenTamperingAndCrossCheckoutBlocked:true,storageMissingBlocked:true,linkedReceiptPreserved:true,doubleClickDuplicates:0,newTabs:popups,appErrors:errors,productionOrders:0,productionReservations:0},null,2));
}finally{await browser.close();await new Promise(r=>fixture.server.close(r));}
