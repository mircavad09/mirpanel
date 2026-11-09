import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {profileCSS,profileShell} from '../mirpanel-admin/community/public/profile-shell.js';

const profile={user_id:'menu-fixture',display_name:'Menyu sınağı',email:'menu@example.invalid',member_number:1001,balanceCents:0,avatar:0,tier:{id:'standard',progress:0}};
let signouts=0;
const fixtures={
 '/api/community/state':{profile},
 '/api/community/account-panel':{accountId:profile.user_id,products:[],wishlist:[],expensesCents:0,completedOrders:0},
 '/api/community/profile-summary':{orderCount:0,latestOrder:null},
};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/qrup'){res.setHeader('Content-Type','text/html');return res.end('<h1>Qrup</h1>');}
 if(u.pathname==='/profil'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="${profileCSS}"><body class="profile-screen community-page"><main id="communityApp" class="community-shell" data-profile-entry>${profileShell(u.search)}</main><script type="module" src="/community-assets/profile-entry.js?v=profile-menu-2"></script>`);
 }
 if(u.pathname==='/api/auth/sign-out'){signouts++;res.writeHead(200,{'Content-Type':'application/json'});return res.end('{}');}
 if(fixtures[u.pathname]){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(fixtures[u.pathname]));}
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.split('/').at(-1):u.pathname.slice(1);
 if(file.includes('..')){res.writeHead(404);return res.end();}
 try{const b=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(b);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const output=process.env.MIRPANEL_MENU_OUTPUT;
const colors=locator=>locator.evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,color:s.color};});
try{
 for(const [engine,width] of [[chromium,1440],[chromium,390],[webkit,390]]){
  const mobile=width<600;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const page=await browser.newPage({viewport:{width,height:950},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
   await page.goto(origin+'/profil?tab=expenses');
   await page.getByText('0 təsdiqlənmiş alış · AZN').waitFor();
   const nav=page.locator('.account-tabs'),links=nav.locator('a');
   assert.deepEqual(await links.allTextContents(),['Profilim','Sifarişlərim','Kodlarım','Abunəliklərim','Ödənişlərim','Xərclərim']);
   assert.deepEqual(await nav.locator('.account-menu-heading').allTextContents(),['ALIŞ-VERİŞ','BALANS']);
   assert.equal(await nav.locator('[aria-current=page]').getAttribute('data-account-tab'),'expenses');
   const target=nav.locator('[data-account-tab=codes]'),logout=nav.getByRole('button',{name:'Çıxış'});
   const original=await colors(target);
   if(!mobile){
    assert.equal(Math.round((await page.locator('.account-sidebar').boundingBox()).width),288);
    await target.hover();assert.deepEqual(await colors(target),{background:'rgb(229, 229, 225)',color:'rgb(23, 25, 27)'});
    await page.mouse.move(1000,900);assert.deepEqual(await colors(target),original);
    await logout.hover();assert.equal((await colors(logout)).color,'rgb(180, 35, 35)');
    await page.mouse.move(1000,900);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus-visible').count(),1);
    await page.locator('[data-account-tab=profile]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus-visible').getAttribute('data-account-tab'),'orders');
    assert.equal(await page.locator(':focus-visible').evaluate(n=>getComputedStyle(n).outlineWidth),'3px');
    if(output){await fs.mkdir(output,{recursive:true});await nav.screenshot({path:output+'/profil-menyu.png'});}
   }else{
    await target.scrollIntoViewIfNeeded();
    const box=await target.boundingBox();
    if(engine===chromium){
     const session=await page.context().newCDPSession(page);
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
     await page.waitForTimeout(100);
     assert.equal((await colors(target)).background,'rgb(229, 229, 225)');
     await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    }else{
     await target.evaluate(n=>n.addEventListener('click',e=>e.preventDefault(),{once:true}));
     await target.tap();
    }
    await page.waitForTimeout(150);
    assert.equal((await colors(target)).background,original.background);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await logout.click();
   await page.waitForURL('**/qrup');
   console.log(JSON.stringify({engine:engine.name(),width,grouping:true,interaction:true,logout:true}));
  }finally{await browser.close();}
 }
 assert.equal(signouts,3);
}finally{await new Promise(r=>server.close(r));}
