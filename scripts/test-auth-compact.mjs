import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {authFormPolicy} from '../mirpanel-admin/community/auth-form-policy.mjs';
// Real form, router and header assets; only account/mail responses are synthetic.
const out='payment-test-artifacts/auth-compact';fs.mkdirSync(out,{recursive:true});
let checks=0,mailCalls=0,loginCalls=0,signupCalls=0,pendingEmail='';
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const json=(res,status,d)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(d));};
const header=fs.readFileSync('customer-header.html','utf8');
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/api/community/state')return json(res,200,{profile:null,authFormPolicy,googleEnabled:true,publicCommunity:true});
 if(u.pathname==='/api/community/notifications')return json(res,200,{items:[],unread:0});
 if(req.method==='POST'){
  let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw||'{}');
  if(u.pathname==='/api/auth/sign-in/email'){loginCalls++;return json(res,401,{message:b.email==='unverified@example.invalid'?'Email not verified':'Invalid email or password'});}
  if(u.pathname==='/api/auth/confirm-email/status'){const email=pendingEmail;return json(res,200,{email});}
  if(u.pathname==='/api/auth/confirm-email/start'){pendingEmail=b.email;return json(res,200,{email:b.email});}
  if(u.pathname==='/api/auth/confirm-email/send')return json(res,200,{email:pendingEmail,codeSent:true,retryAfter:60});
  if(u.pathname==='/api/auth/sign-up/email'){signupCalls++;return json(res,200,{registrationCreated:true,user:{id:'synthetic-new',email:b.email}});}
  if(u.pathname==='/api/auth/request-password-reset'){mailCalls++;return json(res,200,{ok:true});}
 }
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><h1>Ana səhifə</h1><script defer src="/site-header.js"></script>');}
 if(['/hesab','/qrup'].includes(u.pathname)){
  res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/auth-forms.css?v=account-update-20261107"><body class="community-page">'+header+'<main id="communityApp" class="community-shell"></main><div id="supportWidget"><button id="waFab">WhatsApp</button><button id="aiSupportToggle">AI</button></div><script src="/site-header.js"></script><script type="module" src="/community-assets/community.js"></script></body></html>');
 }
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
 if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 if(process.argv.includes('--recovery')){
  for(const failure of ['state-html','shell-html','css-html','module-html']){
   const ctx=await browser.newContext({viewport:{width:390,height:800}}),p=await ctx.newPage();let blocked=true,attempts=0;
   const html=route=>{attempts++;return blocked?route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><h1>Synthetic security check</h1></body></html>'}):route.continue();};
   if(failure==='state-html')await p.route('**/api/community/state',html);
   if(failure==='css-html')await p.route('**/community-assets/auth-forms.css*',html);
   if(failure==='module-html')await p.route('**/community-assets/auth-forms.js*',html);
   await p.goto(origin+'/hesab?next=%2Fodenis');
   if(failure==='shell-html'){await p.locator('.auth-submit').waitFor();await p.route(/\/hesab\?mode=signup/,html);await p.locator('.auth-switch').click();}
   try{await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).waitFor({timeout:16000});}catch(e){console.log(JSON.stringify({failure,attempts,diagnostic:await p.evaluate(()=>({main:document.querySelector('main')?.textContent,css:[...document.querySelectorAll('link[href*="auth-forms.css"]')].map(n=>({disabled:n.disabled,sheet:!!n.sheet,rules:n.sheet?.cssRules?.length}))}))}));throw e;}eq(await p.getByRole('heading',{name:'Synthetic security check',exact:true}).count(),0);
   eq(await p.getByText(/Unexpected token|is not valid JSON/).count(),0);blocked=false;await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();await p.locator('.auth-submit').waitFor();
   eq(await p.locator('h1').textContent(),failure==='shell-html'?'Qeydiyyat':'Giriş');eq(attempts>=2,true);
   if(failure==='state-html'){
    await p.route('**/api/auth/sign-in/email',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic check</title>'}));
    await p.locator('#account-email').fill('synthetic@example.invalid');await p.locator('#account-password').fill('Synthetic-password');await p.locator('.auth-submit').click();await p.getByText('Hesab xidməti düzgün cavab vermədi. Yenidən cəhd edin.').waitFor();
    eq(await p.locator('#account-password').inputValue(),'Synthetic-password');eq(new URL(p.url()).pathname,'/hesab');
   }
   console.log(JSON.stringify({failure,attempts,recovered:true,securityPageEmbedded:false}));await ctx.close();
  }
  console.log(JSON.stringify({checks,recovery:true,realEmailSent:false}));
 }else if(process.argv.includes('--module-baseline')){
  const p=await browser.newPage();let requests=0;
  await p.route('**/community-assets/auth-forms.js*',route=>{requests++;return requests===1?route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic security check</title>'}):route.continue();});
  await p.goto(origin+'/hesab');await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).waitFor();await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();await p.waitForTimeout(600);
  console.log(JSON.stringify({scenario:'module HTML response then retry',requests,form:await p.locator('.auth-form-panel').count(),retry:await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).count()}));await p.close();
 }else if(process.argv.includes('--upstream-baseline')){
  const p=await browser.newPage();await p.goto(origin+'/hesab');await p.locator('.auth-submit').waitFor();
  await p.route(/\/hesab\?mode=signup/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><h1>Synthetic security check</h1></body></html>'}));
  await p.locator('.auth-switch').click();await p.waitForTimeout(500);
  console.log(JSON.stringify({scenario:'upstream HTML check instead of account shell',embedded:await p.getByRole('heading',{name:'Synthetic security check',exact:true}).count(),retry:await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).count()}));await p.close();
 }else if(process.argv.includes('--css-failure-baseline')){
  const p=await browser.newPage();let requests=0;
  await p.route('**/community-assets/auth-forms.css*',route=>{requests++;return route.fulfill({status:503,contentType:'text/html',body:'<!doctype html><title>Synthetic upstream check</title>'});});
  await p.route('**/community-assets/auth-forms.js*',async route=>{await new Promise(r=>setTimeout(r,700));await route.continue();});
  await p.goto(origin+'/hesab?next=%2Fprofil');await p.waitForTimeout(1800);
  console.log(JSON.stringify({scenario:'initial stylesheet failed before form handler',requests,form:await p.locator('.auth-form-panel').count(),retry:await p.getByRole('button',{name:'Yenidən cəhd et',exact:true}).count()}));
  await p.close();
 }else{
 for(const width of [320,360,390,430,1440]){
  const ctx=await browser.newContext({viewport:{width,height:800}}),p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/hesab?next=%2Fodenis');await p.locator('.auth-submit').waitFor();
  eq(await p.locator('h1').textContent(),'Giriş');eq(await p.locator('.auth-verification').isHidden(),true);
  eq(await p.locator('#supportWidget').isHidden(),true);eq(await p.locator('.browser-bottom-nav').isHidden(),true);
  eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  eq(await p.locator('.auth-google-g').evaluate(n=>n.complete&&n.naturalWidth>0&&n.width===n.height),true);
  const count=loginCalls;await p.locator('.auth-submit').click();eq(loginCalls,count);
  await p.locator('#account-email').fill('bad');await p.locator('#account-password').fill('Synthetic-password');await p.locator('.auth-submit').click();eq(loginCalls,count);
  await p.locator('#account-email').fill('invalid@example.invalid');await p.locator('.auth-submit').click();await p.getByText('E-poçt və ya şifrə düzgün deyil.').waitFor();eq(await p.locator('.auth-code-sheet').isHidden(),true);
  await p.getByRole('button',{name:'Şifrəni göstər',exact:true}).click();eq(await p.locator('#account-password').getAttribute('type'),'text');await p.getByRole('button',{name:'Şifrəni gizlət',exact:true}).click();eq(await p.locator('#account-password').getAttribute('type'),'password');
  await p.locator('#account-email').fill('unverified@example.invalid');await p.locator('.auth-submit').click();await p.locator('.auth-code-sheet').waitFor({state:'visible'});await p.getByRole('button',{name:'E-poçta kod göndər',exact:true}).waitFor();await p.locator('.auth-code-close').click();pendingEmail='';
  await p.locator('#account-email').fill('different@example.invalid');eq(await p.locator('.auth-code-sheet').isHidden(),true);
  // Force Chrome's real autofill pseudo-state, then inspect the rendered colors.
  const cdp=await ctx.newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#account-email'});await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['autofill']});eq(await p.locator('#account-email').evaluate(n=>getComputedStyle(n).webkitTextFillColor),'rgb(238, 238, 238)');
  if(width===390){await p.locator('#account-email').fill('');await p.locator('#account-password').fill('');await p.screenshot({path:out+'/login-390.png'});}
  await p.locator('.auth-switch').click();await p.waitForURL('**/hesab?mode=signup&next=%2Fodenis');await p.locator('#account-phone').waitFor();
  eq(await p.locator('.auth-name-row').evaluate(n=>{const [a,b]=n.children;return Math.abs(a.getBoundingClientRect().top-b.getBoundingClientRect().top)<1;}),true);
  eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(await p.locator('#supportWidget').isHidden(),true);
  const signupBefore=signupCalls;await p.locator('.auth-submit').click();eq(signupCalls,signupBefore);
  await p.locator('#account-firstName').fill('Sintetik');await p.locator('#account-lastName').fill('İstifadəçi');await p.locator('#account-email').fill('synthetic@example.invalid');await p.locator('#account-phone').fill('501234567');await p.locator('#account-password').fill('short');await p.locator('#account-terms').check();await p.locator('.auth-submit').click();eq(signupCalls,signupBefore);
  await p.locator('#account-password').fill('Synthetic-password');pendingEmail='';
  await p.setViewportSize({width,height:380});await p.locator('#account-password').focus();await p.locator('.auth-submit').scrollIntoViewIfNeeded();eq(await p.locator('.auth-submit').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.setViewportSize({width,height:800});await p.evaluate(()=>window.scrollTo(0,0));if(width===390)await p.screenshot({path:out+'/signup-390.png'});
  await p.locator('.auth-submit').click();await p.getByRole('heading',{name:'Sifarişini tamamlamaq üçün e-poçtunu təsdiqlə'}).waitFor();await p.getByText('Kod göndərildi.',{exact:false}).waitFor();eq(signupCalls,signupBefore+1);await p.locator('.auth-code-close').click();pendingEmail='';
  await p.goto(origin+'/hesab?next=%2Fodenis');await p.locator('#account-password').waitFor();eq(await p.locator('.auth-code-sheet').isHidden(),true);eq(await p.locator('link[data-shell-persistent="auth-forms"]').count(),1);
  await p.getByRole('link',{name:'Şifrəmi unutdum',exact:true}).click();await p.getByRole('button',{name:'Bərpa keçidini göndər',exact:true}).waitFor();await p.locator('#account-email').fill('synthetic@example.invalid');await p.locator('.auth-submit').click();await p.getByText('Hesab mövcuddursa, bərpa keçidi göndərildi.').waitFor();
  await p.locator('.auth-switch').click();await p.locator('.auth-submit').waitFor();await p.locator('.auth-close').click();await p.waitForURL('**/qrup');eq(await p.evaluate(()=>document.body.classList.contains('auth-screen')),false);
  await p.goto(origin+'/hesab?next=%2Fodenis');await p.locator('.auth-submit').waitFor();eq(await p.locator('.auth-code-sheet').isHidden(),true);eq(errors,[]);
  console.log(JSON.stringify({width,compact:true,keyboard:'reduced viewport simulation',realEmailSent:false}));await ctx.close();
 }
 console.log(JSON.stringify({checks,syntheticMailCalls:mailCalls,realEmailSent:false,externalOAuthTested:false}));
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
