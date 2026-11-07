import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {makePublicAuth} from '../mirpanel-admin/community/public-auth.mjs';
import {handlePublicCommunity} from '../mirpanel-admin/community/public-service.mjs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const fixture=await shopFixture(),pool=fixture.pool,mail=[],nativeFetch=globalThis.fetch;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,origin);
 const json=(r,s,b)=>{r.writeHead(s,{'content-type':'application/json'});r.end(JSON.stringify(b));};
 try{
  if(u.pathname.startsWith('/api/auth/'))return await handlePublicCommunity({req,res,u,origin,runtime:{pool,auth},json,body:async q=>{const chunks=[];for await(const c of q)chunks.push(c);return JSON.parse(Buffer.concat(chunks));}});
  if(u.pathname==='/hesab'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><main id="authApp"></main><script type="module" src="/community-assets/auth-forms.js"></script>');}
  if(u.pathname==='/odenis'){res.setHeader('content-type','text/html');return res.end('<h1>Sintetik ödəniş</h1>');}
  if(/^\/community-assets\/auth-forms\.(css|js)$/.test(u.pathname)){res.setHeader('content-type',u.pathname.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync('mirpanel-admin/community/public/'+u.pathname.split('/').pop()));}
  res.writeHead(404);res.end();
 }catch(e){if(!res.headersSent)json(res,e.status||500,{message:e.status?e.message:'Synthetic server error'});else res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,clientId='synthetic-google-client';
const auth=makePublicAuth(pool,{origin,clientId,secret:'synthetic-isolated-secret-32-characters',clientSecret:'synthetic-only'},async(kind,value)=>mail.push({kind,...value}));
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
 for(const [width,domain] of [[320,'gmail.com'],[1440,'icloud.com']]){
  const old='isolated-first-'+width+'@'+domain,address='isolated-new-'+width+'@outlook.com';
  browser??=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width,height:790}}),page=await context.newPage();
  await page.goto(origin+'/hesab?mode=signup&next=%2Fodenis');
  for(const [key,value] of Object.entries({firstName:'Sintetik',lastName:'Hesab',email:old,phone:'501234567',password}))await page.locator('#account-'+key).fill(value);
  await page.locator('#account-terms').check();
  await page.locator('.auth-submit').click();
  await page.getByRole('heading',{name:'E-poçtunu təsdiqlə'}).waitFor();
  assert.equal(record('verify',old).length,0);assert.equal(record('code',old).length,0);
  await page.getByRole('button',{name:'E-poçta kod göndər',exact:true}).click();
  await page.getByRole('heading',{name:'Kodu daxil et'}).waitFor();
  assert.equal(await page.locator('.auth-code-resend').isEnabled(),false);
  const j=cookieJar(),external=await call(j,'send');assert.equal(external.status,401);
  const post=(action,data)=>context.request.post(origin+'/api/auth/confirm-email/'+action,{headers:{origin},data});
  const send=await post('send',{});assert.equal(send.status(),429);
  await page.reload();await page.getByRole('heading',{name:'Kodu daxil et'}).waitFor();
  const oldCode=record('code',old)[0].code,wrong=oldCode==='000000'?'000001':'000000';
  await page.locator('.auth-code-grid input').first().fill(wrong);await page.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await page.getByText('Kod düzgün deyil.',{exact:true}).waitFor();
  await expire(old,{expires:0});const expired=await post('verify',{code:oldCode});assert.equal(expired.status(),400);assert.match((await expired.json()).message,/vaxtı bitib/);
  await page.getByRole('button',{name:'Dəyiş',exact:true}).click();await page.getByLabel('Yeni e-poçt ünvanı').fill(address);await page.getByRole('button',{name:'Yadda saxla'}).click();await page.getByText(address,{exact:true}).waitFor();
  const stale=await post('verify',{code:oldCode});assert.equal(stale.status(),400);
  await expire(old,{sent:0});await page.reload();await page.getByRole('button',{name:'E-poçta kod göndər',exact:true}).click();await page.getByRole('heading',{name:'Kodu daxil et'}).waitFor();
  const code=record('code',address)[0].code;await page.locator('.auth-code-grid input').first().evaluate((input,code)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',code);input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}));},code);
  await page.getByRole('button',{name:'Təsdiqlə',exact:true}).click();await page.waitForURL('**/odenis');
  assert.equal((await (await context.request.get(origin+'/api/auth/get-session')).json()).user.email,address);
  assert.equal(record('welcome',address).length,1);await page.reload();assert.equal(record('welcome',address).length,1);
  assert.equal((await post('verify',{code})).status(),401);
  await context.close();
 }
 async function google(){
  const jar=cookieJar(),start=await request(jar,'/api/auth/sign-in/social',{provider:'google',callbackURL:origin+'/odenis'}),url=new URL((await start.json()).url);
  nonce=url.searchParams.get('nonce');
  return request(jar,'/api/auth/callback/google?code=synthetic&state='+encodeURIComponent(url.searchParams.get('state')));
 }
 googleVerified=false;
 assert.match((await google()).headers.get('location')||'',/error=/);
 assert.equal(record('welcome','synthetic-google@example.test').length,0);
 googleVerified=true;
 for(let i=0;i<2;i++){assert.equal((await google()).headers.get('location'),origin+'/odenis');assert.equal(record('welcome','synthetic-google@example.test').length,1);}
 assert.equal(record('code','synthetic-google@example.test').length,0);
 console.log('PASS: 320px and desktop signup, refresh, wrong code, cooldown, change, verification and return; synthetic Google new/repeat/unverified. No external mail.');
}finally{globalThis.fetch=nativeFetch;await browser?.close();await new Promise(r=>server.close(r));await fixture.close();}
