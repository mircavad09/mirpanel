import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
import {receiptFixture} from './receipt-gate-fixture.mjs';import {imageReceipt,randomImage} from './receipt-synthetic-fixtures.mjs';import {inspectDocument} from '../receipt-worker/engine.mjs';
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(a,m)=>{assert.ok(a,m);checks++;};
const date=new Date(Date.now()+4*3600000).toISOString().replace('T',' ').slice(0,19),good=await imageReceipt('Birbank',{amount:'5.99',date}),bad=await randomImage();
// Real engine output, cached only inside this isolated fixture to keep UI matrix fast.
const goodAnalysis=await inspectDocument(good,'image/png'),badAnalysis=await inspectDocument(bad,'image/png');let workerCalls=0,delay=0,mode='normal';
const fixture=await receiptFixture({receiptValidationEnabled:true,analyzeReceipt:async receipt=>{workerCalls++;if(delay)await new Promise(r=>setTimeout(r,delay));if(mode==='down')throw Object.assign(Error('Test service unavailable'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});const a=receipt.buffer.equals(bad)?badAnalysis:structuredClone(goodAnalysis);if(mode==='ocr-down'){a.ocrStatus='unavailable';a.text='';a.confidence=0;}return a;}}),{origin,state,orders,reservations,store}=fixture;
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});const errors=[],assets=[],matrix=[],artifacts='payment-test-artifacts/receipt-validation';fs.mkdirSync(artifacts,{recursive:true});
const reserve=()=>{const r={id:crypto.randomUUID(),checkout_key:crypto.randomUUID(),product_id:'test',plan_id:'0',status:'reserved',expires_at:new Date(Date.now()+600000).toISOString(),created_at:new Date().toISOString(),amount:5.99,method_id:fixture.methodId};reservations.set(r.id,r);return r;};
const upload=(r,b=good,mime='image/png',endpoint='receipts')=>{const form=new FormData();for(const [k,v]of Object.entries({reservationId:r.id,checkoutKey:r.checkout_key,productId:'test',planIndex:'0',consentAccepted:'true'}))form.append(k,v);form.append('receipt',new Blob([b],{type:mime}),'synthetic.png');return fetch(origin+'/api/payments/'+endpoint,{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:form});};
try{
 const originalRegister=store.registerReceiptInspection;store.registerReceiptInspection=async a=>{const v=await originalRegister(a);return {...v,similar:a.status==='rejected'};};
 const r=reserve();let response=await upload(r,bad);eq(response.status,422);let data=await response.json();ok(data.error.includes('Bu şəkil ödəniş qəbzi kimi tanınmadı'));eq(data.reasonCodes.includes('NOT_RECEIPT'),true);eq(state.uploadCalls,0);eq(orders.size,0);
 store.registerReceiptInspection=originalRegister;
 response=await upload(r);eq(response.status,200);const proof=await response.json();eq(proof.technicalStatus,'technical_pass');eq(proof.paymentVerified,false);eq(proof.url,undefined);eq(orders.size,0);const calls=workerCalls;eq((await upload(r)).status,200);eq(workerCalls,calls,'same hash cache');
 const forged=JSON.parse(fixture.security.decryptSecret(proof.receiptUploadToken));delete forged.inspectionId;
 const submit=token=>fetch(origin+'/api/payments/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({reservationId:r.id,checkoutKey:r.checkout_key,productId:'test',planIndex:0,consentAccepted:true,receiptUploadToken:token})});
 eq((await submit(fixture.security.encryptSecret(JSON.stringify(forged)))).status,400);eq(orders.size,0);
 const submitted=await Promise.all([submit(proof.receiptUploadToken),submit(proof.receiptUploadToken)]);eq(submitted.every(s=>[200,201].includes(s.status)),true);eq(orders.size,1);eq([...orders.values()][0].status,'reviewing');
 const second=reserve();eq((await upload(second)).status,409);eq(orders.size,1);
 eq((await upload(second,bad,'image/jpeg')).status,400);eq((await upload(second,Buffer.alloc(5*1024*1024+1))).status,413);
 // Bypassing the staging endpoint must run the same validation.
 eq((await upload(second,bad,'image/png','orders')).status,422);eq(orders.size,1);
 const beforeCalls=workerCalls,expired=reserve();expired.expires_at=new Date(0).toISOString();eq((await upload(expired)).status,409);eq(workerCalls,beforeCalls);
 mode='down';const down=reserve();eq((await upload(down,await imageReceipt('Birbank',{reference:'SYNTH-DOWN',amount:'5.99',date}))).status,503);mode='ocr-down';response=await upload(down,await imageReceipt('Birbank',{reference:'SYNTH-OCR-DOWN',amount:'5.99',date}));eq(response.status,200);eq((await response.json()).technicalStatus,'manual_review');mode='normal';
 // Each fresh browser uses a distinct synthetic reference. No real orders are submitted.
 for(const width of [320,390,430,768,1024,1440]){
  const page=await browser.newPage({viewport:{width,height:width===320?568:900},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)assets.push(r.url());});
  await page.goto(origin);await page.click('[data-payment-method]');await page.click('#paymentMethodContinue');await page.waitForSelector('#paymentReceiptInput',{state:'attached'});
  eq(await page.locator('input[name="customerName"],input[name="customerWhatsapp"],input[name="quantity"]').count(),0);eq(await page.isDisabled('#paymentSubmit'),true);
  ok((await page.textContent('.paymentReceiptGuidance')).includes('bank tətbiqində')||(await page.textContent('.paymentReceiptGuidance')).includes('Bank tətbiqində'));
  if(width===390)await page.screenshot({path:artifacts+'/390-before-upload.png',fullPage:true});
  await page.setInputFiles('#paymentReceiptInput',{name:'random.png',mimeType:'image/png',buffer:bad});await page.waitForSelector('#paymentReceiptError:not([hidden])');eq(await page.isDisabled('#paymentSubmit'),true);ok((await page.textContent('#paymentReceiptError')).includes('Bu şəkil ödəniş qəbzi kimi tanınmadı'));
  // Worker output is a real OCR result with only the fixture's operation ID changed.
  const unique=await imageReceipt('Birbank',{amount:'5.99',date,reference:'SYNTH-UI-'+width});const savedAnalyzer=structuredClone(goodAnalysis);goodAnalysis.text=goodAnalysis.text.replace(/SYNTH202610250001/g,'SYNTH-UI-'+width);
  // Use synthetic changing SHA + ref; mutate before upload, restore afterwards.
  delay=150;await page.setInputFiles('#paymentReceiptInput',{name:'receipt.png',mimeType:'image/png',buffer:unique});eq(await page.isDisabled('#paymentSubmit'),true);await page.waitForSelector('.paymentReceiptSuccess');delay=0;Object.assign(goodAnalysis,savedAnalyzer);
  eq(await page.isDisabled('#paymentSubmit'),false);ok((await page.textContent('.paymentReceiptSuccess')).includes('Ödəniş hələ təsdiqlənməyib'));eq(await page.getAttribute('[aria-current="step"]','data-receipt-step'),'3');
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).length,buttons:[...document.querySelectorAll('.paymentSubmitActions button')].map(b=>b.getBoundingClientRect().height),zoom:visualViewport.scale}));eq(layout.overflow,0);eq(layout.broken,0);eq(layout.zoom,1);ok(layout.buttons.every(h=>h>=44));matrix.push({width,...layout});
  if(width===390)await page.screenshot({path:artifacts+'/390-after-validation.png',fullPage:true});
  await page.click('#removePaymentReceipt');eq(await page.isDisabled('#paymentSubmit'),true);
  // Analysis view must be readable at the same responsive sizes, without HTML injection.
  await page.addScriptTag({content:fs.readFileSync('mirpanel-admin/public/receipt-analysis-view.js','utf8')});await page.evaluate(()=>ReceiptAnalysisView.show({status:'manual_review',fields:{bankName:'<script>no</script>',amountCents:599,recipientLast4:'4655',reference:'SYNTH-ONLY'},checks:{amount:true},riskReasons:['LOW_CONFIDENCE']}));eq(await page.locator('#receiptAnalysisDialog script').count(),0);eq(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);await page.getByRole('button',{name:'Bağla',exact:true}).click();await page.close();
 }
 eq(errors.length,0);eq(assets.length,0);fs.writeFileSync(artifacts+'/http-responsive-results.json',JSON.stringify({checks,matrix,errors,assets,fixtureOrders:orders.size,productionWrites:0},null,2));console.log(JSON.stringify({ok:true,checks,widths:matrix.map(m=>m.width),overflow:0,consoleErrors:0,new404:0,productionWrites:0},null,2));
}finally{await browser.close();await new Promise(r=>fixture.server.close(r));}
