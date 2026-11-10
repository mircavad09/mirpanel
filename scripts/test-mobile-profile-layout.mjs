import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {profileShell,profileCSS} from '../mirpanel-admin/community/public/profile-shell.js';
const live=process.env.MIRPANEL_MOBILE_LIVE==='1';
const header=await fs.readFile('customer-header.html','utf8');
const profile={user_id:'synthetic-mobile',display_name:'miri sınaq',email:'demo@example.invalid',member_number:1001,balanceCents:0,avatar:0,emailVerified:true,tier:{id:'standard',next:{id:'bronze'},remainingCents:3000,progress:0}};
const json={
 '/api/community/state':{profile,googleEnabled:true},
 '/api/community/profile-summary':{orderCount:0,latestOrder:null},
 '/api/community/account-panel':{products:[],wishlist:[],expensesCents:0,completedOrders:0},
 '/api/payments/my-orders/codes':{accountId:profile.user_id,codes:[]},
 '/api/payments/my-orders':{accountId:profile.user_id,orders:[],topups:[]}
};
function html(search){return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="${profileCSS}" data-shell-persistent></head><body class="community-page profile-screen">${header}<main id="communityApp" class="community-shell" data-profile-entry>${profileShell(search)}</main><script type="module" src="/community-assets/profile-entry.js?v=mobile-profile-1"></script><script defer src="/site-header.js?v=mobile-profile-1"></script></body></html>`;}
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',png:'image/png',svg:'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/profil'){res.setHeader('Content-Type',types.html);return res.end(html(u.search));}
 if(u.pathname==='/mehsul'){res.setHeader('Content-Type',types.html);return res.end('<!doctype html><html><head><title>Məhsullar</title></head><body><main class="catalog-grid">Kataloq</main></body></html>');}
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.split('/').at(-1):u.pathname.slice(1);
 if(!/^[\w/.-]+$/.test(file)||file.includes('..')){res.writeHead(404);return res.end();}
 try{const bytes=await fs.readFile(file);res.setHeader('Content-Type',types[file.split('.').at(-1)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}
});
if(!live)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
const output=path.resolve('../../outputs/mobile-profile');await fs.mkdir(output,{recursive:true});
try{
 for(const [engine,width] of [[chromium,320],[chromium,390],[chromium,430],[webkit,390],[chromium,1440]]){
  const desktop=width>1000;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const page=await browser.newPage({viewport:{width,height:900},hasTouch:!desktop,isMobile:!desktop,reducedMotion:'reduce',deviceScaleFactor:1});page.setDefaultTimeout(9000);
   await page.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(r.request().method()!=='GET'||u.origin!==origin)return r.abort();
    if(live&&u.pathname==='/profil')return r.fulfill({contentType:types.html,body:html(u.search)});
    if(u.pathname.startsWith('/api/'))return r.fulfill({status:Object.hasOwn(json,u.pathname)?200:404,json:json[u.pathname]||{}});
    return r.continue();
   });
   await page.goto(origin+'/profil');await page.locator('.profile-hero').waitFor();
   const search=page.locator('.site-header-inner .site-header-search input');
   await page.locator('.account-toggle > .account-icon').waitFor();
   if(!desktop){
    await page.locator('.profile-support-slot #aiSupportToggle').waitFor();
    await page.waitForFunction(()=>document.querySelector('.site-header-tools input')?.placeholder==='Məhsul axtar…');
    const geometry=await page.evaluate(()=>{
     const rect=s=>document.querySelector(s).getBoundingClientRect(), tools='.site-header-tools ';
     const strip=document.querySelector('.account-tabs'),bounds=strip.getBoundingClientRect(),tabs=[...strip.children].map(n=>n.getBoundingClientRect());
     const hero=rect('.profile-hero'),wa=rect('#waFab'),ai=rect('#aiSupportToggle'),nav=rect('.browser-bottom-nav'),input=rect(tools+'input');
     const canvas=document.createElement('canvas').getContext('2d'),style=getComputedStyle(document.querySelector(tools+'input'));canvas.font=style.font;
     return {heights:['.site-header-menu-button','.site-header-search','.account-bell','.account-toggle'].map(s=>rect(tools+s).height),
      centers:['.site-header-menu-button','.site-header-search','.account-bell','.account-toggle'].map(s=>{const r=rect(tools+s);return r.top+r.height/2;}),
      placeholderFits:input.width>=canvas.measureText('Məhsul axtar…').width,
      inputWidth:input.width,textWidth:canvas.measureText('Məhsul axtar…').width,tabRight:bounds.right,tabs:tabs.map(r=>[r.left,r.right]),
      tools:[...document.querySelector('.site-header-tools').children].map(n=>[n.className,n.getBoundingClientRect().width]),
      clippedTab:tabs.some(r=>r.left<bounds.right&&r.right>bounds.right),scrollable:strip.scrollWidth>strip.clientWidth,
      overflow:document.documentElement.scrollWidth>innerWidth,
      dock:wa.top>=hero.bottom+8&&ai.top>=hero.bottom+8&&wa.right<ai.left&&wa.bottom<nav.top&&ai.bottom<nav.top,
      stats:[...document.querySelectorAll('.profile-summary-stats .profile-stat')].map(n=>n.getBoundingClientRect().height)
     };
    });
    assert.deepEqual(geometry.heights,[44,44,44,44]);assert(Math.max(...geometry.centers)-Math.min(...geometry.centers)<1);
    assert(geometry.placeholderFits&&geometry.scrollable&&geometry.clippedTab&&!geometry.overflow&&geometry.dock,JSON.stringify(geometry));
    assert.equal(geometry.stats[0],geometry.stats[1]);
    const frame=search.locator('..');
    const border=()=>frame.evaluate(form=>getComputedStyle(form).borderColor);
    const idle=await border();
    await search.focus();
    assert.notEqual(await border(),idle);
    const styles=await search.evaluate(input=>{
     const style=getComputedStyle(input),icon=input.previousElementSibling;
     const center=node=>{const box=node.getBoundingClientRect();return box.top+box.height/2;};
     return {border:style.borderWidth,outline:style.outlineWidth,background:style.backgroundColor,shadow:style.boxShadow,aligned:Math.abs(center(input)-center(icon))<1};
    });
    assert.deepEqual(styles,{border:'0px',outline:'0px',background:'rgba(0, 0, 0, 0)',shadow:'none',aligned:true});
    await search.blur();
    await page.getByRole('button',{name:'Üzlüyü dəyiş'}).waitFor();
    if(width===390&&engine===chromium)await page.screenshot({path:path.join(output,live?'mirpanel-canli-assets-sintetik-profil-390.png':'mirpanel-sintetik-profil-390.png')});
    await page.locator('#aiSupportToggle').click();await page.locator('#aiSupportPanel').waitFor();
    await page.locator('#aiSupportClose').click();
    await page.locator('#aiSupportPanel').waitFor({state:'hidden'});
    await page.locator('.account-tabs').evaluate(n=>n.scrollLeft=n.scrollWidth);
    assert(await page.locator('.account-tabs').evaluate(n=>n.scrollLeft)>0);
    await page.locator('[data-account-tab=expenses]').click();
    await page.locator('[data-account-tab=expenses][aria-current=page]').waitFor();
    assert(await page.locator('[data-account-tab=expenses]').evaluate(n=>n.getBoundingClientRect().right<=n.parentElement.getBoundingClientRect().right+1));
    assert.equal(await page.locator('body > #supportWidget').count(),1);
   }else{
    assert.equal(await page.locator('.account-tabs').evaluate(n=>getComputedStyle(n).flexDirection),'column');
    assert.equal(await page.locator('.profile-action-mobile').first().isVisible(),false);
    assert.equal(await search.getAttribute('placeholder'),'Məhsul, xidmət axtar...');
   }
   await page.locator('.account-toggle > .account-icon').click();
   await page.locator('#accountDropdown').waitFor();
   await page.locator('#accountDropdown a[href="/profil"]').click();
   await page.locator('.profile-hero').waitFor();
   await search.fill('Netflix');await search.press('Enter');
   await page.waitForURL('**/mehsul?search=Netflix');
   assert.equal(await page.locator('body > #supportWidget').count(),1);
   if(live&&width===390&&engine===chromium){
    const guest=await browser.newPage({viewport:{width,height:900},hasTouch:true,isMobile:true,reducedMotion:'reduce',deviceScaleFactor:1});
    await guest.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await guest.locator('.account-guest-toggle').waitFor();
    await guest.waitForFunction(()=>document.querySelector('.site-header-tools input')?.placeholder==='Məhsul axtar…'&&document.getElementById('newSplashScreen')?.hidden!==false);
    assert(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await guest.screenshot({path:path.join(output,'mirpanel-canli-qonaq-basliq-390.png')});await guest.close();
   }
   console.log(JSON.stringify({liveAssets:live,engine:engine.name(),width,profile:true,search:true,dock:!desktop,syntheticAccount:true}));
  }finally{await browser.close();}
 }
}finally{if(!live)await new Promise(r=>server.close(r));}
