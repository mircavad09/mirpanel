// Read-only production guest timings. No orders, auth submissions or messages.
import fs from 'node:fs';import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const label=process.argv[2]||'before',samples=[],errors=[];const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();page.on('pageerror',()=>errors.push(width));
 for(const route of ['/qrup','/hesab','/sifarislerim'])for(let i=0;i<5;i++){
  let requests=0;const listener=req=>{if(new URL(req.url()).pathname.startsWith('/api/community/'))requests++;};page.on('request',listener);const started=performance.now();await page.goto('https://mirpanel.com'+route,{waitUntil:'domcontentloaded'});
  if(route==='/qrup')await page.locator('.community-guest').waitFor();else if(route==='/hesab')await page.getByRole('heading',{name:'Giriş',exact:true}).waitFor();else await page.getByRole('heading',{name:'Sifarişlərinizi görmək üçün hesabınıza daxil olun.'}).waitFor();
  const ms=performance.now()-started;await page.waitForTimeout(100);page.off('request',listener);samples.push({width,route,ms:Math.round(ms),communityRequestsToReady:requests});
 }await context.close();}
}finally{await browser.close();}
const summaries=[];for(const width of [390,1440])for(const route of ['/qrup','/hesab','/sifarislerim']){const rows=samples.filter(s=>s.width===width&&s.route===route),a=rows.map(x=>x.ms).sort((a,b)=>a-b);summaries.push({width,route,n:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.ceil(a.length*.95)-1],communityRequests:rows.map(x=>x.communityRequestsToReady)});}
fs.mkdirSync('payment-test-artifacts/group-realtime',{recursive:true});fs.writeFileSync('payment-test-artifacts/group-realtime/live-'+label+'.json',JSON.stringify({scope:'Real production internet guest navigation from this Windows host; n=5 per route/width, not all networks',samples,summaries,jsErrors:errors.length},null,2));console.log(JSON.stringify({label,summaries,jsErrors:errors.length}));
