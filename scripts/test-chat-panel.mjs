import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live'),site=process.argv.includes('--site'),base='https://mirpanel.com';
const out='outputs/chat-panel';await fs.mkdir(out,{recursive:true});
const files=new Map();for(const file of ['support-widget.js','support-widget.css','browser-nav.js','browser-nav.css','site-header.js']){
 const local=await fs.readFile(file,'utf8');files.set('/'+file,local);
 if(live){const r=await fetch(base+'/'+file+'?v=seven-chat-panel-1',{cache:'no-store'});assert.equal(r.status,200);assert.equal((await r.text()).replaceAll('\r',''),local.replaceAll('\r',''),'live '+file);}
}
const expected=[['home','/'],['products','/mehsul'],['payments','/profil?tab=odenislerim'],['balance','/balans'],['orders','/profil?tab=sifarislerim'],['cart','/sebet'],['profile','/profil']];
const questions=['Necə sifariş edə bilərəm?','Ödənişi necə edim?','Çeki necə yükləyim?','Sifarişlərimə haradan baxım?'];
for(const engine of (site?[chromium]:[chromium,webkit])){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){
  const ctx=await browser.newContext({viewport:{width,height:site?800:640},serviceWorkers:'block',recordVideo:site&&width===390?{dir:out,size:{width,height:800}}:undefined});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='wa.me')return route.fulfill({contentType:'text/html',body:'Operator link — synthetic check'});
   if(route.request().method()!=='GET')return route.abort();
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:u.pathname==='/api/community/state'?{profile:null,unreadTags:0}:{items:[],products:[],banners:[],stories:[]}});
   if(files.has(u.pathname)&&!live)return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:files.get(u.pathname)});
   if(site)return route.continue();
   if(u.pathname==='/session-state.js')return route.fulfill({contentType:'text/javascript',body:'export async function getCommunityState(){return {ok:true,data:{profile:null}}} export function invalidateCommunityState(){}'});
   if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#101112;color:white;font:16px system-ui}main{height:1100px;padding:16px}</style><main><h1>MirPanel</h1><p>Söhbət · sintetik yoxlama</p></main><p id="end">Səhifənin sonu</p><script>window.MirpanelCart={read:()=>[{quantity:12}]}</script><script src="/browser-nav.js"></script><script src="/support-widget.js"></script>'});
   if(live&&files.has(u.pathname))return route.continue();
   return route.fulfill({contentType:'text/javascript',body:''});
  });
  await page.goto(base+'/');await page.locator('#aiSupportToggle').waitFor();
  if(site&&await page.locator('#newSplashScreen').count())await page.locator('#newSplashScreen').waitFor({state:'hidden'});
  const launcher=page.getByRole('button',{name:'Söhbət',exact:true});
  if(width<850){
   const nav=page.locator('nav.browser-bottom-nav');await nav.waitFor();
   assert.deepEqual(await nav.locator('a').evaluateAll(es=>es.map(e=>e.dataset.browserNav)),expected.map(e=>e[0]));
   const geo=await nav.locator('a').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
   assert(geo.every(r=>r.w>=44&&r.h>=44&&Math.abs(r.y-geo[0].y)<1));
   assert(Math.abs(geo[3].x+geo[3].w/2-width/2)<1);
   assert.equal(await nav.locator('[data-browser-nav=balance] svg').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 148, 31)');
   assert(await launcher.evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('nav.browser-bottom-nav').getBoundingClientRect().top));
  }
  await launcher.click();await page.locator('#aiSupportPanel.is-open').waitFor();
  const panel=page.getByRole('dialog',{name:'Söhbət',exact:true});
  assert.equal(await panel.getByRole('heading').innerText(),'Söhbət');
  assert.deepEqual(await panel.locator('.support-faq-question').allTextContents(),questions);
  assert.equal(await panel.locator('.support-group').getAttribute('href'),'/qrup');
  assert.equal(await panel.locator('.support-group small').innerText(),'Digər istifadəçilərlə söhbət et');
  assert(await panel.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}));
  for(let i=0;i<4;i++){
   const q=panel.locator('#support-question-'+i),a=panel.locator('#support-answer-'+i);
   await q.click();assert(await a.isVisible());assert((await a.innerText()).length>30);
   await q.click();assert(await a.isHidden());
  }
  await panel.locator('#support-question-2').click();
  await page.screenshot({path:out+'/'+(live?'live':'local')+'-'+engine.name()+'-'+width+'.png'});
  const operator=panel.getByRole('link',{name:'Operatorla danış',exact:true});assert.equal(await operator.getAttribute('href'),'https://wa.me/994515243545');
  const popupPromise=page.waitForEvent('popup');await operator.click();const popup=await popupPromise;await popup.waitForLoadState();assert(popup.url().startsWith('https://wa.me/994515243545'));await popup.close();
  await panel.getByRole('button',{name:'Söhbəti bağla'}).click();await panel.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await launcher.click();await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
  await launcher.click();await page.locator('.support-group').click();await page.waitForURL('**/qrup');
  if(!site&&width<850)for(const [key,url]of expected){await page.locator('nav [data-browser-nav='+key+']').click();await page.waitForURL(base+url);assert.equal(await page.locator('nav [aria-current=page]').getAttribute('data-browser-nav'),key);}
  await page.emulateMedia({reducedMotion:'reduce'});
  if(width<850)assert.equal(await page.locator('nav [data-browser-nav=balance] svg').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(!site)assert.deepEqual(errors,[]);
  const video=page.video();await ctx.close();if(site&&video)await video.saveAs(out+'/'+(live?'live':'local')+'-mobile.webm');
  console.log('PASS',live?'live':'local',site?'site':engine.name(),width,'dialog, four accordions, close, group/operator, seven nav, middle balance, safe targets');
 }}finally{await browser.close();}
}
