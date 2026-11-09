import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live');
const origin=live?'https://mirpanel.com':'https://mirpanel.test';
const images=['#175583','#59277e','#8e3f2d'];
const story='<button class="home-story"><span class="home-story-cover"></span><span>Story</span></button>';
const slides=images.map((color,i)=>`<a class="slide${i?'':' active'}" href="/mehsul/test"><img class="full-slide-img" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='670'%3E%3Crect width='1600' height='670' fill='%23${color.slice(1)}'/%3E%3C/svg%3E"></a>`).join('');
const app=await fs.readFile('app.js','utf8');
const code=app.slice(app.indexOf('let disposeSlider;'),app.indexOf('const $ = (id)',app.indexOf('let disposeSlider;')));
const markup=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/stories.css"><body class="home-page"><section class="wrap home-banner-layout" id="homeHero"><div class="hero-slider-box" id="heroSlider">${slides}</div></section><section class="wrap home-stories" id="homeStories"><div class="home-stories-track" id="homeStoriesTrack">${story.repeat(3)}</div></section><script>${code}\ninitSlider();</script>`;
for(const [engine,width] of [[chromium,1440],[chromium,390],[webkit,390]].slice(0,live?1:3)){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 const mobile=width<600;
 const page=await browser.newPage({viewport:{width,height:900},hasTouch:mobile,isMobile:mobile,...(live&&process.env.MIRPANEL_VIDEO?{recordVideo:{dir:process.env.MIRPANEL_VIDEO,size:{width:1280,height:800}}}:{})});
 try{
  if(!live)await page.route(origin+'/**',async route=>{
   const file=new URL(route.request().url()).pathname.slice(1);
   return file?route.fulfill({contentType:'text/css',body:await fs.readFile(file,'utf8')}):route.fulfill({contentType:'text/html; charset=utf-8',body:markup});
  });
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  const banner=page.locator('#heroSlider'),counter=banner.locator('.hero-count');
  await counter.waitFor({timeout:25000});
  await page.locator('.home-story-cover').first().waitFor();
  const total=Number((await counter.innerText()).split('/')[1]);
  assert(total>1);
  const previous=banner.getByRole('button',{name:'Əvvəlki banner'}),next=banner.getByRole('button',{name:'Növbəti banner'});
  if(live)await banner.scrollIntoViewIfNeeded();
  const y=await banner.evaluate(n=>n.getBoundingClientRect().top);
  if(!mobile){
   const covers=await page.locator('.home-story-cover').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().left));
   assert(Math.abs(covers[0]-(await banner.boundingBox()).x)<2);
   if(covers.length>2)assert(Math.abs((covers[2]-covers[1])-(covers[1]-covers[0]))<1);
  }
  const act=b=>mobile?b.tap():b.click();
  const current=Number((await counter.innerText()).split('/')[0]);
  await act(previous);
  const expected=current===1?total:current-1;
  await page.waitForFunction(x=>document.querySelector('.hero-count').textContent===x,expected+'/'+total);
  await act(next);
  await page.waitForFunction(x=>document.querySelector('.hero-count').textContent===x,current+'/'+total);
  assert.equal(page.url(),origin+'/');
  const started=Date.now();
  await page.waitForTimeout(2400);
  const progress=await banner.locator('.hero-progress').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).a);
  assert(progress>.35&&progress<.7,progress);
  await page.waitForFunction(x=>document.querySelector('.hero-count').textContent!==x,current+'/'+total,{timeout:4500});
  assert(Date.now()-started>=4750&&Date.now()-started<6400);
  assert.equal(await counter.innerText(),(current===total?1:current+1)+'/'+total);
  assert(Math.abs((await banner.evaluate(n=>n.getBoundingClientRect().top))-y)<2);
  if(!live){
   await banner.evaluate(n=>{n.querySelectorAll('.slide:not(.active)').forEach(s=>s.remove());window.initSlider();});
   assert.equal(await counter.innerText(),'1/1');
   assert(await previous.isHidden()&&await next.isHidden()&&await banner.locator('.hero-progress').isHidden());
  }
  console.log(JSON.stringify({engine:engine.name(),width,total,live,ok:true}));
 }finally{
  await page.close();
  if(live&&process.env.MIRPANEL_VIDEO)await page.video().saveAs(process.env.MIRPANEL_VIDEO+'/banner-kecidi.webm');
  await browser.close();
 }
}
