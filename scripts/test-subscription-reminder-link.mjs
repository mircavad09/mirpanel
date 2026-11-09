import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {subscriptionReminderMail} from '../mirpanel-admin/community/order-delivery.mjs';
import {profileShell} from '../mirpanel-admin/community/public/profile-shell.js';
import {authFormPolicy} from '../mirpanel-admin/community/auth-form-policy.mjs';

const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT||
 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const name='Sınaq abunəliyi',path='/profil?tab=subscriptions',email='reminder@example.test';
const entry={id:'11111111-1111-4111-8111-111111111111',title:name,productId:'synthetic',plan:'1 ay',
 days:5,expiresOn:'2026-11-15',progress:25,renewalCents:500,options:[{index:0,key:'month',label:'1 ay',cents:500,canRenew:true}]};
const profile={user_id:'test-account',display_name:'Sınaq hesabı',email,member_number:1,balanceCents:500,avatar:0,emailVerified:true};
const base='mirpanel-admin/community/public/';
const server=http.createServer((request,response)=>{
 const u=new URL(request.url,'http://127.0.0.1'),p=u.pathname;
 const json=data=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data));};
 const html=(body,script)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html>
  <html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/community-assets/community.css"><body>${body}${script?'<script type="module" src="'+script+'"></script>':''}</body></html>`);};
 if(p==='/mail'){
  const mail=subscriptionReminderMail({event_key:'test'}, {entry,account:{name:'Sınaq hesabı',email}},'http://127.0.0.1:'+server.address().port);
  return html(mail.htmlBody);
 }
 if(p==='/profil')return html('<main id="communityApp" class="community-shell" data-profile-entry>'+profileShell(u.search)+'</main>','/community-assets/profile-entry.js');
 if(p==='/hesab')return html('<main id="authApp" class="community-shell"></main>','/community-assets/auth-forms.js');
 if(p==='/api/auth/sign-in/email'){
  response.setHeader('Set-Cookie','signed=1; Path=/; HttpOnly; SameSite=Lax');
  return json({user:profile});
 }
 if(p==='/api/community/state')return json({profile:request.headers.cookie?.includes('signed=1')?profile:null,authFormPolicy,googleEnabled:false,publicCommunity:true});
 if(p==='/api/payments/shop/subscriptions')return json({accountId:profile.user_id,subscriptions:[entry]});
 if(p.startsWith('/api/'))return json({});
 const file=p.startsWith('/community-assets/')?base+p.slice(18):p.slice(1);
 if(/\.(js|css|svg|png)$/.test(file)&&!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){
  response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'image/png');
  return response.end(fs.readFileSync(file));
 }
 response.writeHead(404);response.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(8000);
  await page.goto(origin+'/mail');
  await page.getByRole('link',{name:'Abunəliklərimə bax',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/hesab'&&url.searchParams.get('next')===path);
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill('Synthetic-only-123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(origin+path);
  await page.getByText(name,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Yenilə',exact:true}).waitFor();
  await page.goto(origin+'/mail');
  await page.getByRole('link',{name:'Abunəliklərimə bax',exact:true}).click();
  await page.waitForURL(origin+path);
  await page.getByText(name,{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS '+width+'px: mail opens subscriptions directly and returns there after sign-in');
  await context.close();
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
