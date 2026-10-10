// Homepage polish only: read-only APIs; no order/card/receipt/WhatsApp operations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const live=process.env.MIRPANEL_POLISH_LIVE==='1',root=process.cwd(),api='https://mirpanel.onrender.com';
const storyShape=data=>data.stories.map(s=>({id:s.id,title:s.title,items:s.items.map(i=>i.id)}));
const before=storyShape(await(await fetch(`${api}/api/stories`)).json());
let server;
if(!live){server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname;const file=path.join(root,name==='/'?'index.html':name);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[ext]||'application/octet-stream'});res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=live?'https://mirpanel.com':`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_BROWSER_PATH,headless:true});
const errors=[],consoleErrors=[],mutations=[],results=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.addInitScript(()=>{const add=window.addEventListener.bind(window);window.polishListenerCount=0;window.addEventListener=(type,...rest)=>{if(type==='mirpanel:grid-rendered')polishListenerCount++;return add(type,...rest);};});
 await page.route('**/*',async route=>{const request=route.request();if(!['GET','HEAD','OPTIONS'].includes(request.method())){mutations.push(new URL(request.url()).pathname);return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});}if(!live&&request.url().startsWith(api+'/api/')){const response=await route.fetch();return route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':base}});}return route.continue();});
 for(const [width,height] of [[320,568],[390,844],[768,900],[1024,768],[1440,900],[1920,1080]]) {
  await page.setViewportSize({width,height});await page.goto(`${base}/?polish-test=${Date.now()}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelectorAll('#grid .card').length>0&&document.querySelectorAll('.home-side-banner').length===2&&document.querySelectorAll('.home-story').length===2).catch(async error=>{console.log(JSON.stringify({errors,consoleErrors,state:await page.evaluate(()=>({cards:document.querySelectorAll('#grid .card').length,sides:document.querySelectorAll('.home-side-banner').length,stories:document.querySelectorAll('.home-story').length}))}));throw error;});
  await page.waitForFunction(()=>{const s=document.getElementById('newSplashScreen');return !s||s.hidden||getComputedStyle(s).display==='none';});
  await page.locator('[data-home-filter="all"]').click();
  assert.equal(await page.locator('#grid .card').first().evaluate(n=>getComputedStyle(n).opacity),'1');
  assert.equal(await page.locator('#grid .card .title').first().evaluate(n=>getComputedStyle(n).webkitLineClamp),'2');
  const geometry=await page.evaluate(()=>{const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};const cards=[...document.querySelectorAll('#grid .card')];return {overflow:document.documentElement.scrollWidth-innerWidth,header:rect(document.getElementById('mainHeader')),brand:rect(document.querySelector('.site-header-brand')),search:rect(document.querySelector('.site-header-tools .site-header-search')),cards:cards.length,cardHeights:[...new Set(cards.map(c=>c.getBoundingClientRect().height))],titleHeights:[...new Set(cards.map(c=>c.querySelector('.title').getBoundingClientRect().height))],font:parseFloat(getComputedStyle(document.querySelector('.site-header-tools input')).fontSize),main:rect(document.getElementById('heroSlider')),sides:[...document.querySelectorAll('.home-side-banner')].map(rect),groupWidth:document.querySelector('.home-quick-group').getBoundingClientRect().width,logoHost:document.getElementById('homeQuickLinks').clientWidth,logoHeights:[...new Set([...document.querySelectorAll('.home-quick-link')].map(n=>n.getBoundingClientRect().height))]};});
  assert.equal(geometry.overflow,0);assert.ok(geometry.font>=16);assert.ok(Math.max(...geometry.cardHeights)-Math.min(...geometry.cardHeights)<1);assert.equal(geometry.titleHeights.length,1);assert.ok(geometry.groupWidth>=geometry.logoHost);assert.deepEqual(geometry.logoHeights,[60]);
  if(width>=1024){assert.ok(geometry.search.x>geometry.brand.right);assert.ok(Math.abs(geometry.main.bottom-geometry.sides[1].bottom)<1);assert.equal(await page.locator('.home-product-ticker').isVisible(),true);assert.equal(await page.evaluate(()=>new Set([...document.querySelectorAll('[data-product-jump]')].map(n=>n.dataset.productJump)).size),geometry.cards);}
  else {assert.ok(geometry.search.y>=geometry.brand.bottom);const open=page.locator('.site-header-menu-button');assert.ok((await open.boundingBox()).width>=44);await open.click();assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');assert.equal(await page.locator('.site-header-drawer-nav a:visible').count(),5);await page.keyboard.press('Escape');assert.equal(await page.locator('.site-header-drawer').isVisible(),false);await open.click();await page.locator('.site-header-menu-close').click();await open.click();await page.locator('.site-header-overlay').click({position:{x:2,y:height-10}});assert.equal(await page.locator('.site-header-drawer').isVisible(),false);}
  assert.equal(await page.locator('#sortSelect').isVisible(),true);assert.ok((await page.locator('#sortSelect').boundingBox()).height>=44);
  if(width<768){await page.locator('#homeSideDots button').last().click();await page.waitForFunction(()=>document.querySelector('#homeSideDots button:last-child').getAttribute('aria-current')==='true');assert.ok(await page.evaluate(()=>document.getElementById('homeSideBanners').scrollLeft>0));await page.locator('#homeSideDots button').first().click();await page.waitForFunction(()=>document.getElementById('homeSideBanners').scrollLeft<1);}
  const input=page.locator('.site-header-tools input');await input.fill('NETFLIX');const upper=await page.locator('#grid .card').count();await input.fill('netflix');assert.equal(await page.locator('#grid .card').count(),upper);assert.ok(upper>0);await input.fill('ŞƏXSİ');const az=await page.locator('#grid .card').count();await input.fill('şəxsi');assert.equal(await page.locator('#grid .card').count(),az);assert.ok(az>0);
  await input.fill('zzzz_not_a_product');assert.equal(await page.locator('#grid .card').count(),0);assert.equal(await page.locator('.home-empty').isVisible(),true);await input.fill('');
  await page.locator('[data-home-filter="premium"]').click();const premium=await page.locator('#grid .card').count();const expected=await page.evaluate(()=>DATA.products.filter(p=>p.active!==false&&p.badge==='Premium').length);assert.equal(premium,expected);await input.fill('Netflix');const filtered=await page.locator('#grid .card').count();assert.equal(filtered,await page.evaluate(()=>DATA.products.filter(p=>p.active!==false&&p.badge==='Premium'&&p.title.toLowerCase().includes('netflix')).length));await input.fill('');await page.locator('[data-home-filter="all"]').click();
  await page.locator('#sortSelect').selectOption('price-asc');const prices=await page.locator('#grid .cornerPrice').allTextContents();const numeric=prices.map(p=>parseFloat(p)||999999);for(let i=1;i<numeric.length;i++)assert.ok(numeric[i]>=numeric[i-1]);
  await page.locator('#sortSelect').selectOption('default');await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
  await page.locator('#homeQuickLinks').hover();assert.equal(await page.locator('.home-quick-track').evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
  await page.mouse.move(0,0);
  if(width>=1024){await page.locator('[data-product-jump]').first().focus();assert.equal(await page.locator('.home-product-ticker-track').evaluate(n=>getComputedStyle(n).animationPlayState),'paused');await page.locator('[data-product-jump]').first().click();assert.equal(await page.locator('.home-card-highlight').count(),1);}
  await page.addScriptTag({url:`${base}/homepage-polish.js`});assert.equal(await page.locator('.home-header-support').count(),1);assert.equal(await page.locator('.home-category-button').count(),1);
  await page.locator('#grid').scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo(0,document.getElementById('grid').getBoundingClientRect().top+scrollY-document.getElementById('mainHeader').offsetHeight-12));
  await page.waitForTimeout(500);
  if(process.env.MIRPANEL_VISUAL_DIR)await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`${live?'live':'local'}-cards-${width}.png`)});
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
  if(process.env.MIRPANEL_VISUAL_DIR)await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`${live?'live':'local'}-polish-${width}.png`)});
  await page.locator('.home-story').first().click();assert.equal(await page.locator('#storyViewer').isVisible(),true);await page.locator('#storyViewerClose').click();assert.equal(await page.locator('#storyViewer').isHidden(),true);
  await page.locator('.footer').scrollIntoViewIfNeeded();assert.equal(await page.locator('.footer').isVisible(),true);assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('waFab')).position),'static');assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('gameBtnOpen')).position),'static');
  if(process.env.MIRPANEL_VISUAL_DIR)await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`${live?'live':'local'}-footer-${width}.png`)});
  assert.equal(await page.evaluate(()=>polishListenerCount),1);results.push({viewport:`${width}x${height}`,...geometry,premiumCount:premium});
 }
 for(const width of [851,900,1100]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);}
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.home-quick-track').evaluate(n=>getComputedStyle(n).animationName),'none');assert.equal(await page.locator('.home-product-ticker-track').evaluate(n=>getComputedStyle(n).animationName),'none');
 assert.deepEqual(storyShape(await(await fetch(`${api}/api/stories`)).json()),before);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log(JSON.stringify({mode:live?'live read-only':'local with read-only production catalogue/media',results,errors,consoleErrors,storyChanges:0,realOrders:0,realReservations:0,interceptedNonReadRequests:mutations},null,2));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
