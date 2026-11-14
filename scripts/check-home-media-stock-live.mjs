import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='outputs/home-recovery';fs.mkdirSync(out,{recursive:true});
const results=[],record=process.argv.includes('--video'),onlyWebkit=process.argv.includes('--webkit');
for(const engine of onlyWebkit?[webkit]:[chromium]){
 const b=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [390,1440]){
  let ctx,page;const iterations=record?1:onlyWebkit?2:10;
  for(let iteration=0;iteration<iterations;iteration++){
   const cold=iteration%2===0;
   if(cold||!ctx){if(ctx)await ctx.close();ctx=await b.newContext({viewport:{width,height:900},serviceWorkers:'block',...(record?{recordVideo:{dir:out,size:{width,height:900}}}:{})});await ctx.route('**/*',r=>!['GET','HEAD'].includes(r.request().method())||r.request().resourceType()==='media'?r.abort():r.continue());page=await ctx.newPage();}
   const errors=[],responses=[],starts=new Map();const onError=e=>errors.push(e.message),onRequest=r=>starts.set(r,Date.now()),onResponse=r=>{const p=new URL(r.url()).pathname;if(['/api/stories','/api/homepage-banners','/api/community/state','/api/payments/inventory'].includes(p))responses.push({path:p,status:r.status(),ms:Date.now()-(starts.get(r.request())||Date.now())});};
   page.on('pageerror',onError);page.on('request',onRequest);page.on('response',onResponse);
   const began=Date.now();await page.goto('https://mirpanel.com/',{waitUntil:'domcontentloaded'});
   let success=true;
   try{await page.waitForFunction(()=>{const image=document.querySelector('#heroSlider .active img'),story=document.querySelector('.home-story img'),product=typeof DATA!=='undefined'?DATA.products.find(p=>p.id==='capcut'):null;return image?.complete&&image.naturalWidth&&story?.complete&&story.naturalWidth&&!document.querySelector('#homeHero').hidden&&!document.querySelector('#homeStories').hidden&&window.MirpanelInventory&&product&&!MirpanelInventory.productState(product).unavailable&&!document.querySelector('#inventoryServiceStatus');},null,{timeout:40000});}catch{success=false;}
   const state=await page.evaluate(()=>({bannerImages:document.querySelectorAll('#heroSlider .slide').length,stories:document.querySelectorAll('.home-story').length,products:document.querySelectorAll('#grid .card').length,warning:document.querySelector('#inventoryServiceStatus')?.textContent||null,overflow:document.documentElement.scrollWidth>innerWidth}));
   results.push({engine:engine.name(),width,iteration:iteration+1,cold,success,readyMs:Date.now()-began,...state,errors,responses});console.log(JSON.stringify(results.at(-1)));
   if(record){await page.screenshot({path:out+'/live-'+width+'.png'});await page.waitForTimeout(700);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#heroSlider .active img')?.naturalWidth>0&&document.querySelector('.home-story img')?.naturalWidth>0,null,{timeout:25000});await page.waitForTimeout(1200);const video=page.video();await ctx.close();ctx=null;fs.renameSync(await video.path(),out+'/live-'+width+'.webm');}
   page.off('pageerror',onError);page.off('request',onRequest);page.off('response',onResponse);
   assert.ok(success,'homepage media and inventory ready');assert.equal(state.overflow,false);assert.deepEqual(errors,[]);
   if(iteration===iterations-1&&ctx){const background=await ctx.newPage();await background.goto('about:blank');await background.bringToFront();await page.bringToFront();await background.close();assert.equal(await page.locator('#homeHero').isVisible(),true);assert.equal(await page.locator('#homeStories').isVisible(),true);}
  }if(ctx)await ctx.close();
 }}finally{await b.close();}
}
fs.writeFileSync(out+'/'+(record?'live-video':onlyWebkit?'live-webkit':'live-openings')+'.json',JSON.stringify({results,productionWrites:0},null,2));
