import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {receiptFixture} from './receipt-gate-fixture.mjs';

const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const fixture=await receiptFixture();
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],results=[];
const visual=process.env.MIRPANEL_VISUAL_DIR;
if(visual)fs.mkdirSync(visual,{recursive:true});
const baseline=Object.fromEntries(['js','css'].map(ext=>[ext,execFileSync('git',['show',`8b69dc3:payment-flow.${ext}`],{encoding:'utf8'})]));
const cards=async page=>page.locator('[data-payment-method]').evaluateAll(items=>items.map(el=>({text:el.textContent,disabled:el.disabled,background:getComputedStyle(el).background,border:getComputedStyle(el).borderColor,color:getComputedStyle(el).color})));
try{
 for(const width of [320,390,430,768,1440]){
  const page=await browser.newPage({viewport:{width,height:width<500?844:900}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  let before=true;
  await page.route('**/payment-flow.*',route=>before?route.fulfill({contentType:route.request().url().endsWith('.js')?'text/javascript':'text/css',body:baseline[route.request().url().endsWith('.js')?'js':'css']}):route.continue());
  await page.goto(fixture.origin,{waitUntil:'networkidle'});
  assert.match(await page.textContent('#paymentFlowMessage'),/Ödəniş edəcəyiniz kartı və ya cüzdanı özünüz seçin/);
  const originalCards=await cards(page);
  if(visual&&width===390)await page.screenshot({path:path.join(visual,'before-390.png')});
  before=false;
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#paymentFlowMessage').evaluate(el=>el.firstChild.textContent),'Ödəniş üçün aşağıdakı kartlardan birini seçin.');
  assert.equal(await page.textContent('.paymentMethodExplanationNote'),'Bu kartlar Mirpanel-ə aiddir. Seçdiyiniz karta ödəniş etməlisiniz.');
  assert.equal((await page.textContent('body')).includes('Ödəniş edəcəyiniz kartı və ya cüzdanı özünüz seçin.'),false);
  assert.deepEqual(await cards(page),originalCards,'Card appearance/state must not change');
  const layout=await page.evaluate(()=>{const box=document.getElementById('paymentFlowMessage'),note=box.querySelector('small');return{overflow:document.documentElement.scrollWidth-innerWidth,textOverflow:box.scrollWidth-box.clientWidth,noteOverflow:note.scrollWidth-note.clientWidth,mainColor:getComputedStyle(box).color,noteColor:getComputedStyle(note).color};});
  assert.equal(layout.overflow,0);assert.equal(layout.textOverflow,0);assert.equal(layout.noteOverflow,0);
  assert.equal(layout.mainColor,'rgb(255, 255, 255)');assert.equal(layout.noteColor,'rgb(196, 196, 196)');
  assert.match(await page.textContent('.paymentFlowHead p'),/5\.99 ₼/);
  assert.equal(await page.locator('#paymentMethodDetail').textContent(),'');
  assert.equal(fixture.orders.size,0);
  if(visual)await page.screenshot({path:path.join(visual,`after-${width}.png`)});
  // Only the in-memory fixture handles this selection; production is never contacted.
  await page.click('[data-payment-method]');
  await page.waitForSelector('#paymentReceiptInput',{state:'attached'});
  assert.equal(await page.isDisabled('#paymentSubmit'),true);
  assert.equal(await page.locator('.paymentMethodExplanationNote').count(),0,'Selection-only note must not persist into payment details');
  assert.equal(fixture.orders.size,0);
  results.push({width,...layout,cardAppearanceUnchanged:true,fixtureSelectionPassed:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);
 assert.equal(fixture.orders.size,0);
 console.log(JSON.stringify({results,consoleErrors:errors.length,realOrders:0,realReservations:0,fixtureSelections:fixture.state.reservationCalls},null,2));
}finally{await browser.close();await new Promise(resolve=>fixture.server.close(resolve));}
