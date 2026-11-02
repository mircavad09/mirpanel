import fs from 'node:fs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [390,1440]){const ctx=await browser.newContext({viewport:{width,height:900}}),p=await ctx.newPage();
 for(const route of ['/qrup','/hesab','/sifarislerim']){const times=[],requests=[];for(let i=0;i<5;i++){let count=0;const onReq=r=>{if(new URL(r.url()).pathname.startsWith('/api/'))count++;};p.on('request',onReq);const t=performance.now();await p.goto('https://mirpanel.com'+route,{waitUntil:'domcontentloaded'});await p.locator(route==='/qrup'?'.community-chat-bottom':route==='/hesab'?'.auth-form-panel':'main').first().waitFor({timeout:20000});if(route==='/qrup')await p.locator('.group-total').waitFor();times.push(Math.round(performance.now()-t));requests.push(count);p.off('request',onReq);}
 const sorted=[...times].sort((a,b)=>a-b);console.log(JSON.stringify({scope:'live guest browser',width,route,times,median:sorted[2],p95:sorted[4],apiRequests:requests}));
 if(route==='/qrup'){fs.mkdirSync('payment-test-artifacts/latency',{recursive:true});await p.screenshot({path:`payment-test-artifacts/latency/${process.argv[2]||'sample'}-${width}.png`});}}
 await ctx.close();}}finally{await browser.close();}
