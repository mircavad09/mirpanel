import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';
import {authReturn} from '../mirpanel-admin/community/public-service.mjs';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const destination='/balans?returnTo=%2Fqrup&flow=gift#balansi-artir',origin='https://mirpanel.com';
assert.equal(authReturn(origin,destination),origin+destination);assert.equal(authReturn(origin,origin+destination),origin+destination);
for(const bad of ['https://other.invalid','//other.invalid','/balans?returnTo=https://other.invalid&flow=gift',destination+'&next=//other.invalid'])assert.equal(authReturn(origin,bad),origin+'/profil');
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local'),file='mirpanel-admin/community/public/'+u.pathname.slice('/community-assets/'.length);
 if(u.pathname.startsWith('/community-assets/')&&!file.includes('..')&&fs.existsSync(file)){res.setHeader('content-type',path.extname(file)==='.css'?'text/css':'text/javascript');return res.end(fs.readFileSync(file));}
 res.setHeader('content-type','text/html;charset=utf-8');res.end(`<meta name="viewport" content="width=device-width"><main></main><script type="module">
 import {renderAuthForms} from '/community-assets/auth-forms.js?v=gift-return-3';
 const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const [key,v]of Object.entries(attrs))if(v!=null)n.setAttribute(key,v);n.append(...children.filter(c=>c!=null));return n;};const button=(label,action)=>{const n=el('button',{},label);n.type='button';n.onclick=action;return n;},link=(label,href,cls)=>el('a',{href,class:cls||''},label);window.authCalls=[];
 await renderAuthForms({app:document.querySelector('main'),state:{googleEnabled:true},api:async(path,data)=>{authCalls.push({path,data});return{};},el,button,link,alert:()=>el('p'),signal:new AbortController().signal});</script>`);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});try{for(const width of [390,1440])for(const mode of ['login','signup']){
 const page=await browser.newPage({viewport:{width,height:900}});await page.goto(base+'/hesab?mode='+mode+'&next='+encodeURIComponent(destination));const close=page.getByRole('link',{name:'Bağla və balans səhifəsinə qayıt',exact:true});await close.waitFor();assert.equal(await close.getAttribute('href'),destination);await page.getByRole('button',{name:'Google ilə davam edin',exact:true}).click();assert.equal(await page.evaluate(()=>authCalls.find(x=>x.path==='/api/auth/sign-in/social')?.data.callbackURL),base+destination);console.log(JSON.stringify({engine:name,width,mode,giftDestinationPreserved:true,unsafeRedirectsRejected:true,liveAuth:0}));await page.close();
 }}finally{await browser.close();}}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
