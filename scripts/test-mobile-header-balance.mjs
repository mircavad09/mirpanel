import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {withStorefrontHead} from '../storefront-head.mjs';
const live=process.argv.includes('--live'),origin='https://mirpanel.com';
const out=path.resolve('../../outputs/mobile-header-balance');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{for(const width of (process.argv.includes('--desktop')?[1440]:[320,390,430,1440])){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 let profile={user_id:'synthetic-wallet-user',display_name:'Ayan Nümunə',email:'ayan@example.test',balanceCents:550},delay=1200,requests=0;
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==origin)return route.request().method()==='GET'&&(route.request().resourceType()==='image'||['/api/payments/inventory','/api/homepage-banners','/api/stories'].includes(u.pathname))?route.continue():route.abort();
  if(u.pathname==='/api/community/state'){requests++;await sleep(delay);return route.fulfill({json:{profile,unreadTags:0}});}
  if(u.pathname==='/api/payments/shop/wallet')return route.fulfill({json:{cents:profile?.balanceCents||0,items:[],topups:[],more:false}});
  if(u.pathname==='/api/payments/methods')return route.fulfill({json:{methods:[]}});
  if(u.pathname==='/api/payments/inventory')return route.continue();
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{products:[],items:[]}});
  if(route.request().method()!=='GET')return route.abort();
  if(!live&&['/account-header.js','/account-header.css','/browser-nav.js'].includes(u.pathname))return route.fulfill({body:await fs.readFile(u.pathname.slice(1)),contentType:u.pathname.endsWith('.js')?'text/javascript':'text/css'});
  if(!live&& (route.request().isNavigationRequest()||route.request().headers()['x-mirpanel-navigation'])){
   const response=await route.fetch();let html=await response.text();
   html=html.replace(/<div class="account-header-controls account-guest-controls" data-account-session-bootstrap>[\s\S]*?<\/div>/,'');
   return route.fulfill({response,body:withStorefrontHead(html)});
  }
  return route.continue();
 });
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const wallet=p.locator('.account-mobile-balance');
 await p.goto(origin+'/',{waitUntil:'commit'});
 if(width>=1000){await p.locator('.account-toggle').waitFor().catch(async e=>{await p.screenshot({path:path.join(out,'desktop-failure.png')});console.log({errors,requests,body:(await p.locator('.site-header').innerText()).slice(0,800),state:await p.evaluate(()=>window.mirpanelAccountProfile)});throw e;});assert(await wallet.isHidden());assert.match(await p.locator('.desktop-balance').innerText(),/5\.50/);await p.locator('.account-toggle').click();assert.equal(await p.locator('.account-menu-amount').innerText(),'5,50 ₼');assert.deepEqual(errors,[]);console.log('PASS desktop 1440: existing header and wallet preserved');await context.close();continue;}
 await wallet.waitFor();
 assert.equal(await wallet.innerText(),'Balans\n—');const pending=await wallet.boundingBox();
 await p.waitForFunction(()=>document.querySelector('.account-mobile-balance strong')?.textContent==='5,50 ₼').catch(async e=>{console.log({errors,requests,text:await wallet.innerText(),state:await p.evaluate(()=>({profile:window.mirpanelAccountProfile,loaded:window.mirpanelAccountHeader,nav:window.mirpanelSharedNav}))});throw e;});
 assert.deepEqual(await wallet.boundingBox(),pending,'wallet geometry stable after session');
 assert(pending.width>=44&&pending.height>=44);delay=0;
 async function geometry(){
  assert.equal(await wallet.count(),1);assert.equal(await wallet.getAttribute('href'),'/balans');assert(await wallet.locator('strong').evaluate(e=>e.scrollWidth<=e.clientWidth),'amount fits wallet');
  const w=await wallet.boundingBox(),brand=await p.locator('.site-header-brand').boundingBox(),search=await p.locator('.site-header-tools .site-header-search').boundingBox();
  assert(w.x>=brand.x+brand.width-1);assert(Math.abs(w.y+24-brand.y-brand.height/2)<5);assert(search.y>=w.y+w.height);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await geometry();await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,(live?'live':'local')+'-'+width+'.png')});
 for(const cents of [123456789,875,550]){
  profile={...profile,balanceCents:cents};await p.evaluate(()=>window.refreshCommunityNav());
  assert.equal(await wallet.locator('strong').innerText(),({123456789:'1 234 567,89 ₼',875:'8,75 ₼',550:'5,50 ₼'})[cents]);
  await geometry();
 }
 await p.locator('.account-toggle').click();assert.equal(await p.locator('.account-menu-amount').innerText(),'5,50 ₼');
 await p.screenshot({path:path.join(out,(live?'live':'local')+'-menu-'+width+'.png')});
 await p.locator('.account-menu-balance').click();await p.waitForURL('**/balans');
 await p.getByRole('textbox',{name:'Başqa məbləğ'}).waitFor({timeout:7000}).catch(async e=>{console.log({errors,body:(await p.locator('#shopApp').innerText()).slice(0,1200)});throw e;});await geometry();
 await p.waitForFunction(()=>window.MirpanelNavigation&&!window.MirpanelNavigation.pending);
 await p.evaluate(()=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'capcut',planIndex:0,quantity:2}])));
 const cart=await p.evaluate(()=>JSON.stringify(window.MirpanelCart?.read()));
 for(const url of ['/mehsul','/profil','/']){
  await p.evaluate(url=>window.MirpanelNavigation.go(url),url);await p.waitForFunction(()=>!window.MirpanelNavigation.pending);await geometry();
 }
 await wallet.click();await p.waitForURL('**/balans');await p.getByRole('textbox',{name:'Başqa məbləğ'}).waitFor();
 assert.equal(await p.evaluate(()=>JSON.stringify(window.MirpanelCart?.read())),cart);
 await p.reload();await p.locator('.account-toggle').waitFor();await geometry();
 profile=null;await p.evaluate(()=>window.refreshCommunityNav());await p.locator('.account-guest-toggle').waitFor();assert.equal(await wallet.count(),0);
 await p.locator('.account-guest-toggle').click();assert.equal(await p.locator('.account-guest-signup').isVisible(),true);
 assert.deepEqual(errors,[]);console.log(`PASS ${live?'live':'local'} ${width}: pending, current/long balance, profile menu, SPA routes, top-up, cart, reload, guest`);
 await context.close();
}}finally{await browser.close();}
