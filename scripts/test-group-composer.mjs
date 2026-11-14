import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live'),site=process.argv.includes('--site'),out=path.resolve('../../outputs/group-compose');await fs.mkdir(out,{recursive:true});
const base='https://mirpanel.com';
for(const engine of (site?[chromium]:[chromium,webkit])){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
try{for(const width of (site?[390,1440]:[320,390,430,1440])){
 const mobile=width<800,record=engine===chromium&&width===390;
 const ctx=await browser.newContext({viewport:{width,height:850},isMobile:mobile,hasTouch:mobile,ignoreHTTPSErrors:true,recordVideo:record?{dir:out,size:{width:390,height:850}}:undefined});
 const page=await ctx.newPage(),errors=[],posts=[];page.on('pageerror',e=>errors.push(e.message));let fail=true;
 const make=(id,own=false,role='member')=>({id:String(id),body:id===1?'Salam! MirPanel qrupuna xoş gəlmisiniz.':'Sınaq mesajı '+id+' — Məhsullar haqqında söhbət.',createdAt:'2026-11-14T08:30:00Z',author:{id:own?'synthetic-me':'synthetic-'+id,name:role==='admin'?'MirPanel':role==='bot'?'Nəzarətçi':own?'Siz':'İştirakçı',avatar:0,tier:'standard',role}});
 const items=Array.from({length:36},(_,i)=>make(i+1,i%4===0,i===1?'admin':i===2?'bot':'member'));
 const state={publicCommunity:true,profile:{user_id:'synthetic-me',name:'Sınaq istifadəçisi'},counts:{members:245,online:12},initialMessages:{items,more:false,settings:{}}};
 await ctx.addInitScript(()=>{
  class Stream extends EventTarget{constructor(){super();window.testStream=this;}close(){this.closed=true;}}
  window.EventSource=Stream;const v=new EventTarget();v.height=850;v.offsetTop=0;v.width=screen.width;Object.defineProperty(window,'visualViewport',{value:v,configurable:true});
 });
 await ctx.route('**/*',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;
  if(p==='/api/community/state')return route.fulfill({json:state});
  if(p==='/api/community/messages'&&route.request().method()==='POST'){posts.push(route.request().postDataJSON());return route.fulfill({status:fail?503:200,json:fail?{error:'Sınaq bağlantı xətası. Yenidən cəhd edin.'}:{ok:true}});}
  if(p.startsWith('/api/'))return route.fulfill({json:{items,profile:state.profile,more:false}});
  if(route.request().method()!=='GET')return route.abort();
  if(p==='/qrup'&&site)return route.continue();
  if(p==='/qrup')return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/chat-layout.css"><body class="community-page"><header class="site-header" style="height:70px;background:#17191c;display:flex;align-items:center;padding-left:18px;box-sizing:border-box"><strong style="color:#ffda00">MIRPANEL</strong></header><main id="communityApp" class="community-shell"></main><nav class="community-bottom-nav" style="position:relative;display:grid;grid-template-columns:repeat(3,1fr);height:54px"><a href="/">Ana səhifə</a><a href="/qrup">Söhbət</a><a href="/profil">Profilim</a></nav><script type="module" src="/community-assets/community.js?v=chat-compose-1"></script></body></html>`});
  if(live&&['/community-assets/community.js','/community-assets/chat-layout.css'].includes(p))return route.continue();
  if(site&&live)return route.continue();
  const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
  try{return route.fulfill({path:file,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto(base+'/qrup');const input=page.getByRole('textbox',{name:'Mesaj',exact:true}),send=page.getByRole('button',{name:'Göndər',exact:true}),list=page.locator('.community-messages');await input.waitFor();assert(await send.isDisabled());
 const initial=await input.boundingBox();assert(initial.height>=44&&initial.height<50);
 for(let n=1;n<=6;n++){await input.fill(Array.from({length:n},(_,i)=>'Sətir '+(i+1)+' — sınaq mətni').join('\n'));if(record)await page.waitForTimeout(350);}
 const six=await input.evaluate(n=>({h:n.clientHeight,scroll:n.scrollHeight,overflow:getComputedStyle(n).overflowY}));assert(six.h>=152);assert(six.scroll<=six.h+1,JSON.stringify(six));
 await input.fill(Array.from({length:30},(_,i)=>'Uzun mətn '+i+' sınaq üçün yazılır.').join('\n'));
 const long=await input.evaluate(n=>({h:n.offsetHeight,scroll:n.scrollHeight,overflow:getComputedStyle(n).overflowY}));assert(long.h<=850/3+1&&long.h>=154,JSON.stringify(long));assert.equal(long.overflow,'auto');
 if(mobile){await input.focus();await page.evaluate(()=>{visualViewport.height=480;visualViewport.dispatchEvent(new Event('resize'));});assert(await page.locator('html').evaluate(n=>n.classList.contains('chat-keyboard-open')));assert(await page.locator('.community-bottom-nav,.browser-bottom-nav').first().isHidden());assert((await input.boundingBox()).y+(await input.boundingBox()).height<=480);await page.evaluate(()=>{visualViewport.height=850;visualViewport.dispatchEvent(new Event('resize'));});}
 await input.fill('Göndəriş alınmasa bu mətn saxlanmalıdır.');await send.click();await page.getByText('Sınaq bağlantı xətası. Yenidən cəhd edin.',{exact:true}).waitFor();assert.equal(await input.inputValue(),'Göndəriş alınmasa bu mətn saxlanmalıdır.');assert(await send.isEnabled());
 fail=false;await send.click();await page.waitForFunction(()=>document.querySelector('.community-compose textarea').value==='');assert.equal(posts[0].clientId,posts[1].clientId);assert((await input.boundingBox()).height<=46);assert(await send.isDisabled());
 await list.evaluate(n=>n.scrollTop=120);const top=await list.evaluate(n=>n.scrollTop);await page.evaluate(m=>testStream.dispatchEvent(new MessageEvent('messages',{data:JSON.stringify({items:[m]})})),make(40));await page.locator('[data-message-id="40"]').waitFor();assert(Math.abs(await list.evaluate(n=>n.scrollTop)-top)<2);
 await page.getByRole('button',{name:'Yeni mesajlar ↓',exact:true}).click();assert(await list.evaluate(n=>n.scrollHeight-n.scrollTop-n.clientHeight<2));
 const sendBox=await send.boundingBox();assert(sendBox.width>=44&&sendBox.height>=44);
 assert(await page.locator('.is-own').first().evaluate(n=>getComputedStyle(n).alignSelf==='flex-end'));assert(await page.locator('[data-author-role=admin]').count());assert(await page.locator('[data-author-role=bot]').count());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await input.fill('Birinci sətir\nİkinci sətir\nÜçüncü sətir\nDördüncü sətir\nBeşinci sətir\nAltıncı sətir');await page.screenshot({path:path.join(out,(live?'live':'local')+'-'+engine.name()+'-'+width+'.png')});
 if(record){await input.fill('');await page.waitForTimeout(700);for(const line of ['Salam, MirPanel!','Məhsullar haqqında sualım var.','Bir neçə sətir yazıram.','Əvvəlki mətn görünür.','Beşinci sətir də buradadır.','Altıncı sətir tam görünür.']){const text=await input.inputValue();await input.fill(text+(text?'\n':'')+line);await page.waitForTimeout(500);}await page.waitForTimeout(900);}
 const video=page.video();await ctx.close();if(video)await video.saveAs(path.join(out,(live?'live':'local')+'-growing-composer.webm'));
 console.log(JSON.stringify({engine:engine.name(),width,sixLines:true,pasteCap:true,keyboardViewport:mobile?'simulated':'desktop',failurePreservesDraft:true,retrySameId:true,successResets:true,newMessageDoesNotJump:true,iconTarget:true}));
 }}finally{await browser.close();}}
