import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const live=process.argv.includes('--live-assets'),out='outputs/multi-product-orders';await fs.mkdir(out,{recursive:true});
const files=new Map(),results=[];
const artwork=new Map();if(live){const r=await fetch('https://mirpanel.com/api/payments/storefront');assert(r.ok);for(const p of (await r.json()).products||[])if(['netflix','prime'].includes(p.id)&&p.image)artwork.set(p.id,new URL(p.image,'https://mirpanel.com').pathname);}
async function asset(p){const f=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);if(!files.has(f)){
 let body=await fs.readFile(f);if(live&&['browser-orders.js','browser-orders.css','mirpanel-admin/community/public/account-panel.js','mirpanel-admin/community/public/profile-entry.js'].includes(f)){
  const r=await fetch('https://mirpanel.com'+p+'?v=multi-product-1');assert(r.ok);const actual=await r.text();assert.equal(actual.replaceAll('\r\n','\n'),body.toString().replaceAll('\r\n','\n'));body=Buffer.from(actual);
 }files.set(f,body);}return files.get(f);}
for(const engine of [chromium,webkit])for(const width of [320,390,430,1440]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
 const context=await browser.newContext({viewport:{width,height:900},...(width===390&&engine===chromium?{recordVideo:{dir:out,size:{width,height:900}}}:{})});const p=await context.newPage(),errors=[],guides=[];p.on('pageerror',e=>errors.push(e.message));
 const items=[{productId:'netflix',title:'Netflix Şəxsi',image:artwork.get('netflix')||'/netflix.svg'},{productId:'prime',title:'Amazon Prime Video',image:artwork.get('prime')||'/prime.svg'}].map(x=>({...x,planName:'1 ay',quantity:1,unitCents:799,repeat:{productId:x.productId,planIndex:0,planName:'1 ay'}}));
 let many=false,done=false,single=false;
 await context.route('https://multi.test/**',async r=>{const u=new URL(r.request().url()),s=u.pathname;
  if(s==='/profil')return r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#080a0c;color:white"><main id="communityApp" data-profile-entry></main><script type="module" src="/community-assets/profile-entry.js?v=test"></script>'});
  if(s==='/api/community/state')return r.fulfill({json:{profile:{user_id:'synthetic-a',display_name:'Sintetik müştəri',email:'synthetic@example.test',balanceCents:0,avatar:0}}});
  if(s==='/api/payments/my-orders'){
   const list=single?items.slice(0,1):many?[...items,...[2,3,4].map(n=>({...items[1],title:'Sintetik uzun məhsul adı '+n,productId:'test'+n}))]:items;
   const cursor=u.searchParams.has('cursor');
   return r.fulfill({json:{accountId:'synthetic-a',orders:[{id:cursor?'historical-order':'synthetic-order',orderCode:cursor?'SINAQ-OLD':'SINAQ-12868',product:list.map(x=>x.title).join(' + '),status:done&&!many?'completed':'preparing',fulfillmentStatus:done&&!many?'completed':'partial',amount:15.98,currency:'AZN',createdAt:'2026-11-15T18:33:00Z',items:list,deliveries:[{id:'netflix-delivery',line:0,quantity:1},...(done?[{id:'prime-delivery',line:1,quantity:1}]:[])]}],deliveryDetails:{'netflix-delivery':{text:'Netflix üçün sintetik hazır mesaj',email:'netflix@example.test',password:'synthetic-netflix',netflixRoom:{name:'1',code:'0408'}},...(done?{'prime-delivery':{text:'Prime üçün sintetik hazır mesaj',email:'prime@example.test',password:'synthetic-prime'}}:{})},nextCursor:cursor?null:'next'}});
  }
  if(/\/guide\/\d+$/.test(s)){guides.push(s.split('/').at(-1));return r.fulfill({json:{info:'Sintetik məhsul təlimatı',tracks:{phone:[{title:'Sintetik addım',description:'Nümunə təlimat',animation:'prime-email'}]}}});}
  if(s.includes('/my-orders/codes/'))return r.fulfill({json:{text:'Sintetik hazır mesaj',email:'netflix@example.test',password:'synthetic-netflix',netflixRoom:{name:'1',code:'0408'}}});
  if(s.endsWith('.svg'))return r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${s.includes('netflix')?'#b51b27':'#126dc8'}"/><text x="12" y="55" fill="white" font-size="20">${s.includes('netflix')?'Netflix':'Prime'}</text></svg>`});
  if([...artwork.values()].includes(s)){const response=await fetch('https://mirpanel.com'+s);return r.fulfill({contentType:response.headers.get('content-type')||'image/png',body:Buffer.from(await response.arrayBuffer())});}
  if(s.startsWith('/api/'))return r.fulfill({json:{accountId:'synthetic-a',items:[],codes:[],subscriptions:[]}});
  try{return r.fulfill({contentType:s.endsWith('.css')?'text/css':'text/javascript',body:await asset(s)});}catch{return r.fulfill({status:404,body:''});}
 });
 await p.goto('https://multi.test/profil?tab=sifarislerim');const order=p.locator('[data-order-id=synthetic-order]');await order.waitFor();
 await order.locator('[data-status=partial]').getByText('Qismən təhvil verildi').waitFor();
 const header=order.locator('summary'),front=()=>order.locator('.browser-order-image-choice.is-front'),back=()=>order.locator('.browser-order-image-choice.is-back');
 assert.equal(await order.evaluate(n=>n.open),false);assert.equal(await front().getAttribute('aria-label'),'Netflix Şəxsi seç');
 const rects=await p.evaluate(()=>{const a=document.querySelector('.is-front').getBoundingClientRect(),b=document.querySelector('.is-back').getBoundingClientRect();return {ax:a.x,ay:a.y,bx:b.x,by:b.y};});assert(rects.bx>rects.ax&&rects.by<rects.ay);
 await back().click({position:{x:39,y:7}});assert.equal(await front().getAttribute('aria-label'),'Amazon Prime Video seç');assert.equal(await order.evaluate(n=>n.open),false);
 await front().focus();await p.keyboard.press('ArrowLeft');assert.equal(await front().getAttribute('aria-label'),'Netflix Şəxsi seç');assert.equal(await order.evaluate(n=>n.open),false);
 await header.locator('.browser-order-heading').click();assert.equal(await order.evaluate(n=>n.open),true);
 const netflix=order.locator('[data-order-line="0"]'),prime=order.locator('[data-order-line="1"]');
 await netflix.getByText('Təhvil verildi · 1/1',{exact:true}).waitFor();await prime.locator('[data-line-status=preparing]').waitFor();
 await netflix.getByText('synthetic-netflix',{exact:true}).waitFor();await netflix.getByText('0408',{exact:true}).waitFor();assert.equal(await prime.locator('[data-delivery]').count(),0);
 for(const line of [netflix,prime]){await line.getByRole('button',{name:'Təlimat',exact:true}).click();await p.locator('.browser-guide-text').filter({hasText:'Nümunə təlimat'}).waitFor();await p.getByRole('button',{name:'Təlimatı bağla'}).click();}assert.deepEqual(guides,['0','1']);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:out+'/'+(live?'live':'local')+'-'+engine.name()+'-'+width+'.png',fullPage:true});
 // Selection is independent of expand/collapse, and a full refresh is truthful.
 await back().focus();await p.keyboard.press('Enter');assert.equal(await order.evaluate(n=>n.open),true);await header.locator('.browser-order-heading').click();assert.equal(await order.evaluate(n=>n.open),false);
 done=true;await p.reload();await order.locator('[data-status=completed]').waitFor();if(!await order.evaluate(n=>n.open))await header.locator('.browser-order-heading').click();await order.getByText('synthetic-prime',{exact:true}).waitFor();
 many=true;done=false;await p.reload();await order.locator('.browser-order-image-more').waitFor();assert.equal(await order.locator('.browser-order-image-choice').count(),2);await front().focus();await p.keyboard.press('End');assert.match(await front().getAttribute('aria-label'),/məhsul adı 4/);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await header.locator('.browser-order-heading').click();await p.getByRole('button',{name:'Daha çox göstər',exact:true}).click();await p.locator('[data-order-id=historical-order]').waitFor();
 done=true;await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await order.getByText('synthetic-prime',{exact:true}).waitFor();assert.equal(await p.locator('[data-order-id=historical-order]').count(),1);await order.locator('[data-status=partial]').waitFor();
 single=true;many=false;await p.reload();await order.waitFor();assert.equal(await order.locator('.browser-order-image-stack').count(),0);assert.equal(await header.locator('.browser-order-image').count(),1);
 assert.deepEqual(errors,[]);results.push({engine:engine.name(),width,partial:true,images:true,touchAndKeyboard:true,perLineGuide:true,completion:true,manyProducts:true,singleImage:true,retainedHistoryProgress:true});console.log(JSON.stringify(results.at(-1)));await context.close();
 }finally{await browser.close();}
}
await fs.writeFile(out+'/'+(live?'live':'local')+'-browser.json',JSON.stringify({results,productionWrites:0},null,2));
