import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live'),base='https://mirpanel.com',out='outputs/bottom-chat-nav';
await fs.mkdir(out,{recursive:true});
const files=new Map();
for(const f of ['browser-nav.js','browser-nav.css']){
 const local=await fs.readFile(f,'utf8');
 if(live){const r=await fetch(base+'/'+f+'?v=orange-chat-nav-1');assert.equal((await r.text()).replaceAll('\r',''),local.replaceAll('\r',''));}
 files.set('/'+f,local);
}
const routes=[['home','/'],['products','/mehsul'],['payments','/profil?tab=payments'],['balance','/balans'],['orders','/profil?tab=orders'],['cart','/sebet'],['group','/qrup'],['profile','/profil']];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
 for(const width of [320,390,430]){
  const context=await browser.newContext({viewport:{width,height:800},recordVideo:width===390&&engine===chromium?{dir:out,size:{width,height:800}}:undefined});
  const page=await context.newPage();
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(files.has(u.pathname))return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:files.get(u.pathname)});
   if(u.pathname==='/session-state.js')return route.fulfill({contentType:'text/javascript',body:'export async function getCommunityState(){return {ok:true,data:{profile:null}}} export function invalidateCommunityState(){}'});
   if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#121314;color:#fff;font:16px system-ui}main{height:1200px;padding:16px}</style><main><h1>MirPanel · Sınaq</h1><p>Mobil alt menyu</p></main><p id="end">Səhifənin sonu</p><script>window.MirpanelCart={read:()=>[{quantity:12}]}</script><script src="/browser-nav.js"></script>'});
   return route.fulfill({contentType:'text/javascript',body:''});
  });
  await page.goto(base+'/');
  for(const [key,url] of routes){
   const link=page.locator('nav.browser-bottom-nav [data-browser-nav='+key+']');
   await link.click();await page.waitForURL(base+url);
   await page.locator('link[href*="browser-nav.css"]').waitFor({state:'attached'});
   await page.waitForFunction(()=>document.querySelector('nav.browser-bottom-nav')?.getBoundingClientRect().height>0);
   assert.equal(await page.locator('nav.browser-bottom-nav a').count(),8);
   assert.equal(await page.locator('nav.browser-bottom-nav [aria-current=page]').count(),1);
   assert.equal(await page.locator('nav.browser-bottom-nav [aria-current=page]').getAttribute('data-browser-nav'),key);
   assert(await page.locator('nav.browser-bottom-nav').evaluate(nav=>[...nav.children].every(a=>{const r=a.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth;})));
  }
  const balance=page.locator('nav [data-browser-nav=balance]'),box=await balance.boundingBox();
  assert.equal(await balance.locator('svg').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 148, 31)');
  await page.waitForTimeout(700);assert.deepEqual(await balance.boundingBox(),box);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await balance.locator('svg').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
  assert(await page.locator('#end').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('nav.browser-bottom-nav').getBoundingClientRect().top));
  await page.screenshot({path:out+'/'+engine.name()+'-'+width+'.png'});
  await context.close();
  console.log(engine.name(),width,'PASS 8 links, active state, 44px targets, stable animation, reduced motion, end content');
 }
 }finally{await browser.close();}
}
