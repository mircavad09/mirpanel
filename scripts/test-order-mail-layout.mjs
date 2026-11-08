import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {orderMail} from '../mirpanel-admin/community/order-delivery.mjs';

const origin='https://mirpanel.com',out='payment-test-artifacts/order-mail';
const order={order_code:'TEST-1001',customer_name:'Sınaq Müştəri',contact_email:'test@example.test',email:'test@example.test',phone:'+994 50 000 00 00',amount:15.97,currency:'AZN',status:'approved',payment_confirmed:true,checkout_snapshot:{cartVersion:2,items:[
 {productId:'capcut',title:'CapCut Pro',planName:'1 aylıq paket — telefon və kompüter üçün uzun paket adı',quantity:2,unitCents:499,image:'/assets/capcut.png',detailsCipher:'SYNTHETIC_PRIVATE'},
 {productId:'netflix',title:'Netflix Şəxsi',planName:'1 aylıq',quantity:1,unitCents:599,image:'/assets/netflix.png'},
]}};
const confirmed=orderMail(order,origin),ready=orderMail({...order,delivery_id:'synthetic',line_index:0,delivered_quantity:1},origin);
assert.match(confirmed.textBody,/4,99 ₼ \/ vahid · Cəm 9,98 ₼/);
assert.match(confirmed.textBody,/Ümumi məbləğ: 15,97 ₼/);
assert.match(confirmed.textBody,/Sifarişiniz hazırlanır/);
assert.match(orderMail(order,origin,{records:[{line_index:0,quantity:1}]}).textBody,/qalan hissəsi hazırlanır/);
assert.match(orderMail(order,origin,{records:[{line_index:0,quantity:2},{line_index:1,quantity:1}]}).textBody,/Sifarişiniz təhvil verilib/);
assert.doesNotMatch(ready.textBody,/Netflix|SYNTHETIC_PRIVATE/);
assert.doesNotMatch(confirmed.htmlBody,/SYNTHETIC_PRIVATE/);
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:820}});
  await page.route('**/*',r=>{const p=new URL(r.request().url()).pathname;
   return ['/assets/capcut.png','/assets/netflix.png'].includes(p)?r.fulfill({contentType:'image/png',body:fs.readFileSync('.'+p)}):r.abort();
  });
  for(const [file,mail,count] of [['order-confirmed',confirmed,2],['account-ready',ready,1]]){
   await page.setContent('<!doctype html><html lang="az"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#fff">'+mail.htmlBody+'</body></html>');
   assert.equal(await page.getByRole('link',{name:'Sifarişə bax'}).getAttribute('href'),origin+'/profil?tab=orders&order=TEST-1001');
   assert.equal(await page.locator('img').count(),count);
   assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0&&i.width<=48&&i.height<=48&&Math.abs(i.width/i.height-i.naturalWidth/i.naturalHeight)<0.1)));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await page.screenshot({path:out+'/'+file+'.png',fullPage:true});
  }
  await page.close();
 }
 console.log(JSON.stringify({widths:[320,390,1440],orderLinks:true,partialDelivery:true,images48:true,overflow:false,provider:'not contacted'}));
}finally{await browser.close();}
