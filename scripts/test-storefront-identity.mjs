import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest} from '../functions/_middleware.js';
import {onRequest as cartShell} from '../functions/sebet.js';
import {onRequest as authShell} from '../functions/hesab.js';
import {withStorefrontHead} from '../storefront-head.mjs';

const live=process.argv.includes('--live');
const privateRoutes=['/sebet','/odenis','/balans','/qrup','/hesab','/profil'];
const pages=['/','/mehsul','/mehsul/capcut-pro','/haqqimizda','/sertler','/elaqe','/qrup','/sifarislerim','/hesab','/profil',...['orders','codes','subscriptions','payments','expenses'].map(tab=>'/profil?tab='+tab),'/sebet','/odenis','/balans'];
const header=await fs.readFile('customer-header.html','utf8');
const mime={js:'text/javascript',css:'text/css',html:'text/html; charset=utf-8',png:'image/png',webp:'image/webp',svg:'image/svg+xml'};
const shell=pathname=>{
 const shop=['/sebet','/odenis','/balans'].includes(pathname);
 return withStorefrontHead(`<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MirPanel</title><link rel="stylesheet" href="/site-header.css"></head><body class="community-page">${header}<main id="${shop?'shopApp':'communityApp'}"></main><script defer src="/site-header.js?v=storefront-identity-1"></script></body></html>`);
};
let local;
const server=http.createServer(async(req,res)=>{
 const request=new Request(local+req.url,{headers:req.headers});
 const response=await onRequest({request,next:async(next=request)=>{
  const pathname=new URL(next.url).pathname;
  if(pathname==='/sebet'||pathname==='/hesab'){
   const handle=pathname==='/sebet'?cartShell:authShell;
   const headerAsset=()=>new Response(header,{headers:{'Content-Type':mime.html}});
   return handle({request:new Request('https://mirpanel.com'+pathname),next:headerAsset,env:{ASSETS:{fetch:headerAsset}}});
  }
  if(privateRoutes.includes(pathname))return new Response(shell(pathname),{headers:{'Content-Type':mime.html}});
  const file=pathname==='/'?'index.html':pathname==='/sifarislerim'?'sifarislerim.html':pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+pathname.slice(18):pathname.slice(1);
  if(!/^[\w/.-]+$/.test(file)||file.includes('..'))return new Response(null,{status:404});
  try{
   return new Response(await fs.readFile(file),{headers:{'Content-Type':mime[file.split('.').at(-1)]||mime.html}});
  }catch{return new Response(null,{status:404});}
 }});
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
local='http://127.0.0.1:'+server.address().port;
const origin=live?'https://mirpanel.com':local;
const user=(id,avatar)=>({user_id:id,display_name:'Synthetic '+id,email:id+'@example.invalid',avatarUrl:'/community-assets/avatar-'+avatar+'.webp',balanceCents:500,tier:{id:'standard',progress:0}});
const first=user('a','robot'),second=user('b','pinqvin');

try{
 for(const [engine,width] of [[chromium,1440],[webkit,390]]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   for(const signed of [true,false]){
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
    let profile=signed?first:null;
    await page.addInitScript(()=>{
     sessionStorage.setItem('mirpanel.intro.seen','1');
     window.guestSeen=false;
     window.pendingSeen=false;
     new MutationObserver(()=>{if(document.querySelector('.account-guest-toggle'))window.guestSeen=true;}).observe(document,{childList:true,subtree:true});
     new MutationObserver(()=>{if(document.querySelector('[data-account-session-bootstrap]'))window.pendingSeen=true;}).observe(document,{childList:true,subtree:true});
    });
    await page.route('**/*',async route=>{
     const url=new URL(route.request().url());
     if(url.origin!==origin)return route.abort();
     if(url.pathname==='/api/community/state'){
      await new Promise(resolve=>setTimeout(resolve,220));
      return route.fulfill({json:{profile,unreadTags:0,counts:{members:0,online:0}}});
     }
     if(url.pathname==='/api/auth/sign-out'){profile=null;return route.fulfill({json:{ok:true}});}
     if(url.pathname==='/api/community/notifications')return route.fulfill({json:{items:[],unread:0}});
     if(url.pathname==='/api/payments/shop/wallet')return route.fulfill({status:profile?200:401,json:profile?{cents:500,items:[],topups:[]}:{error:'Login'}});
     if(url.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],orders:[],subscriptions:[],codes:[],accountId:profile?.user_id,products:[],managed:true,banners:[]}});
     if(live&&url.pathname==='/profil')return route.fulfill({contentType:mime.html,body:shell('/profil')});
     return route.continue();
    });
    async function identity(){
     const logo=page.locator('.site-header-brand');
     assert.equal(await logo.getAttribute('href'),'/');
     await page.waitForFunction(()=>document.querySelector('.site-header-brand img')?.naturalWidth>0);
     const icons=await page.locator('head link[rel~="icon"]').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname));
     assert.deepEqual(icons,['/assets/logo.png']);
     if(profile){
      const avatar=page.locator('.account-toggle .account-avatar img');
      await avatar.waitFor();
      assert.equal(await avatar.getAttribute('src'),profile.avatarUrl);
      assert.equal(await page.evaluate(()=>window.guestSeen),false);
      assert.equal(await page.locator('#accountDropdown a[href="/profil"]').textContent(),'Profilim');
     }else{
      await page.locator('.account-guest-toggle').waitFor();
      assert.equal(await page.locator('.account-toggle').count(),0);
     }
    }
    for(const path of pages){
     if(live&&path.startsWith('/profil')&&!signed)continue;
     await page.goto(origin+path,{waitUntil:'domcontentloaded'});
     await identity();
     assert(await page.evaluate(()=>window.pendingSeen),path+' has neutral initial markup');
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await identity();
    const brand=await page.locator('.site-header-brand').elementHandle();
    const avatar=signed?await page.locator('.account-toggle img').elementHandle():null;
    await page.waitForFunction(()=>window.MirpanelNavigation);
    await page.locator('.site-header-brand').click();
    await page.waitForURL(origin+'/');
    await page.waitForFunction(()=>!window.MirpanelNavigation.pending);
    await identity();
    await page.goBack();
    await page.waitForURL(origin+'/balans');
    await page.waitForFunction(()=>!window.MirpanelNavigation.pending);
    await identity();
    assert(await brand.evaluate(n=>n===document.querySelector('.site-header-brand')));
    if(!live){
     for(const path of pages.filter(path=>signed||!path.startsWith('/profil'))){
      await page.evaluate(path=>window.MirpanelNavigation.go(path),path);
      assert(await brand.evaluate(n=>n===document.querySelector('.site-header-brand')),path+' preserves the header');
      await identity();
     }
    }
    if(signed){
     assert(await avatar.evaluate(n=>n===document.querySelector('.account-toggle img')));
     await page.getByRole('button',{name:'Bildirişlər',exact:true}).click();
     await page.locator('#accountNotifications').waitFor();
     await page.keyboard.press('Escape');
     await page.locator('.account-toggle').click();
     assert.equal(await page.locator('#accountDropdown a[target="_blank"]').getAttribute('href'),'https://wa.me/994515243545');
     profile=second;
     await page.evaluate(()=>window.refreshCommunityNav());
     await identity();
     assert(!await avatar.evaluate(n=>n.isConnected));
     await page.locator('.account-toggle').click();
     await page.locator('#accountDropdown').getByRole('button',{name:'Çıxış'}).click();
     await page.locator('.account-guest-toggle').waitFor();
     assert.equal(await page.locator('#accountDropdown img,.account-toggle img').count(),0);
    }
    console.log(JSON.stringify({engine:engine.name(),width,signed,live,ok:true}));
    await page.close();
   }
  }finally{await browser.close();}
 }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
