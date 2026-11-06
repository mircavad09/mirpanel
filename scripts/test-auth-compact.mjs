import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {authFormPolicy} from '../mirpanel-admin/community/auth-form-policy.mjs';
// Real form, router and header assets; only account/mail responses are synthetic.
const out='payment-test-artifacts/auth-compact';fs.mkdirSync(out,{recursive:true});
let checks=0,mailCalls=0,loginCalls=0,signupCalls=0;
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
  if(u.pathname==='/api/auth/send-verification-email'){mailCalls++;return json(res,200,{ok:true});}
  if(u.pathname==='/api/auth/sign-up/email'){signupCalls++;return json(res,200,{ok:true});}
  if(u.pathname==='/api/auth/request-password-reset'){mailCalls++;return json(res,200,{ok:true});}
 }
 if(['/hesab','/qrup'].includes(u.pathname)){
  res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/community.css"><body class="community-page">'+header+'<main id="communityApp" class="community-shell"></main><div id="supportWidget"><button id="waFab">WhatsApp</button><button id="aiSupportToggle">AI</button></div><script src="/site-header.js"></script><script type="module" src="/community-assets/community.js"></script></body></html>');
 }
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
 if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [320,360,390,430,1440]){
  const ctx=await browser.newContext({viewport:{width,height:800}}),p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/hesab?next=%2Fodenis');await p.locator('.auth-submit').waitFor();
  eq(await p.locator('h1').textContent(),'Giriş');eq(await p.locator('.auth-verification').isHidden(),true);
  eq(await p.locator('#supportWidget').isHidden(),true);eq(await p.locator('.browser-bottom-nav').isHidden(),true);
  eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  eq(await p.locator('.auth-google-g').evaluate(n=>n.complete&&n.naturalWidth>0&&n.width===n.height),true);
  const count=loginCalls;await p.locator('.auth-submit').click();eq(loginCalls,count);
  await p.locator('#account-email').fill('bad');await p.locator('#account-password').fill('Synthetic-password');await p.locator('.auth-submit').click();eq(loginCalls,count);
  await p.locator('#account-email').fill('invalid@example.invalid');await p.locator('.auth-submit').click();await p.getByText('E-poçt və ya şifrə düzgün deyil.').waitFor();eq(await p.locator('.auth-verification').isHidden(),true);
  await p.getByRole('button',{name:'Şifrəni göstər',exact:true}).click();eq(await p.locator('#account-password').getAttribute('type'),'text');await p.getByRole('button',{name:'Şifrəni gizlət',exact:true}).click();eq(await p.locator('#account-password').getAttribute('type'),'password');
  await p.locator('#account-email').fill('unverified@example.invalid');await p.locator('.auth-submit').click();await p.locator('.auth-verification').waitFor({state:'visible'});await p.getByRole('button',{name:'Təsdiq məktubunu yenidən göndər',exact:true}).click();await p.getByText('Təsdiq tələb olunursa, məktub göndərildi.').waitFor();
  await p.locator('#account-email').fill('different@example.invalid');eq(await p.locator('.auth-verification').isHidden(),true);
  // Force Chrome's real autofill pseudo-state, then inspect the rendered colors.
  const cdp=await ctx.newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#account-email'});await cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['autofill']});eq(await p.locator('#account-email').evaluate(n=>getComputedStyle(n).webkitTextFillColor),'rgb(238, 238, 238)');
  if(width===390){await p.locator('#account-email').fill('');await p.locator('#account-password').fill('');await p.screenshot({path:out+'/login-390.png'});}
  await p.locator('.auth-switch').click();await p.waitForURL('**/hesab?mode=signup&next=%2Fodenis');await p.locator('#account-phone').waitFor();
  eq(await p.locator('.auth-name-row').evaluate(n=>{const [a,b]=n.children;return Math.abs(a.getBoundingClientRect().top-b.getBoundingClientRect().top)<1;}),true);
  eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(await p.locator('#supportWidget').isHidden(),true);
  const signupBefore=signupCalls;await p.locator('.auth-submit').click();eq(signupCalls,signupBefore);
  await p.locator('#account-firstName').fill('Sintetik');await p.locator('#account-lastName').fill('İstifadəçi');await p.locator('#account-email').fill('synthetic@example.invalid');await p.locator('#account-phone').fill('501234567');await p.locator('#account-password').fill('short');await p.locator('#account-terms').check();await p.locator('.auth-submit').click();eq(signupCalls,signupBefore);
  await p.locator('#account-password').fill('Synthetic-password');await p.locator('.auth-submit').click();await p.getByText('E-poçtunuza göndərilən təsdiq keçidini açın.').waitFor();eq(signupCalls,signupBefore+1);
  await p.setViewportSize({width,height:380});await p.locator('#account-password').focus();await p.locator('.auth-submit').scrollIntoViewIfNeeded();eq(await p.locator('.auth-submit').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.setViewportSize({width,height:800});await p.evaluate(()=>window.scrollTo(0,0));if(width===390)await p.screenshot({path:out+'/signup-390.png'});
  await p.locator('.auth-switch').click();await p.locator('#account-password').waitFor();eq(await p.locator('.auth-verification').isHidden(),true);eq(await p.locator('link[data-shell-persistent="auth-forms"]').count(),1);
  await p.getByRole('link',{name:'Şifrəmi unutdum',exact:true}).click();await p.getByRole('button',{name:'Bərpa keçidini göndər',exact:true}).waitFor();await p.locator('#account-email').fill('synthetic@example.invalid');await p.locator('.auth-submit').click();await p.getByText('Hesab mövcuddursa, bərpa keçidi göndərildi.').waitFor();
  await p.locator('.auth-switch').click();await p.locator('.auth-submit').waitFor();await p.locator('.auth-close').click();await p.waitForURL('**/qrup');eq(await p.evaluate(()=>document.body.classList.contains('auth-screen')),false);
  await p.goto(origin+'/hesab?next=%2Fodenis');await p.locator('.auth-submit').waitFor();eq(await p.locator('.auth-verification').isHidden(),true);eq(errors,[]);
  console.log(JSON.stringify({width,compact:true,keyboard:'reduced viewport simulation',realEmailSent:false}));await ctx.close();
 }
 console.log(JSON.stringify({checks,syntheticMailCalls:mailCalls,realEmailSent:false,externalOAuthTested:false}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
