import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {receiptFixture} from './receipt-gate-fixture.mjs';
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const fixture=await receiptFixture();
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],checks=[];let reserveRequests=0;
const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
const methods=[
 {id:'m10-test',providerName:'M10',type:'wallet',last4:'3545',theme:'m10',available:true},
 {id:fixture.methodId,providerName:'ABB',type:'card',last4:'4655',theme:'abb',available:true},
 {id:'leo-test',providerName:'LeoBank',type:'card',last4:'7350',theme:'leo',available:true},
 {id:'kapital-test',providerName:'Kapital Bank',type:'card',last4:'8332',theme:'kapital',available:true},
 {id:'reserved-test',providerName:'Kapital Bank',type:'card',last4:'6446',theme:'kapital',available:false,status:'reserved'}
];
const activeStep=page=>page.locator('[aria-current="step"]').getAttribute('data-receipt-step');
try{
 for(const width of [320,390,430,768,1024,1440]){
  const page=await browser.newPage({viewport:{width,height:width===320?568:width<500?844:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/api/payments/methods',route=>route.fulfill({json:{anyAvailable:true,methods}}));
  await page.route('**/api/payments/reservations',async route=>{reserveRequests++;assert.equal(route.request().postDataJSON().methodId,fixture.methodId);await new Promise(r=>setTimeout(r,150));await route.continue();});
  if(visual&&[390,1440].includes(width)){
   await page.route('**/payment-flow.js',route=>route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','92fc621:payment-flow.js'],{encoding:'utf8'})}),{times:1});
   await page.route('**/payment-flow.css',route=>route.fulfill({contentType:'text/css',body:execFileSync('git',['show','92fc621:payment-flow.css'],{encoding:'utf8'})}),{times:1});
   await page.goto(fixture.origin,{waitUntil:'networkidle'});await page.screenshot({path:path.join(visual,`before-${width}.png`)});
  }
  await page.goto(fixture.origin,{waitUntil:'networkidle'});
  await page.evaluate(()=>{const old=document.createElement('button');old.id='closeModal';old.textContent='Bağla';document.querySelector('.modalCard').prepend(old);});
  assert.equal(await page.locator('#closeModal').isVisible(),false);
  assert.equal(await page.locator('.paymentFlowClose').isVisible(),true);
  const next=page.locator('#paymentMethodContinue'),cards=page.locator('[data-payment-method]');
  assert.equal(await next.isDisabled(),true);assert.equal(await page.locator('.paymentMethodChoice.selected').count(),0);
  assert.equal(await activeStep(page),'1');assert.match(await next.textContent(),/Bu kartla davam et · 5\.99 ₼/);
  const initialRequests=reserveRequests;
  await page.evaluate(()=>document.getElementById('paymentMethodContinue').click());assert.equal(reserveRequests,initialRequests);
  for(let index=0;index<4;index++){
   await cards.nth(index).click();
   assert.equal(await page.locator('.paymentMethodChoice.selected').count(),1);
   assert.equal(await cards.nth(index).getAttribute('aria-pressed'),'true');
   assert.equal(await cards.nth(index).locator('i').isVisible(),true);
   assert.equal(await next.isDisabled(),false);assert.equal(await activeStep(page),'1');
   assert.equal(reserveRequests,initialRequests,'Selection must not create a reservation');
  }
  const reserved=cards.nth(4);assert.equal(await reserved.isDisabled(),true);assert.equal(await reserved.getAttribute('aria-disabled'),'true');assert.equal(await reserved.getAttribute('tabindex'),'-1');
  assert.match(await reserved.textContent(),/Müvəqqəti rezervdədir/);
  await reserved.evaluate(el=>el.click());assert.equal(await reserved.getAttribute('aria-pressed'),'false');
  await cards.nth(0).focus();await page.keyboard.press('Enter');assert.equal(await cards.nth(0).getAttribute('aria-pressed'),'true');
  await cards.nth(1).focus();await page.keyboard.press('Space');assert.equal(await cards.nth(1).getAttribute('aria-pressed'),'true');
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,nextHeight:document.getElementById('paymentMethodContinue').getBoundingClientRect().height,cards:[...document.querySelectorAll('[data-payment-method]')].map(el=>({background:getComputedStyle(el).backgroundImage,overflow:el.scrollWidth-el.clientWidth})),columns:getComputedStyle(document.getElementById('paymentMethodChoices')).gridTemplateColumns}));
  assert.equal(layout.overflow,0);assert.ok(layout.nextHeight>=52);assert.ok(layout.cards.every(c=>c.overflow===0));
  assert.notEqual(layout.cards[0].background,layout.cards[1].background);assert.notEqual(layout.cards[1].background,layout.cards[3].background);
  if(visual)await page.screenshot({path:path.join(visual,`selected-${width}.png`)});
  await page.evaluate(()=>{const b=document.getElementById('paymentMethodContinue');b.click();b.click();document.querySelector('.paymentFlowClose').click();});
  await page.waitForSelector('#paymentReceiptInput',{state:'attached'});
  assert.equal(reserveRequests,initialRequests+1);assert.equal(await activeStep(page),'2');assert.equal(await next.isVisible(),false);
  assert.equal(await page.isDisabled('#paymentSubmit'),true);
  checks.push({width,...layout,duplicateReservations:0});await page.close();
 }
 const pricePage=await browser.newPage();
 await pricePage.route('**/api/payments/inventory',route=>route.fulfill({json:{products:[{productId:'test',canOrder:true,plans:[{planKey:'0',canOrder:true}]},{productId:'another',canOrder:true,plans:[{planKey:'2',canOrder:true}]}]}}));
 await pricePage.route('**/api/payments/methods',route=>route.fulfill({json:{anyAvailable:true,methods}}));
 await pricePage.goto(fixture.origin,{waitUntil:'networkidle'});await pricePage.click('.paymentFlowClose');
 await pricePage.evaluate(()=>{void MirpanelPaymentFlow.start({product:{id:'another',title:'Digər məhsul'},plan:{price:12.99},planIndex:2});});
 await pricePage.waitForFunction(()=>document.getElementById('paymentMethodContinue')?.textContent.includes('12.99'));await pricePage.waitForSelector('[data-payment-method]');assert.match(await pricePage.textContent('#paymentMethodContinue'),/12\.99 ₼/);assert.match(await pricePage.textContent('.paymentFlowHead p'),/Digər məhsul · 12\.99 ₼/);
 assert.equal(await pricePage.isDisabled('#paymentMethodContinue'),true);await pricePage.close();
 const refresh=await browser.newPage();await refresh.clock.install();let loads=0,available=true;
 await refresh.route('**/api/payments/methods',route=>{loads++;return route.fulfill({json:{anyAvailable:true,methods:methods.map((m,i)=>i===0?{...m,available}:m)}});});
 await refresh.goto(fixture.origin,{waitUntil:'networkidle'});await refresh.click('[data-payment-method="m10-test"]');
 await refresh.clock.runFor(15010);await refresh.waitForFunction(()=>document.querySelector('[data-payment-method="m10-test"]').getAttribute('aria-pressed')==='true'&&!document.getElementById('paymentMethodContinue').disabled);
 assert.ok(loads>=2);available=false;await refresh.clock.runFor(15010);
 await refresh.waitForFunction(()=>document.querySelector('[data-payment-method="m10-test"]').disabled);
 assert.equal(await refresh.isDisabled('#paymentMethodContinue'),true);assert.equal(await refresh.locator('.selected').count(),0);await refresh.close();
 assert.deepEqual(errors,[]);assert.equal(fixture.orders.size,0);assert.equal(fixture.files.size,0);
 console.log(JSON.stringify({checks,consoleErrors:0,realOrders:0,realReservations:0,realReceipts:0,fixtureReservations:reserveRequests},null,2));
}finally{await browser.close();await new Promise(r=>fixture.server.close(r));}
