// Read-only live homepage observation. No customer/session credentials or writes.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('PHASE_REQUIRED');
const out='payment-test-artifacts/home-loading';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.route('**/*',r=>!['GET','HEAD'].includes(r.request().method())||r.request().resourceType()==='media'?r.abort():r.continue());
 await context.addInitScript(()=>{sessionStorage.setItem('mirpanel.intro.seen.v1','1');window.homeTiming={cls:0,banner:null,products:null,story:null};new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.homeTiming.cls+=e.value;}).observe({type:'layout-shift',buffered:true});function tick(){const m=window.homeTiming,b=document.querySelector('#heroSlider .active img'),s=document.querySelector('.home-story img');if(b?.complete&&b.naturalWidth&&m.banner===null)m.banner=performance.now();if(s?.complete&&s.naturalWidth&&m.story===null)m.story=performance.now();if(document.querySelector('#grid .card')&&m.products===null)m.products=performance.now();requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 const page=await context.newPage(),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.name));page.on('response',r=>{if(r.status()===404)missing.push(new URL(r.url()).pathname);});
 await page.goto('https://mirpanel.com/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(6500);
 const metrics=await page.evaluate(()=>({...window.homeTiming,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),productCount:document.querySelectorAll('#grid .card').length}));
 await page.screenshot({path:`${out}/live-${phase}-${width}.png`});results.push({width,...metrics,jsErrors:errors,missing404:missing});await context.close();
 }fs.writeFileSync(`${out}/live-${phase}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
