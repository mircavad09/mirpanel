// Read-only browser measurements. Each round opens a fresh context.
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const origin=process.env.MIRPANEL_MEASURE_ORIGIN||'https://mirpanel.com',rounds=Number(process.env.MIRPANEL_MEASURE_RUNS||5);
const groups=process.argv.slice(2),slug='capcut-pro',detail='/mehsul/'+slug;
const mobileCap=process.env.MIRPANEL_MEASURE_CDP==='1',homeOnly=process.env.MIRPANEL_MEASURE_HOME_ONLY==='1';
const states=[['home','#grid a[href="'+detail+'"]'],['list','.catalog-grid a[href="'+detail+'"]'],['detail','#pp-main-title']];
async function ready(p,s){await p.locator(s).first().waitFor({timeout:22000});}
async function turn(p,action,selector,path){
 const started=await p.evaluate(()=>{window.measureTransition=performance.now();return {id:window.measureDocument,epoch:performance.timeOrigin+window.measureTransition};});
 await action();
 await p.waitForURL(u=>u.pathname===path,{waitUntil:'commit'});
 await ready(p,selector);
 return p.evaluate(({started,selector})=>{
  const first=window.measureTarget;
  const same=started.id===window.measureDocument;
  const result={document:same?'same':'new',reaction:same&&first!=null?Math.max(0,Math.round(first-window.measureTransition)):Math.max(0,Math.round(performance.timeOrigin+(performance.getEntriesByType('paint')[0]?.startTime??performance.now())-started.epoch)),content:Math.round(performance.timeOrigin+performance.now()-started.epoch)};
  if(!document.querySelector(selector))throw Error('Route content missing');return result;
 },{started,selector});
}
for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
 const selected=[[390,false],[390,true],[1440,false],[1440,true]].filter(([width,weak])=>!groups.length||groups.includes(name+'-'+width+'-'+(weak?'weak':'normal')));
 if(!selected.length)continue;
 const browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const [width,weak] of selected)for(let run=1;run<=rounds;run++){
  const c=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  try{
   await c.addInitScript(()=>{
    window.measureDocument=Math.random();
    if('PerformanceObserver'in window)try{new PerformanceObserver(l=>{window.measureLCP=Math.round(l.getEntries().at(-1)?.startTime||0);}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
    window.addEventListener('mirpanel:route-change',()=>{const stamp=window.measureTransition;requestAnimationFrame(()=>{if(stamp===window.measureTransition&&window.measureTargetStamp!==stamp){window.measureTarget=performance.now();window.measureTargetStamp=stamp;}});});
   });
   // Added RTT on both engines, applied only to first-party resources. Not a
   // cellular throughput cap; reported separately from the Chromium CDP probe.
   await c.route('**/*',async r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'&&u.pathname!=='/api/payments/shop/quote')return r.abort();if(weak&&!mobileCap&&u.origin===origin)await new Promise(x=>setTimeout(x,160));return r.continue();});
   const p=await c.newPage();p.setDefaultTimeout(22000);
   if(mobileCap&&weak&&name==='chrome'){
    const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000});
   }
   await p.goto(origin+'/',{waitUntil:'commit'});
   const first=await p.evaluate(async()=>{
    const shown=s=>[...document.querySelectorAll(s)].some(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');
    const out={content:null,clickable:null};let until=performance.now()+20000;
    while(performance.now()<until){
     await new Promise(requestAnimationFrame);
     const splash=document.querySelector('#newSplashScreen:not([hidden])'),blocked=splash&&getComputedStyle(splash).display!=='none'&&getComputedStyle(splash).pointerEvents!=='none';
     if(!blocked&&out.content===null&&shown('#homeQuickLinks a,#grid .card,#heroSlider a'))out.content=Math.round(performance.now());
     if(!blocked&&out.clickable===null&&shown('#grid a[href^="/mehsul/"]'))out.clickable=Math.round(performance.now());
     if(out.content!==null&&out.clickable!==null)break;
    }
    const timing=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource').filter(r=>/app\.js|splash\.js|homepage-banners|stories|fonts\.google|page-navigation|support-widget/.test(r.name)).slice(0,16).map(r=>[new URL(r.name).pathname,Math.round(r.startTime),Math.round(r.responseEnd),r.transferSize]);
    return {...out,ttfb:Math.round(timing?.responseStart||0),fcp:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime||0)||null,resources};
   });
   const paths={};
   for(const [from,sel] of homeOnly?[]:states.slice(0,2)){
    const fromPath=from==='list'?'/mehsul':'/';
    if(from==='list')await p.goto(origin+'/mehsul?search=CapCut',{waitUntil:'commit'});
    await ready(p,sel);
    await p.waitForFunction(()=>!!window.MirpanelNavigation);
    const click=()=>p.locator(sel).first().evaluate(a=>a.click());
    const to=states[2][1];
    paths[from]={click:await turn(p,click,to,detail)};
    paths[from].back=await turn(p,()=>p.evaluate(()=>history.back()),sel,fromPath);
    paths[from].repeat=await turn(p,click,to,detail);
   }
   console.log(JSON.stringify({name,width,weak,run,first,paths}));
  }catch(e){console.log(JSON.stringify({name,width,weak,run,error:e.message.split('\n')[0]}));}finally{await c.close();}
 }}finally{await browser.close();}
}
