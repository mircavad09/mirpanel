import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const out='payment-test-artifacts/intro-session';fs.mkdirSync(out,{recursive:true});const results=[];
try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900}});
 await ctx.route('**/*',r=>!['GET','HEAD'].includes(r.request().method())||r.request().resourceType()==='media'?r.abort():r.continue());
 await ctx.addInitScript(()=>{window.introTiming={start:null,end:null,productsDuringIntro:false};new MutationObserver(()=>{const e=document.querySelector('#newSplashScreen'),t=window.introTiming;if(!e)return;if(!e.hidden&&t.start===null)t.start=performance.now();if(!e.hidden&&document.querySelector('#grid .card'))t.productsDuringIntro=true;if(e.hidden&&t.start!==null&&t.end===null)t.end=performance.now();}).observe(document,{subtree:true,attributes:true,childList:true});});
 const page=await ctx.newPage();await page.goto('https://mirpanel.com/',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.introTiming.start!==null);await page.waitForTimeout(1100);
 await page.screenshot({path:`${out}/live-intro-${width}.png`});
 await page.waitForFunction(()=>window.introTiming.end!==null);
 const timing=await page.evaluate(()=>({...window.introTiming,duration:Math.round(window.introTiming.end-window.introTiming.start)}));
 const skipped=[];
 for(const path of ['/mehsul','/sifarislerim','/qrup','/profil','/']){
  await page.goto('https://mirpanel.com'+path,{waitUntil:'domcontentloaded'});
  skipped.push({path,skipped:await page.evaluate(()=>!document.querySelector('#newSplashScreen')||document.querySelector('#newSplashScreen').hidden)});
 }
 await page.reload({waitUntil:'domcontentloaded'});const reload=await page.evaluate(()=>window.introTiming.start===null);
 await page.goBack({waitUntil:'domcontentloaded'});const back=await page.evaluate(()=>!document.querySelector('#newSplashScreen')||document.querySelector('#newSplashScreen').hidden);
 await page.goForward({waitUntil:'domcontentloaded'});const forward=await page.evaluate(()=>!document.querySelector('#newSplashScreen')||document.querySelector('#newSplashScreen').hidden);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
 if(timing.duration<2800||timing.duration>3400||skipped.some(v=>!v.skipped)||!reload||!back||!forward||overflow)throw Error('INTRO_LIVE_CHECK_FAILED');
 results.push({width,...timing,skipped,reload,back,forward,overflow});await ctx.close();
}fs.writeFileSync(out+'/live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({results,productionWrites:0}));}finally{await browser.close();}
