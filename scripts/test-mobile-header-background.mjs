import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const live=process.argv.includes('--live'),results=[];let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
fs.mkdirSync('payment-test-artifacts/mobile-header-background',{recursive:true});
try{for(const width of [320,390,430,768,1024,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900}});
 await ctx.addInitScript(()=>sessionStorage.setItem('mirpanel.intro.seen.v1','1'));
 await ctx.route('**/*',r=>!['GET','HEAD'].includes(r.request().method())||r.request().resourceType()==='media'?r.abort():r.continue());
 const p=await ctx.newPage();await p.goto('https://mirpanel.com/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.querySelector('#grid .card')&&window.mirpanelDesktopHeader);await p.waitForTimeout(500);
 const snapshot=()=>p.evaluate(()=>Object.fromEntries(['.site-header','.site-header-brand','.site-header-search','.site-header-tools','.browser-bottom-nav','#homeHero','#homeStories','#grid'].map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return[s,r?{x:r.x,y:r.y,width:r.width,height:r.height}:null];})));
 await p.evaluate(()=>document.fonts.ready);const before=await snapshot();const oldBg=await p.locator('.site-header').evaluate(e=>getComputedStyle(e).backgroundColor);
 if(!live){if(width===390)await p.screenshot({path:'payment-test-artifacts/mobile-header-background/before-390.png'});await p.addStyleTag({content:fs.readFileSync('desktop-header.css','utf8')});}
 const after=await snapshot(),bg=await p.locator('.site-header').evaluate(e=>getComputedStyle(e).backgroundColor);
 eq(bg,'rgb(23, 25, 29)','same desktop anthracite');eq(after,before,'no geometry changes');
 if(width>=1000)eq(bg,oldBg,'desktop unchanged');
 eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
 if(width===390)await p.screenshot({path:`payment-test-artifacts/mobile-header-background/${live?'live':'after'}-390.png`});
 results.push({width,background:bg,geometryUnchanged:true});await ctx.close();
}console.log(JSON.stringify({checks,failures:0,live,results,productionWrites:0}));}finally{await browser.close();}
