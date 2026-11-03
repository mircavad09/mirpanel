import assert from'node:assert/strict';import{receiptFixture}from'./receipt-gate-fixture.mjs';import{randomImage}from'./receipt-synthetic-fixtures.mjs';import{chromium}from'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const f=await receiptFixture({browserOrdersEnabled:true});f.store.browserOrdersReady=async()=>1;f.store.browserOwnedOrder=async(h,id)=>[...f.orders.values()].find(o=>o.id===id)||null;
const png=await randomImage(),rows=[];
// WebKit correctly rejects __Host Secure cookies on this HTTP fixture.
// Its session recovery cases run separately through the HTTPS live diagnostic.
try{for(const[engine,type,executablePath]of [['Chrome',chromium,'C:/Program Files/Google/Chrome/Application/chrome.exe']]){
 const b=await type.launch({headless:true,executablePath});try{
 for(const scenario of ['refresh-upload','history-cookie-lost','cookie-recovery-denied','tampered-proof','missing-object']){
 const c=await b.newContext(),p=await c.newPage();try{
 await p.goto(f.origin);await p.click('[data-payment-method]');await p.click('#paymentMethodContinue');await p.waitForSelector('#paymentReceiptInput',{state:'attached'});
 const uploads=f.state.uploadCalls,orders=f.orders.size,reservations=f.state.reservationCalls;
 await p.setInputFiles('#paymentReceiptInput',{name:'Azərbaycan ekran görüntüsü.png',mimeType:'image/png',buffer:png});await p.waitForFunction(()=>!document.querySelector('#paymentSubmit').disabled);
 const saved=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mirpanel-payment-checkout-v1')));
 if(scenario==='refresh-upload'){
 const wrong=await c.request.post(f.origin+'/api/payments/checkout/resume',{data:{reservationId:saved.reservationId,checkoutKey:crypto.randomUUID(),receiptUploadToken:saved.receiptUploadToken}});assert.equal(wrong.status(),404);
 const forged=await c.request.post(f.origin+'/api/payments/checkout/resume',{data:{reservationId:saved.reservationId,checkoutKey:saved.checkoutKey,receiptUploadToken:saved.receiptUploadToken+'x'}});assert.equal(forged.status(),400);
 assert.equal(f.orders.size,orders);
 }
 if(scenario==='refresh-upload'){
 await p.reload();await p.waitForSelector('#paymentSubmit');await p.waitForFunction(()=>!document.querySelector('#paymentSubmit').disabled);await p.click('#paymentSubmit');await p.waitForFunction(()=>window.__paymentOrder?.orderId);assert.equal(f.orders.size,orders+1);
 await p.reload();await p.waitForFunction(()=>window.__paymentOrder?.orderId);assert.equal(f.orders.size,orders+1);
 }else if(scenario==='history-cookie-lost'||scenario==='cookie-recovery-denied'){
 await c.clearCookies({name:'__Host-mirpanel_orders'});let blocked=false;
 if(scenario==='cookie-recovery-denied')await p.route('**/api/payments/methods',r=>{blocked=true;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test unavailable'})});});
 await p.click('#paymentSubmit');
 if(scenario==='history-cookie-lost'){await p.waitForFunction(()=>window.__paymentOrder?.orderId);assert.equal(f.orders.size,orders+1);}
 else{await p.waitForFunction(()=>!document.querySelector('#paymentReceiptError').hidden);assert.equal(blocked,true);assert.equal(f.orders.size,orders);assert.equal(await p.locator('#paymentReceiptRetry').isVisible(),false);assert.equal(await p.isEnabled('#paymentSubmit'),true);assert.equal(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('mirpanel-payment-checkout-v1')).receiptUploadToken),saved.receiptUploadToken);await p.unroute('**/api/payments/methods');await p.click('#paymentSubmit');await p.waitForFunction(()=>window.__paymentOrder?.orderId);assert.equal(f.orders.size,orders+1);}
 }else{
 if(scenario==='missing-object')f.files.clear();else await p.evaluate(()=>{const k='mirpanel-payment-checkout-v1',s=JSON.parse(sessionStorage.getItem(k));s.receiptUploadToken+='x';sessionStorage.setItem(k,JSON.stringify(s));});
 await p.reload();await p.waitForSelector('#paymentReceiptInput',{state:'attached'});assert.equal(await p.isEnabled('#paymentSubmit'),false);assert.equal(f.orders.size,orders);
 await p.setInputFiles('#paymentReceiptInput',{name:'normal.png',mimeType:'image/png',buffer:png});await p.waitForFunction(()=>!document.querySelector('#paymentSubmit').disabled);await p.click('#paymentSubmit');await p.waitForFunction(()=>window.__paymentOrder?.orderId);assert.equal(f.orders.size,orders+1);
 }
 assert.equal(f.state.reservationCalls,reservations);assert.equal(f.state.uploadCalls,uploads+(['tampered-proof','missing-object'].includes(scenario)?2:1));const order=[...f.orders.values()].at(-1);assert.ok(f.files.has(order.receipt_path));rows.push({engine,scenario,passed:true,storedAndLinked:true});
 }finally{await c.close();}}
 }finally{await b.close();}}
 console.log(JSON.stringify({cases:rows.length,rows,physicalDevice:false}));
}finally{await new Promise(r=>f.server.close(r));}
