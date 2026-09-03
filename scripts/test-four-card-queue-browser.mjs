import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const port=10086;
const fixture=spawn(process.execPath,['scripts/payment-flow-browser-fixture.mjs',String(port)],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture timeout')),10000);fixture.stdout.on('data',chunk=>{if(String(chunk).includes('payment fixture')){clearTimeout(timer);resolve();}});fixture.on('exit',()=>reject(Error('Fixture exited')));});
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
let writes=0; const errors=[];
const card=(i,status='active')=>({id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,providerName:'ABB',last4:String(i).padStart(4,'0'),theme:'abb',type:'bank_card',status,available:status==='active',unavailableReason:status==='limit_reached'?'Bu gün limit dolub':status==='temporarily_busy'?'Müvəqqəti rezervdədir':''});
try {
  for(const width of [320,390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{const original=window.setInterval;window.setInterval=(fn,delay,...args)=>original(fn,delay===15000?250:delay,...args);});
    let state=[1,2,3,4].map(i=>card(i));
    await page.route('**/api/payments/methods',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({methods:state,anyAvailable:state.some(m=>m.available),reservationMinutes:10})}));
    await page.route('**/api/payments/reservations',r=>{writes++;return r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Fixture guard'})});});
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.locator('.paymentMethodChoice').nth(3).waitFor();
    assert.equal(await page.locator('.paymentMethodChoice:not(:disabled)').count(),4);
    state=[card(1),card(2,'limit_reached'),card(3),card(4),card(5)];
    await page.getByText('Bu gün limit dolub',{exact:true}).waitFor();
    assert.equal(await page.locator('.paymentMethodChoice').count(),5);
    assert.equal(await page.locator('.paymentMethodChoice:not(:disabled)').count(),4);
    const full=page.locator('.paymentMethodChoice:disabled');
    assert.match(await full.innerText(),/ABB[\s\S]*0002[\s\S]*Bu gün limit dolub/);
    await full.dispatchEvent('click');
    assert.equal(writes,0);
    state=[card(3),card(4),card(5),card(1,'temporarily_busy'),card(2,'limit_reached')];
    await page.getByText('Müvəqqəti rezervdədir',{exact:true}).waitFor();
    assert.equal(await page.locator('.paymentMethodChoice').count(),5);
    assert.equal(await page.locator('.paymentMethodChoice:not(:disabled)').count(),3);
    assert.deepEqual(await page.locator('.paymentMethodChoice').evaluateAll(elements=>elements.map(el=>el.disabled?'disabled':'active')),['active','active','active','disabled','disabled']);
    assert.match(await page.locator('.paymentMethodChoice').nth(3).innerText(),/Müvəqqəti rezervdədir/);
    assert.match(await page.locator('.paymentMethodChoice').nth(4).innerText(),/Bu gün limit dolub/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.paymentFlow').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    assert.equal(await page.locator('.paymentMethodChoice').evaluateAll(elements=>elements.some(el=>el.getBoundingClientRect().height<44)),false);
    assert.equal(await page.locator('.paymentMethodChoice').evaluateAll(elements=>elements.some(el=>/\d+\/5/.test(el.textContent))),false);
    // All full versus all temporarily held must have distinct messages.
    state=[1,2,3,4,5].map(i=>card(i,'limit_reached'));
    await page.getByText('Hazırda bütün kartların limiti dolub.',{exact:false}).waitFor();
    state=[1,2,3,4].map(i=>card(i,'temporarily_busy'));
    await page.getByText('Kartlar müvəqqəti rezervlərlə tutulub.',{exact:false}).waitFor();
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,widths:[320,390,768,1440],activeSlots:4,fullVisibleWithLast4:true,busyNotFull:true,queueRefresh:true,overflow:false,consoleErrors:0,reservationRequests:writes,engine:'Desktop Chromium (not physical Safari/Android)'}));
} finally {await browser.close();fixture.kill();}
