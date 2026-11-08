// Live read-only synthetic browser timing. Stops at the order warning; never
// accepts terms, writes a draft, adds to cart, or opens checkout.
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const origin=process.env.MIRPANEL_MEASURE_ORIGIN||'https://mirpanel.com';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const width=Number(process.env.MIRPANEL_MEASURE_WIDTH||390),weak=process.env.MIRPANEL_MEASURE_WEAK==='1';
const runs=Number(process.env.MIRPANEL_MEASURE_RUNS||2);
const selectors={
 capcut:['#pp-main-title','#pp-order-btn:not([disabled])'],
 products:['.catalog-grid .card','.catalog-grid .card a[href*="/mehsul/"],.catalog-grid a.catalog-card'],
 home:['#grid .card','#grid a.card[href*="/mehsul/"],#grid .card a[href*="/mehsul/"]'],
 login:['#account-email','.auth-submit:not([disabled])'],
 cart:['#shopApp h1','#shopApp .shop-empty,#shopApp .shop-checkout-grid'],
 drawer:['dialog.mir-cart-drawer[open]','dialog.mir-cart-drawer[open] button'],
 balance:['#shopApp h1','#shopApp .shop-card'],
 group:['#communityApp h1','#communityApp .community-messages'],
 profile:['.account-panel,.auth-panel','#account-email,.profile-hero']
};
const rounds=[];
async function warning(p){
 return p.evaluate(async ()=>{
  const start=performance.now(),out={heading:null,terms:null};
  document.querySelector('#pp-order-btn')?.click();
  while(performance.now()-start<15000){
   await new Promise(requestAnimationFrame);
   const now=Math.round(performance.now()-start),dialog=document.querySelector('dialog.cart-entry[open]');
   if(out.heading===null&&dialog?.querySelector('h2'))out.heading=now;
   if(dialog?.querySelector('.cart-entry-terms')){out.terms=now;break;}
  }
  document.querySelector('dialog.cart-entry[open]')?.close();return out;
 });
}
async function sample(p,key,act,{cold=false,limit=22000}={}){
 const [main,ready]=selectors[key],hostStart=performance.now();
 if(!cold)await p.evaluate(()=>{window.mirMeasureStart=performance.now();window.mirMeasureRoute=location.href;});
 await act();
 const v=await p.evaluate(async ({key,main,ready,limit,cold})=>{
  const started=cold?0:window.mirMeasureStart??0,old=window.mirMeasureRoute;
  const seen=s=>[...document.querySelectorAll(s)].some(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');
  const paint=()=>new Promise(r=>requestAnimationFrame(()=>r(Math.round(performance.now()-started))));
  const out={reaction:null,main:null,ready:null,...(key==='capcut'?{image:null}:{})};
  while(performance.now()-started<limit){
   const now=await paint(),m=seen(main),splash=document.querySelector('#newSplashScreen'),blocked=splash&&!splash.hidden&&getComputedStyle(splash).display!=='none';
   if(out.reaction===null&&!blocked&&(m||seen('.site-route-placeholder,.site-route-loading')||!cold&&location.href!==old))out.reaction=now;
   if(out.main===null&&!blocked&&m)out.main=now;
   if(out.ready===null&&!blocked&&seen(ready))out.ready=now;
   if(key==='capcut'&&out.image===null&&document.querySelector('#pp-main-img')?.complete&&document.querySelector('#pp-main-img')?.naturalWidth)out.image=now;
   if(out.reaction!==null&&out.main!==null&&out.ready!==null&&(key!=='capcut'||out.image!==null))break;
  }
  const entries=performance.getEntriesByType('resource').filter(x=>x.startTime>=started);
  const timing=x=>[new URL(x.name).pathname,Math.round(x.startTime-started),Math.round(x.duration),Math.round(Math.max(0,x.responseStart-x.startTime)),x.transferSize];
  return {...out,ttfb:cold?Math.round(performance.getEntriesByType('navigation')[0]?.responseStart||0):null,critical:entries.filter(x=>/\/(?:api\/|mehsul$|.*capcut.*\.(?:png|webp)|product-page\.js|catalog-listing\.js)/i.test(new URL(x.name).pathname)).map(timing).slice(0,12),slow:entries.sort((a,b)=>b.duration-a.duration).slice(0,5).map(timing)};
 },{key,main,ready,cold,limit});
 return {...v,elapsed:Math.round(performance.now()-hostStart)};
}
async function menu(p,path){await p.evaluate(path=>{
 const a=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===path&&a.getClientRects().length);
 if(a)a.click();else void window.MirpanelNavigation.go(path);
},path);}
async function context(){
 const c=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
 const p=await c.newPage();
 if(weak){const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000});}
 return [c,p];
}
try{
 for(let run=0;run<runs;run++){
  const [a,p]=await context(),capcut=await sample(p,'capcut',()=>p.goto(origin+'/mehsul/capcut-pro',{waitUntil:'commit'}),{cold:true});
  if(process.env.MIRPANEL_MEASURE_ORDER==='1'){
   capcut.warning=await warning(p);
  }
  if(process.env.MIRPANEL_MEASURE_EXTRA==='1'&&await p.evaluate(()=>Boolean(window.MirpanelNavigation))){
   await p.waitForFunction(()=>!document.body.classList.contains('orderConfirmationActive'),null,{timeout:5000}).catch(()=>{});
   capcut.returnHome=await sample(p,'home',()=>menu(p,'/'));
  }
  if(process.env.MIRPANEL_MEASURE_ORDER==='1'){
   for(const slug of ['netflix-sexsi','hbo-max']){
    await p.goto(origin+'/mehsul/'+slug,{waitUntil:'domcontentloaded'});
    const enabled=await p.locator('#pp-order-btn:not([disabled])').waitFor({timeout:15000}).then(()=>true,()=>false);
    capcut[slug]=enabled?await warning(p):await p.evaluate(()=>({heading:null,terms:null,button:document.querySelector('#pp-order-btn')?.textContent,inventory:document.querySelector('#inventoryServiceStatus')?.textContent}));
   }
  }
  console.log(JSON.stringify({partial:true,width,weak,run:run+1,capcut}));
  await a.close();
  const [c,q]=await context();
  const home=await sample(q,'home',()=>q.goto(origin+'/',{waitUntil:'commit'}),{cold:true});
  const router=await q.waitForFunction(()=>!!window.MirpanelNavigation,null,{timeout:14000}).then(()=>true,()=>false);
  if(!router){console.log(JSON.stringify({width,weak,run:run+1,capcut,home,routerTimeout:true}));await c.close();continue;}
  const products=await sample(q,'products',()=>menu(q,'/mehsul'));
  const back=await sample(q,'home',()=>q.evaluate(()=>history.back()));
  const forward=await sample(q,'products',()=>q.evaluate(()=>history.forward()));
  const again=await sample(q,'home',()=>menu(q,'/'));
  const repeat=await sample(q,'products',()=>menu(q,'/mehsul'));
  const other={};
  if(process.env.MIRPANEL_MEASURE_EXTRA==='1'){
   const cartLink=await q.evaluate(()=>[...document.querySelectorAll('#cartHeaderLink,[data-browser-nav=cart]')].some(a=>a.getClientRects().length));
   if(cartLink){
    other.drawer=await sample(q,'drawer',()=>q.evaluate(()=>[...document.querySelectorAll('#cartHeaderLink,[data-browser-nav=cart]')].find(a=>a.getClientRects().length)?.click()),{limit:4000});
    await q.evaluate(()=>document.querySelector('dialog.mir-cart-drawer[open]')?.close());
   }
  }
  if(process.env.MIRPANEL_MEASURE_EXTRA==='1')for(const [key,path] of [['login','/hesab'],['profile','/profil'],['cart','/sebet'],['balance','/balans'],['group','/qrup']]){
   other[key]=await sample(q,key,()=>key==='cart'?q.evaluate(()=>{void window.MirpanelNavigation.go('/sebet');}):menu(q,path),{limit:9000}).catch(e=>({error:e.message.split('\n')[0]}));
  }
  const result={width,weak,run:run+1,capcut,home,products,back,forward,again,repeat,other};rounds.push(result);
  console.log(JSON.stringify(result));
  await c.close();
 }
}finally{await browser.close();}
