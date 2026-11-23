import http from 'node:http';import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const ref=randomUUID();let credited=false,hints=0,loseReply=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
 if(u.pathname.startsWith('/community-assets/')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('mirpanel-admin/community/public/'+u.pathname.split('/').pop()));return;}
 if(u.pathname==='/api/payments/epoint/status'&&req.method==='POST'){let raw='';for await(const b of req)raw+=b;assert.equal(JSON.parse(raw).transaction,'te_fixture');hints++;if(loseReply){loseReply=false;res.statusCode=503;return res.end('{}');}credited=true;return res.end('{}');}
 if(u.pathname==='/api/payments/epoint/checkout')return res.end(JSON.stringify({method:'apple-pay',cents:600,status:credited?'success':'pending',widget:'https://epoint.az/widget/fixture'}));
 if(u.pathname==='/result'){res.setHeader('Content-Type','text/html');return res.end('<h1>Server confirmed</h1>');}
 if(u.pathname.startsWith('/odenis/epoint/ugurlu')){res.setHeader('Content-Type','text/html');return res.end('<h1>Server confirmed</h1>');}
 res.setHeader('Content-Type','text/html');res.end(`<main data-epoint-payment><h1></h1><p data-apple-status></p><p data-apple-amount></p><div data-apple-widget></div><button data-apple-retry>Retry</button><a data-apple-result></a><a data-apple-login></a></main><script type="module" src="/community-assets/epoint-payment.js"></script>`);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
try{for(const width of [390,1440]){
 credited=false;hints=0;loseReply=width===390;const context=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15'});await context.addInitScript(()=>window.ApplePaySession={canMakePayments:()=>true});
 await context.route('https://epoint.az/widget/fixture',route=>route.fulfill({contentType:'text/html',body:`<button onclick="parent.postMessage({status:'success',payment:{transaction:'te_fixture'}},'*')">Synthetic result</button>`}));
 const page=await context.newPage();await page.goto(origin+'/?ref='+ref);await page.waitForFunction(()=>document.querySelector('[data-apple-status]').textContent.startsWith('Rəsmi '));const lost=width===390?page.waitForResponse(r=>r.request().method()==='POST'&&r.status()===503):null;await page.frameLocator('iframe').getByRole('button').click();if(lost){await lost;await page.reload();}await page.waitForURL('**/odenis/epoint/ugurlu?*');assert.equal(hints,width===390?2:1);assert.equal(await page.locator('h1').textContent(),'Server confirmed');await context.close();console.log('PASS '+name+' '+width+': verified-origin widget hint, server check, success screen; no live payment');
}}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
