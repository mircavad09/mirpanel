// Anonymous negative requests only: must never create a group message.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='https://mirpanel.com',get=(p,o={})=>fetch(base+p,{...o,signal:AbortSignal.timeout(40000)}),report={businessWrites:0,checks:[]};
assert.equal((await(await get('/api/community/group-availability')).json()).open,false);
for(const p of ['/api/community/messages','/api/community/events','/api/community/tag-message?messageId=1']){const r=await get(p);assert.equal(r.status,403);assert.equal((await r.json()).error,'Qrup söhbəti müvəqqəti bağlıdır');report.checks.push({route:p,status:403});}
assert.equal((await get('/api/community/messages',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({body:'Must not be saved',clientId:crypto.randomUUID()})})).status,403);
const state=await(await get('/api/community/state?group=1')).json();assert.equal(state.groupClosed,true);assert.equal(state.initialMessages,undefined);assert.equal((await get('/api/payments/health')).status,200);
const html=await(await get('/qrup')).text();assert(html.includes('Qrup söhbəti müvəqqəti bağlıdır'));assert(!html.includes('src="/community-assets/community.js'));
fs.mkdirSync('outputs/public-group-paused',{recursive:true});
for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});try{for(const width of [320,390,430,1440]){
 const context=await browser.newContext({viewport:{width,height:950},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();await page.route('**/*',r=>r.request().method()==='GET'?r.continue():r.abort());
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MirpanelPublicGroup===true);assert.equal(await page.locator('a[href^="/qrup"]:visible').count(),0);assert.equal(await page.locator('a[href^="https://mirpanel.com/qrup"]:visible').count(),0);
 await page.locator('#aiSupportToggle').click();await page.locator('#aiSupportPanel').waitFor();assert.equal(await page.locator('.support-group:visible').count(),0);assert(await page.locator('#supportOperator').isVisible());assert((await page.locator('#supportOperator').getAttribute('href')).includes('wa.me'));
 await page.goto(base+'/qrup');await page.getByRole('heading',{name:'Qrup söhbəti müvəqqəti bağlıdır'}).waitFor();assert(await page.getByRole('link',{name:'Şəxsi dəstəyə yaz'}).isVisible());assert.equal(await page.locator('textarea[aria-label="Mesaj"]').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(engine===chromium&&[390,1440].includes(width))await page.screenshot({path:'outputs/public-group-paused/live-closed-'+width+'.png'});await context.close();console.log('PASS LIVE '+engine.name()+' '+width+'px: group links hidden, private operator works, direct group page closed');report.checks.push({engine:engine.name(),width,passed:true});
}}finally{await browser.close();}}
console.log(JSON.stringify(report));fs.mkdirSync('payment-test-artifacts/public-group-pause',{recursive:true});fs.writeFileSync('payment-test-artifacts/public-group-pause/public-verification.json',JSON.stringify(report,null,2));
