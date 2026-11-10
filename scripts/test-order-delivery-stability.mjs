import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const before=process.argv.includes('--before'),live=process.argv.includes('--live'),base=live?'https://mirpanel.com':'https://mirpanel.test';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const saved={text:'CapCut hesabına giriş təlimatı\n1. Tətbiqi açın.\n2. Hesabınıza daxil olun.',email:'hesab@example.test',password:'Synthetic-0408'};
const order=(n,status='completed')=>({id:'order-'+n,orderCode:'123'+n,product:'Sınaq məhsulu '+n,plan:'1 ay',quantity:1,amount:5,currency:'AZN',createdAt:'2026-11-10T12:00:00Z',status,deliveries:status==='completed'?[{id:'delivery-'+n,line:0,quantity:1}]:[]});
const files=new Map();
const changed=['browser-orders.js','browser-orders.css','mirpanel-admin/community/public/profile-entry.js','mirpanel-admin/community/public/account-panel.js'];
async function asset(path){
 const file=path.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+path.slice(18):path.slice(1);
 if(!files.has(file))files.set(file,before&&changed.includes(file)?execFileSync('git',['show','90ef519:'+file],{encoding:'utf8'}):await fs.readFile(file,'utf8'));
 return files.get(file);
}
for(const [engine,width] of (before?[[chromium,390],[chromium,1440]]:[[chromium,390],[chromium,1440],[webkit,390]])){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  let releaseFirstList;const firstListGate=new Promise(resolve=>{releaseFirstList=resolve;});
  let requests=0,listRequests=0,failDelivery=false,failList=false,includeDetails=!before,revision=0,uid='a',responseDelay=250;
  await context.route('**/*',async r=>{
   const u=new URL(r.request().url()),path=u.pathname;
   if(u.origin!==base)return r.abort();
   if(path==='/profil')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body><main id="communityApp" data-profile-entry></main><script type="module" src="/community-assets/profile-entry.js?v=delivery-stable-2"></script>'});
   if(path==='/api/community/state'){await pause(200);return r.fulfill({json:{profile:{user_id:uid,display_name:'Sınaq '+uid,email:'test@example.test',avatar:0,balanceCents:0}}});}
   if(path==='/api/payments/my-orders'){
    listRequests++;const account=uid;
    if(u.searchParams.has('cursor'))return r.fulfill({json:{accountId:account,orders:[order(4)],nextCursor:null}});
    if(listRequests===1&&!before)await firstListGate;
    await pause(responseDelay);
    return r.fulfill(failList?{status:503,json:{error:'Sınaq bağlantı xətası'}}:{json:{accountId:account,orders:account==='a'?[order(1),order(2),order(3,revision?'preparing':'reviewing')]:[],deliveryDetails:includeDetails&&account==='a'?{'delivery-1':saved}:{},nextCursor:'next'}});
   }
   if(path.startsWith('/api/payments/my-orders/codes/')){
    requests++;await pause(400);return r.fulfill(failDelivery?{status:503,json:{error:'Sınaq xətası'}}:{json:saved});
   }
   if(path.startsWith('/api/'))return r.fulfill({json:{products:[],wishlist:[],expensesCents:0,completedOrders:0,accountId:uid}});
   if(path==='/checkout-sounds.js')return r.fulfill({contentType:'text/javascript',body:'export function playCheckoutSound(){}'});
   if(live)return r.continue();
   try{return r.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:await asset(path)});}catch{return r.fulfill({status:404,body:''});}
  });
  const start=performance.now();
  await page.goto(base+'/profil?tab=orders',{waitUntil:'commit'});
  if(!before){
   await page.locator('.browser-orders-placeholder').waitFor();
   assert.equal(await page.locator('.account-tab-content .account-tab-spinner').count(),0);
   releaseFirstList();
  }
  const credentials=page.locator('[data-delivery="delivery-1"] .browser-delivery-credentials');
  await credentials.getByText(saved.password,{exact:true}).waitFor();
  const firstMs=Math.round(performance.now()-start);
  if(before){console.log(JSON.stringify({before,width,firstMs,deliveryRequests:requests}));continue;}
  assert.equal(requests,0,'first card arrives with the list');
  assert.ok(!await page.getByText('Təhvil məlumatı yüklənir…',{exact:true}).count());
  await page.evaluate(()=>{window.readyCredential=document.querySelector('[data-delivery="delivery-1"] .browser-delivery-credentials strong');scrollTo(0,100);});
  const scroll=await page.evaluate(()=>scrollY);
  const visibility=hidden=>page.evaluate(value=>{
   Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));
  },hidden);
  await visibility(true);
  assert.ok(await credentials.getByText(saved.password,{exact:true}).isVisible());
  await visibility(false);await pause(600);
  assert.ok(await page.evaluate(()=>window.readyCredential===document.querySelector('[data-delivery="delivery-1"] .browser-delivery-credentials strong')));
  assert.equal(await page.evaluate(()=>scrollY),scroll);
  await page.evaluate(()=>{
   window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
  });
  await pause(600);
  assert.ok(await page.evaluate(()=>window.readyCredential===document.querySelector('[data-delivery="delivery-1"] .browser-delivery-credentials strong')),'browser restored document keeps its ready card');
  revision++;await visibility(true);await visibility(false);await pause(600);
  assert.ok(await page.evaluate(()=>window.readyCredential===document.querySelector('[data-delivery="delivery-1"] .browser-delivery-credentials strong')),'another order update keeps this credential node');
  const navigate=tab=>page.evaluate(async tab=>{history.replaceState({},'','/profil?tab='+tab);await window.mirpanelAccountNavigate(location.href);},tab);
  await navigate('expenses');await navigate('orders');
  await credentials.getByText(saved.password,{exact:true}).waitFor();
  assert.equal(requests,0,'internal return uses memory only');
  failList=true;await visibility(true);await visibility(false);await pause(600);
  assert.ok(await credentials.getByText(saved.password,{exact:true}).isVisible());
  failList=false;
  await page.locator('[data-order-id="order-2"] summary').click();
  const second=page.locator('[data-delivery="delivery-2"]'),skeleton=second.locator('.browser-delivery-skeleton');
  await skeleton.waitFor();const height=(await second.boundingBox()).height;
  await second.getByText(saved.password,{exact:true}).waitFor();
  assert.ok(Math.abs((await second.boundingBox()).height-height)<=2,'fallback skeleton keeps card height');
  await page.getByRole('button',{name:'Daha çox göstər',exact:true}).click();
  await page.locator('[data-order-id="order-4"] summary').click();
  await page.locator('[data-delivery="delivery-4"]').getByText(saved.password,{exact:true}).waitFor();
  await navigate('expenses');await navigate('orders');
  await page.locator('[data-delivery="delivery-4"]').getByText(saved.password,{exact:true}).waitFor();
  assert.equal(requests,2,'additional page stays open on internal return');
  const stored=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
  assert.ok(!stored.includes(saved.password)&&!stored.includes(saved.email));
  await page.reload();await credentials.getByText(saved.password,{exact:true}).waitFor();
  assert.equal(requests,2,'reload uses embedded first delivery');
  includeDetails=false;failDelivery=true;
  await page.reload();await page.locator('[data-delivery="delivery-1"] [data-retry-delivery]').waitFor();
  failDelivery=false;await page.locator('[data-delivery="delivery-1"] [data-retry-delivery]').click();
  await credentials.getByText(saved.password,{exact:true}).waitFor();
  // A late response from account A cannot restore its card after switching to B.
  responseDelay=900;await visibility(true);await visibility(false);await pause(60);uid='b';
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'b'}})));
  await pause(1500);
  assert.ok(!(await page.locator('#communityApp').innerText()).includes(saved.password));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log(JSON.stringify({engine:engine.name(),width,firstMs,deliveryRequests:requests,listRequests,liveAssets:live,tabReturn:true,keyedUpdate:true,internalReturn:true,reload:true,skeleton:true,retry:true,accountIsolation:true}));
  await context.close();
 }finally{await browser.close();}
}
