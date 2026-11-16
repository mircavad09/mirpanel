// Anonymous, read-only verification. Never create orders, receipts or payments.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='outputs/compact-plan-rows';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),results=[];
try{for(const width of [390,1440])for(const slug of ['zoom-pro','amazon-prime-video','netflix-sexsi','hbo-max']){
 const page=await browser.newPage({viewport:{width,height:1000}}),blockedWrites=[];page.setDefaultTimeout(15000);
 await page.route('**/*',route=>{if(!['GET','HEAD'].includes(route.request().method())){blockedWrites.push(new URL(route.request().url()).pathname);return route.abort();}return route.continue();});
 await page.goto('https://mirpanel.com/mehsul/'+slug,{waitUntil:'domcontentloaded'});
 const row=page.locator('#pp-plans-container .pp-plan-label').first();await row.locator('.pp-plan-meta').waitFor({state:'attached'});
 await page.waitForFunction(()=>document.querySelector('#productPageView')?.dataset.detailEnhanced==='true');
 await page.waitForTimeout(1600);
 const values=await row.evaluate(n=>({height:n.getBoundingClientRect().height,paddingBottom:getComputedStyle(n).paddingBottom,metadata:!!n.querySelector('.pp-plan-meta'),overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.equal(values.overflow,false);assert.equal(values.paddingBottom,'9px');assert.ok(values.height>=44);
 await page.locator('.product-detail-summary').evaluate(n=>scrollBy(0,n.getBoundingClientRect().top-155));
 await page.screenshot({path:`${out}/live-${slug}-${width}.png`});
 results.push({slug,width,...values,blockedWrites});await page.close();console.log('LIVE READ-ONLY PASS',slug,width);
}fs.writeFileSync(out+'/live-results.json',JSON.stringify(results,null,2));}finally{await browser.close();}
