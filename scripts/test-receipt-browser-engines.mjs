import assert from'node:assert/strict';import{chromium,webkit}from'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import{receiptFixture}from'./receipt-gate-fixture.mjs';import{imageReceipt,randomImage,pdfReceipt}from'./receipt-synthetic-fixtures.mjs';import{iphoneJpeg}from'./receipt-iphone-fixture.mjs';
const f=await receiptFixture(),fixtures=[['Android JPEG',await imageReceipt('',{},'image/jpeg'),'image/jpeg'],['iPhone HDR MPF',(await iphoneJpeg()).bytes,'image/jpeg'],['PNG',await randomImage(),'image/png'],['PDF',pdfReceipt(),'application/pdf']],rows=[];
let checks=0,drop=0,attempts=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
// Lose a successful response on the actual socket after storage. Do not replay
// multipart through Playwright route.fetch: WebKit interception can omit file bytes.
f.server.prependListener('request',(req,res)=>{if(req.method!=='POST'||req.url!=='/api/payments/receipts')return;attempts++;const end=res.end.bind(res);res.end=(...args)=>{if(res.statusCode===200&&drop>0){drop--;res.destroy();return res;}return end(...args);};});
try{
 for(const[type,engine,executablePath]of [['Chrome',chromium,'C:/Program Files/Google/Chrome/Application/chrome.exe'],['WebKit',webkit,'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe']]){
  const b=await engine.launch({headless:true,executablePath});try{
   for(const[name,buffer,mimeType]of fixtures){
    const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage();await p.goto(f.origin);await p.click('[data-payment-method]');await p.click('#paymentMethodContinue');await p.waitForSelector('#paymentReceiptInput',{state:'attached'});
    const n=f.orders.size,s=f.files.size;drop=1;attempts=0;
    await p.setInputFiles('#paymentReceiptInput',{name:'Azərbaycan uzun fayl adı '+name+'.jpg',mimeType,buffer});await p.waitForFunction(()=>!document.querySelector('#paymentSubmit').disabled);
    eq(attempts,2);eq(f.files.size,s+1);eq(f.orders.size,n);eq(await p.textContent('#paymentFlowMessage'),'Çek uğurla yükləndi');await p.click('#paymentSubmit');await p.waitForFunction(()=>window.__paymentOrder?.orderId);eq(f.orders.size,n+1);const order=[...f.orders.values()].at(-1);eq(f.files.has(order.receipt_path),true);eq(order.status,'reviewing');rows.push({engine:type,file:name,lostResponseRecovered:true,storedAndLinked:true});await ctx.close();
   }
  }finally{await b.close();}
 }
 console.log(JSON.stringify({checks,rows,physicalDevice:false,productionWrites:0}));
}finally{await new Promise(r=>f.server.close(r));}
