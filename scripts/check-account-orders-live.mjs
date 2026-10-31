// Guest read-only release check. No Google login, uploads, orders or messages.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
for(const base of ['https://mirpanel.onrender.com','https://mirpanel.com']){
 for(const path of ['/api/payments/my-orders','/api/payments/my-orders/11111111-1111-4111-8111-111111111111/receipt']){const r=await fetch(base+path);eq(r.status,401,'guest API denied');eq(r.headers.get('cache-control').includes('no-store'),true);}
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const rows=[];fs.mkdirSync('payment-test-artifacts/account-orders',{recursive:true});
try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900}}),p=await ctx.newPage(),errors=[];
 await ctx.route('**/*',r=>!['GET','HEAD'].includes(r.request().method())||r.request().resourceType()==='media'?r.abort():r.continue());p.on('pageerror',e=>errors.push(e.name));
 await p.goto('https://mirpanel.com/sifarislerim');await p.getByRole('heading',{name:'Sifarişlərinizi görmək üçün hesabınıza daxil olun.'}).waitFor();eq(await p.locator('.browser-order').count(),0);eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.screenshot({path:`payment-test-artifacts/account-orders/live-${width}.png`});
 await p.getByRole('link',{name:'Daxil ol',exact:true}).click();await p.getByRole('heading',{name:'Sahib girişi',exact:true}).waitFor();eq(new URL(p.url()).searchParams.get('next'),'/sifarislerim');eq(await p.getByRole('button',{name:'Google ilə davam edin',exact:true}).isEnabled(),true);
 await p.goto('https://mirpanel.com/hesab?mode=signup&next=%2Fsifarislerim');await p.getByRole('heading',{name:'Qeydiyyat tezliklə açılacaq'}).waitFor();eq(await p.locator('input').count(),0);eq(errors,[]);rows.push({width,guestGate:true,loginReturnLink:true,signupClosed:true,overflow:0});await ctx.close();
}console.log(JSON.stringify({checks,failures:0,rows,realOwnerLoginTested:false,productionWrites:0}));}finally{await browser.close();}
