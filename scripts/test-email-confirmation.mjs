import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {makePublicAuth} from '../mirpanel-admin/community/public-auth.mjs';
import {createWelcomeDelivery} from '../mirpanel-admin/community/welcome-delivery.mjs';
import {handlePublicCommunity} from '../mirpanel-admin/community/public-service.mjs';
import {proxyCommunity} from '../functions/_owner-community.js';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const fixture=await shopFixture(),pool=fixture.pool,mail=[],nativeFetch=globalThis.fetch;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,origin);
 const json=(r,s,b)=>{r.writeHead(s,{'content-type':'application/json'});r.end(JSON.stringify(b));};
 try{
  if(u.pathname.startsWith('/api/auth/')){
   const body=async q=>{const chunks=[];for await(const c of q)chunks.push(c);return Buffer.concat(chunks);};
   if(!req.headers['x-test-upstream']){
    const headers=new Headers(req.headers);if(headers.has('origin'))headers.set('origin','https://mirpanel.com');
    const result=await proxyCommunity({request:new Request('https://mirpanel.com'+req.url,{method:req.method,headers,body:req.method==='POST'?await body(req):undefined})});
    const out=Object.fromEntries(result.headers);if(result.headers.has('set-cookie'))out['set-cookie']=result.headers.getSetCookie();
    if(out.location?.startsWith('https://mirpanel.com'))out.location=origin+out.location.slice('https://mirpanel.com'.length);
    res.writeHead(result.status,out);return res.end(Buffer.from(await result.arrayBuffer()));
   }
   return await handlePublicCommunity({req,res,u,origin,runtime:{pool,auth},json,body:async q=>JSON.parse(await body(q))});
  }
  if(u.pathname==='/hesab'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><main id="authApp"></main><script type="module" src="/community-assets/auth-forms.js"></script>');}
  if(['/','/odenis','/sebet','/profil','/mehsul/sintetik'].includes(u.pathname)){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><h1>Sintetik qayıdış</h1><script defer src="/site-header.js"></script>');}
  if(u.pathname==='/site-header.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync('site-header.js'));}
  if(/^\/community-assets\/auth-forms\.(css|js)$/.test(u.pathname)){res.setHeader('content-type',u.pathname.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync('mirpanel-admin/community/public/'+u.pathname.split('/').pop()));}
  res.writeHead(404);res.end();
 }catch(e){if(!res.headersSent)json(res,e.status||500,{message:e.status?e.message:'Synthetic server error'});else res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,clientId='synthetic-google-client';
let failCodeFor;
const send=async(kind,value)=>{if(kind==='code'&&value.user.email===failCodeFor){failCodeFor=null;throw Error('Synthetic provider failure');}mail.push({kind,...value});return {id:'synthetic-accepted'};};
const welcomeDelivery=createWelcomeDelivery(pool,send);
const createAuth=()=>makePublicAuth(pool,{origin,clientId,secret:'synthetic-isolated-secret-32-characters',clientSecret:'synthetic-only'},send,welcomeDelivery);
let auth=createAuth(),testClient=1;
const password='Synthetic-Test-Only',record=(kind,address)=>mail.filter(m=>m.kind===kind&&m.user.email===address);
const cookieJar=()=>new Map();
const request=async(jar,path,data)=>{
 const headers={origin,cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')};
 if(data!==undefined)headers['content-type']='application/json';
 const r=await nativeFetch(origin+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});
 for(const c of r.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
 return r;
};
const call=(j,a,b={})=>request(j,'/api/auth/confirm-email/'+a,b);
const expire=async(address,changes)=>pool.query(`update verification v set value=(v.value::jsonb||$2::jsonb)::text from "user" u where u.email=$1 and v.id='mirpanel-email-code:'||u.id`,[address,JSON.stringify(changes)]);
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),alg:'RS256',use:'sig',kid:'synthetic-google'};
let googleVerified=true,nonce='';
globalThis.fetch=(url,opts)=>{
 const dest=typeof url==='string'?url:url.url||url.href;
 if(dest?.startsWith('https://mirpanel.onrender.com/')){
  const headers=new Headers(opts.headers);headers.set('x-test-upstream','1');headers.set('origin',origin);headers.set('x-forwarded-for','192.0.2.'+testClient);
  return nativeFetch(origin+new URL(dest).pathname+new URL(dest).search,{...opts,headers,duplex:'half'});
 }
 if(dest==='https://www.googleapis.com/oauth2/v3/certs')return Promise.resolve(Response.json({keys:[jwk]}));
 if(dest==='https://oauth2.googleapis.com/token'){
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),now=Math.floor(Date.now()/1000),data=b64({alg:'RS256',kid:jwk.kid})+'.'+b64({iss:'https://accounts.google.com',aud:clientId,sub:'891234567890123',email:'synthetic-google@example.test',email_verified:googleVerified,name:'Sintetik Google',nonce,iat:now,exp:now+300});
  return Promise.resolve(Response.json({id_token:data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url'),access_token:'synthetic-google-token',token_type:'Bearer',expires_in:300}));
 }
 if(dest?.startsWith(origin+'/'))return nativeFetch(url,opts);
 throw Error('External fetch blocked in synthetic verification test');
};
let browser;
try{
 if(process.argv.includes('--registration-recovery')){
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:390,height:800}}),page=await context.newPage(),address='registration-recovery@example.test';
  await page.goto(origin+'/hesab?next=%2Fsebet&from=cart');
  await page.locator('.auth-mode-tabs').getByRole('link',{name:'Qeydiyyat'}).click();
  await page.locator('#account-firstName').fill('Sintetik');await page.locator('.auth-submit').click();
  await page.getByText('Soyadınızı yazın.',{exact:true}).waitFor();
  assert.equal(await page.locator('#account-lastName').evaluate(x=>document.activeElement===x),true);
  for(const [key,value] of Object.entries({lastName:'Hesab',email:address,phone:'501234567',password}))await page.locator('#account-'+key).fill(value);
  await page.locator('#account-terms').check();
  await page.locator('#account-firstName').fill('Mirpanel');await page.locator('.auth-submit').click();
  await page.locator('#account-firstName-error').filter({hasText:'xidməti ad'}).waitFor();
  assert.equal(await page.locator('#account-firstName').evaluate(x=>document.activeElement===x),true);
  assert.equal(await page.locator('#account-email').inputValue(),address);
  await page.locator('#account-firstName').fill('Sintetik');
  await page.route('**/api/auth/confirm-email/start',r=>r.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic lost verification start"}'}),{times:1});
  let signupCalls=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/sign-up/email'))signupCalls++;});
  await page.locator('.auth-submit').click();await page.getByRole('button',{name:'Təsdiqə davam et',exact:true}).waitFor();
  assert.equal((await pool.query('select count(*)::int as n from "user" where email=$1',[address])).rows[0].n,1);
  assert.equal(await page.locator('.auth-code-sheet[open]').count(),0);
  assert.equal(await page.locator('#account-email').inputValue(),address);
  await page.getByText('Hesabınız yaradılıb',{exact:true}).waitFor();
  failCodeFor=address;
  await page.getByRole('button',{name:'Təsdiqə davam et',exact:true}).click();
  await page.waitForURL('**/sebet');
  await page.getByRole('heading',{name:'Sifarişinizi tamamlamaq üçün e-poçtunuzu təsdiqləyin'}).waitFor();
  assert.equal(signupCalls,1);
  assert.equal(await page.locator('.auth-code-address strong').innerText(),address);
  assert.equal(record('code',address).length,0);
  await page.getByRole('button',{name:'Kod göndər',exact:true}).click();
  await page.getByText('Kodun göndərilməsi təsdiqlənmədi.',{exact:false}).waitFor();
  assert.equal(record('code',address).length,0);
  assert.equal(await page.locator('.auth-code-grid').count(),0);
  await expire(address,{sent:0});await page.reload();
  await page.getByRole('button',{name:'Kod göndər',exact:true}).click();
  await page.locator('.auth-code-grid').waitFor();
  await page.locator('.auth-code-grid input').first().fill(record('code',address)[0].code);
  await page.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await page.waitForURL('**/sebet');
  await welcomeDelivery.wake();assert.equal(record('welcome',address).length,1);
  console.log('PASS: failed verification start resumed without repeating signup; successful code returned to cart.');
  await context.close();
 }
 if(!process.argv.includes('--registration-recovery')){
 for(const [width,domain] of [[320,'gmail.com'],[1440,'icloud.com']]){
  // Separate browser/IP scenarios must not consume each other's rate limit.
  testClient++;
  const old='isolated-first-'+width+'@'+domain,address='isolated-new-'+width+'@outlook.com';
  browser??=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width,height:790}}),page=await context.newPage();
  const destination=width===320?'/':'/mehsul/sintetik';
  await page.goto(origin+'/hesab?mode=signup&next='+encodeURIComponent(destination));
  assert.equal(await page.locator('.auth-code-sheet[open]').count(),0);
  for(const [key,value] of Object.entries({firstName:'Sintetik',lastName:'Hesab',email:old,phone:'501234567',password}))await page.locator('#account-'+key).fill(value);
  await page.locator('#account-terms').check();
  if(width===320){
   await page.locator('#account-phone').fill('50123');await page.locator('.auth-submit').click();
   await page.locator('#account-phone-error').filter({hasText:'9 rəqəm'}).waitFor();assert.equal(await page.locator('.auth-code-sheet[open]').count(),0);
   await page.locator('#account-phone').fill('501234567');
  }
  await page.locator('.auth-submit').click();
  await page.waitForURL(origin+destination,{timeout:12000}).catch(async e=>{console.log({width,formError:await page.locator('.auth-feedback').textContent({timeout:1000}).catch(()=>null)});throw e;});
  const sendButton=page.getByRole('button',{name:'Kod göndər',exact:true});
  const reopenVerification=()=>page.evaluate(async()=>{const {requestEmailConfirmation}=await import('/community-assets/auth-forms.js');await requestEmailConfirmation();});
  const reloadVerification=async()=>{await page.reload();if(width===320)await reopenVerification();};
  await sendButton.waitFor();
  assert.equal(record('code',old).length,0);
  assert.equal(await page.getByText('Hesabınız yaradılıb',{exact:true}).count(),1);
  // An already pending cookie must not open the sheet on the signup tab.
  const tab=await context.newPage();
  await tab.goto(origin+'/hesab?mode=signup&next='+encodeURIComponent(destination));
  await tab.getByRole('button',{name:'Təsdiqə davam et',exact:true}).waitFor();
  assert.equal(await tab.locator('.auth-code-sheet[open]').count(),0);
  assert.equal(await tab.getByText('Hesabınız yaradılıb',{exact:true}).count(),0);
  await tab.close();
  if(width===320){
   await page.locator('.auth-code-close').click();
   await page.locator('.auth-code-sheet').waitFor({state:'detached'});
   await page.reload();
   assert.equal(await page.locator('.auth-code-sheet[open]').count(),0);
   const original=(await context.storageState()).cookies.find(c=>c.name.endsWith('.session_token'));
   assert.ok(original?.httpOnly&&original.expires>Date.now()/1000+172800,'signup created a persistent session cookie');
   await pool.query(`update session set "createdAt"="createdAt"-interval '2 days',"updatedAt"="updatedAt"-interval '2 days',"expiresAt"="expiresAt"-interval '2 days' where "userId"=(select id from "user" where email=$1)`,[old]);
   const reopened=await browser.newContext({storageState:{origins:[],cookies:[{...original,expires:original.expires-172800}]}});
   const restored=await reopened.newPage();await restored.goto(origin+'/profil');await restored.reload();
   const restoredSession=await (await reopened.request.get(origin+'/api/auth/get-session')).json();
   assert.equal(restoredSession.user.email,old);assert.equal(restoredSession.user.emailVerified,false);
   assert.equal(await restored.locator('.auth-code-sheet[open]').count(),0);
   assert.equal(record('code',old).length,0);
   await reopened.close();
   await reopenVerification();
  }else{
   await page.reload();await sendButton.waitFor();
  }
  assert.equal(record('code',old).length,0);
  assert.equal(await sendButton.isEnabled(),true);
  await sendButton.click();
  await page.getByRole('heading',{name:'Kodu daxil edin',exact:true}).waitFor();
  await page.locator('.auth-code-grid').waitFor();
  assert.equal(await page.locator('.auth-code-address strong').innerText(),old);
  assert.equal(record('verify',old).length,0);assert.equal(record('code',old).length,1);
  const duplicate=await request(cookieJar(),'/api/auth/sign-up/email',{name:'Sintetik Hesab',email:old,password});
  assert.equal(duplicate.status,409);const duplicateBody=await duplicate.json();assert.equal(duplicateBody.code,'REGISTRATION_EMAIL_EXISTS');assert.equal(duplicateBody.message,'Bu e-poçt ünvanı ilə artıq hesab yaradılıb.');
  assert.equal(await page.locator('.auth-code-resend').isEnabled(),false);
  const j=cookieJar(),external=await call(j,'send');assert.equal(external.status,401);
  const post=(action,data)=>context.request.post(origin+'/api/auth/confirm-email/'+action,{headers:{origin},data});
  const send=await post('send',{});assert.equal(send.status(),429);
  await reloadVerification();await page.locator('.auth-code-grid').waitFor();
  assert.equal(record('code',old).length,1);
  const oldCode=record('code',old)[0].code,wrong=oldCode==='000000'?'000001':'000000';
  await page.locator('.auth-code-grid input').first().fill(wrong);await page.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await page.getByText('Kod düzgün deyil.',{exact:true}).waitFor();
  await expire(old,{expires:0});const expired=await post('verify',{code:oldCode});assert.equal(expired.status(),400);assert.match((await expired.json()).message,/vaxtı bitib/);
  await page.getByRole('button',{name:'Dəyiş',exact:true}).click();await page.getByLabel('Yeni e-poçt ünvanı').fill(address);await page.getByRole('button',{name:'Yadda saxla'}).click();await page.getByText(address,{exact:true}).waitFor();
  const stale=await post('verify',{code:oldCode});assert.equal(stale.status(),400);
  await expire(old,{sent:0});await reloadVerification();await page.getByRole('button',{name:'Kod göndər',exact:true}).click();await page.locator('.auth-code-grid').waitFor();
  const code=record('code',address)[0].code;await page.locator('.auth-code-grid input').first().evaluate((input,code)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',code);input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}));},code);
  await page.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await page.locator('.auth-code-sheet[open]').waitFor({state:'hidden'});
  assert.equal((await (await context.request.get(origin+'/api/auth/get-session')).json()).user.email,address);
  await welcomeDelivery.wake();assert.equal(record('welcome',address).length,1);await page.reload();assert.equal(record('welcome',address).length,1);
  assert.equal((await post('verify',{code})).status(),401);
  assert.equal((await context.request.post(origin+'/api/auth/sign-out',{headers:{origin},data:{}})).ok(),true);
  assert.equal((await (await context.request.get(origin+'/api/auth/get-session')).json())?.user,undefined);
  await context.close();
 }
 async function google(){
  const jar=cookieJar(),start=await request(jar,'/api/auth/sign-in/social',{provider:'google',callbackURL:origin+'/odenis'}),url=new URL((await start.json()).url);
  nonce=url.searchParams.get('nonce');
  return request(jar,'/api/auth/callback/google?code=synthetic&state='+encodeURIComponent(url.searchParams.get('state')));
 }
 testClient++;
 googleVerified=false;
 assert.match((await google()).headers.get('location')||'',/error=/);
 assert.equal(record('welcome','synthetic-google@example.test').length,0);
 googleVerified=true;
 for(let i=0;i<2;i++){assert.equal((await google()).headers.get('location'),origin+'/odenis');await welcomeDelivery.wake();assert.equal(record('welcome','synthetic-google@example.test').length,1);}
 assert.equal(record('code','synthetic-google@example.test').length,0);
 const googleDuplicate=await request(cookieJar(),'/api/auth/sign-up/email',{name:'Sintetik Hesab',email:'synthetic-google@example.test',password});
 assert.equal(googleDuplicate.status,409);assert.equal((await googleDuplicate.json()).code,'REGISTRATION_EMAIL_EXISTS');
 for(const [width,email,manual,blocked] of [[320,'synthetic-google@example.test',false,false],[1440,'isolated-new-1440@outlook.com',true,false],[390,'synthetic-google@example.test',true,true]]){
  testClient++;
  const context=await browser.newContext({viewport:{width,height:790},hasTouch:width<500});
  await context.addInitScript(({blocked})=>{
   window.signupChimes=0;
   if(blocked){window.AudioContext=class{constructor(){throw Error('Audio blocked');}};return;}
   const start=OscillatorNode.prototype.start;
   OscillatorNode.prototype.start=function(...args){window.signupChimes++;return start.apply(this,args);};
  },{blocked});
  const page=await context.newPage();
  await page.goto(origin+'/hesab?mode=signup');
  const values={firstName:'Sintetik',lastName:'Hesab',email,phone:'501234567',password};
  for(const [key,value] of Object.entries(values))await page.locator('#account-'+key).fill(value);
  await page.evaluate(()=>import('/community-assets/auth-forms.js?v=late-preload'));
  await page.locator('#account-terms').check();
  await page.locator('.auth-submit').click();
  const notice=page.locator('.auth-duplicate-notice');
  await notice.getByRole('alert').filter({hasText:'Bu e-poçt ünvanı ilə artıq hesab yaradılıb.'}).waitFor();
  assert.equal(await page.evaluate(()=>window.signupChimes),blocked?0:1);
  assert.equal(await page.locator('.auth-feedback').textContent(),'');
  assert.equal(await page.locator('.auth-legal-link[hidden]').count(),1);
  assert.equal(await page.locator('.auth-switch').isVisible(),true);
  assert.equal(await page.locator('.auth-google').isEnabled(),true);
  for(const [key,value] of Object.entries(values))assert.equal(await page.locator('#account-'+key).inputValue(),value);
  assert.equal(await page.locator('#account-terms').isChecked(),true);
  assert.equal(await notice.evaluate(n=>{const b=n.getBoundingClientRect();return b.top>=0&&b.left>=0&&b.right<=innerWidth;}),true);
  if(manual)await notice.getByRole('button',{name:'Bildirişi bağla'}).click();
  else{
   const timer=notice.locator('.auth-duplicate-timer');
   assert.equal(await timer.evaluate(n=>getComputedStyle(n).animationDuration),'4s');
   const before=await timer.evaluate(n=>n.getBoundingClientRect().width);
   await page.waitForFunction(before=>document.querySelector('.auth-duplicate-timer')?.getBoundingClientRect().width<before*.8,before);
   assert.equal(await notice.isVisible(),true);
  }
  await notice.waitFor({state:'detached',timeout:5000});
  await context.close();
  console.log('PASS duplicate toast:',width,manual?'manual close':'4s auto-close',blocked?'audio blocked':'one chime');
 }
 console.log('PASS: 320px and desktop signup, refresh, wrong code, cooldown, change, verification and return; synthetic Google new/repeat/unverified. No external mail.');
 }
}finally{await welcomeDelivery.stop();globalThis.fetch=nativeFetch;await browser?.close();await new Promise(r=>server.close(r));await fixture.close();}
