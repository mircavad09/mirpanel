// Read-only production visual verification. All non-GET browser requests are intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const base='https://mirpanel.onrender.com';
const before=await fetch(`${base}/api/stories`).then(r=>r.json());
const shape=data=>data.stories.map(s=>({id:s.id,title:s.title,items:s.items.map(i=>i.id)}));
const banners=await fetch(`${base}/api/homepage-banners`).then(r=>r.json());
assert.equal(banners.maxBytes,20*1024*1024);
assert.equal(banners.banners.filter(b=>b.placement==='main').length,1);
assert.equal(banners.banners.filter(b=>b.placement==='side').length,2);
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_BROWSER_PATH,headless:true});
const errors=[],consoleErrors=[],blocked=[],measurements=[];
try {
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){blocked.push(new URL(route.request().url()).pathname);return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});}return route.continue();});
  for(const [width,height] of [[320,568],[390,844],[768,900],[1024,768],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.goto(`https://mirpanel.com/?hero-check=${Date.now()}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelectorAll('.home-side-banner').length===2);
    await page.waitForFunction(()=>[...document.querySelectorAll('#homeHero img')].every(i=>i.complete&&i.naturalWidth));
    await page.waitForFunction(()=>document.querySelectorAll('.home-story').length===2);
    const geometry=await page.evaluate(()=>{const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {root:rect(document.getElementById('homeHero')),main:rect(document.getElementById('heroSlider')),sides:[...document.querySelectorAll('.home-side-banner')].map(rect),fit:[...document.querySelectorAll('#homeHero img')].map(i=>getComputedStyle(i).objectFit),overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),storyCount:document.querySelectorAll('.home-story').length};});
    assert.equal(geometry.overflow,0);assert.ok(geometry.fit.every(f=>f==='cover'));
    if(width>=1024){assert.ok(Math.abs(geometry.main.bottom-geometry.sides[1].bottom)<1);assert.ok(Math.abs(geometry.main.y-geometry.sides[0].y)<1);}
    assert.equal(await page.locator('.slider-arrow:visible').count(),0);
    if(width<768){const moved=await page.evaluate(()=>{const el=document.getElementById('homeSideBanners');el.scrollLeft=el.scrollWidth;return el.scrollLeft;});assert.ok(moved>0);await page.evaluate(()=>document.getElementById('homeSideBanners').scrollLeft=0);}
    measurements.push({viewport:`${width}x${height}`,...geometry});
    if(process.env.MIRPANEL_VISUAL_DIR) await page.screenshot({path:path.join(process.env.MIRPANEL_VISUAL_DIR,`live-hero-${width}.png`)});
    if(width===390){await page.locator('.home-story').first().click();assert.equal(await page.locator('#storyViewer').isVisible(),true);await page.waitForFunction(()=>document.querySelector('#storyMedia img')?.naturalWidth>0);await page.locator('#storyViewerClose').click();assert.equal(await page.locator('#storyViewer').isHidden(),true);}
  }
  const after=await fetch(`${base}/api/stories`).then(r=>r.json());assert.deepEqual(shape(after),shape(before));
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  console.log(JSON.stringify({measurements,storyDataChanges:0,javascriptErrors:errors,consoleErrors,interceptedNonReadRequests:blocked,productionWrites:0},null,2));
} finally {await browser.close();}
