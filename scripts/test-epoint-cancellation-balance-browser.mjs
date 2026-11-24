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
  releaseFirstList();
  await page.goto(base+'/profil?tab=orders');
  await page.locator('[data-order-id="order-1"]').waitFor();
  assert.match(await page.locator('.account-sidebar-balance').innerText(),/0[.,]00/);
  await context.unroute('**/*');
  await context.route('**/*',async r=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/community/state')return r.fulfill({json:{profile:{user_id:'a',display_name:'Synthetic',avatar:0,balanceCents:549}}});
   if(path==='/api/payments/my-orders')return r.fulfill({json:{accountId:'a',orders:[{...order(1,'cancelled'),deliveries:[],cancellation:{full:true,refundStatus:'wallet_refunded',refundCents:549,reason:'Synthetic cancellation'}}],nextCursor:null}});
   if(path.startsWith('/api/'))return r.fulfill({json:{products:[]}});
   try{return r.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:await asset(path)});}catch{return r.abort();}
  });
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>/5[.,]49/.test(document.querySelector('.account-sidebar-balance')?.textContent||''));
  assert.ok(await page.getByText('Məbləğ MirPanel balansınıza qaytarılıb',{exact:false}).count());
  console.log('PASS '+engine.name()+' '+width+': committed refund updates customer balance without page reload; synthetic only');
 }finally{await browser.close();}
}
