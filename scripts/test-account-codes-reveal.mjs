import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const before=process.argv.includes('--before'),live=process.argv.includes('--live');
const origin=live?'https://mirpanel.com':'https://mirpanel.test',pause=ms=>new Promise(r=>setTimeout(r,ms));
const list='/api/payments/my-orders/codes';
const rows=[{id:'delivery-netflix',title:'Netflix Şəxsi'},{id:'delivery-capcut',title:'CapCut Pro'}].map(r=>({...r,plan:'1 ay',purchasedAt:'2026-11-09T12:00:00Z'}));
const secrets=[
 {text:'Netflix üçün sintetik hazır mesaj\n[https://2fa.live/], http://example.test/help.\nŞifrə: https://example.test/private\n2FA açarı: DEMO-ONLY-0000\n<script>window.messageExecuted=true</script>\nİkinci sətir',email:'netflix@example.test',password:'Synthetic-N',netflixRoom:{name:'Otaq A',code:'0408'}},
 {text:'CapCut üçün ayrı sintetik hazır mesaj',email:'capcut@example.test',password:'Synthetic-C'}
];
const files=new Map();
async function file(path){
 const f=path.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+path.slice(18):path.slice(1);
 if(!files.has(f))files.set(f,before&&/account-codes\.(js|css)$/.test(f)?execFileSync('git',['show','0829738:'+f],{encoding:'utf8'}):await fs.readFile(f,'utf8'));
 return files.get(f);
}
const viewports=before?[[chromium,390],[chromium,1440]]:[[chromium,320],[chromium,390],[webkit,390],[chromium,1440],[webkit,1440]];
for(const [engine,width] of viewports){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'clipboard',{value:{write:async items=>{window.copied=await(await items[0].getType('text/plain')).text();},writeText:async text=>{window.copied=text;}}});
  });
  let calls=[0,0],firstDone=false,uid='owner',expired=false;
  await context.route('**/*',async r=>{
   const u=new URL(r.request().url()),p=u.pathname;
   if(u.origin!==origin||r.request().method()!=='GET')return r.abort();
   if(p==='/profil')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body><main id="communityApp" data-profile-entry></main><script type="module" src="/community-assets/profile-entry.js?v=codes-reveal-2"></script>'});
   if(p==='/api/community/state')return r.fulfill({json:{profile:{user_id:uid,display_name:'Sınaq hesabı',email:'demo@example.test',avatar:0,balanceCents:0}}});
   if(p===list)return r.fulfill({json:{accountId:uid,codes:uid==='owner'?rows:[]}});
   const index=rows.findIndex(x=>p===list+'/'+x.id);
   if(index!==-1){
    calls[index]++;await pause(index===0?4000:450);
    await r.fulfill(expired?{status:401,json:{error:'Sessiya bitib'}}:uid!=='owner'?{status:403,json:{error:'İcazə yoxdur'}}:{json:secrets[index]});
    if(index===0)firstDone=true;
    return;
   }
   if(p.startsWith('/api/'))return r.fulfill({status:404,json:{}});
   if(live)return r.continue();
   try{return await r.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:await file(p)});}catch{return r.fulfill({status:404,body:''});}
  });
  await page.goto(origin+'/profil?tab=codes');
  const cards=page.locator('.codes-card'),first=cards.first(),second=cards.nth(1);
  await second.waitFor();
  if(!before){
   for(const card of [first,second]){
    const a=await card.getByRole('button',{name:'Göstər'}).boundingBox(),b=await card.getByRole('button',{name:'Kopyala'}).boundingBox();
    assert.equal(a.y,b.y);assert.equal(a.height,b.height);
    if(width<500)assert.equal(a.width,b.width);
    assert.equal(await card.locator('.codes-image').evaluate(n=>n.offsetWidth),width<500?56:72);
   }
  }
  if(!before){for(let i=0;i<100&&!firstDone;i++)await pause(50);assert.ok(firstDone);}
  // Both variants receive the same viewing time before the first click.
  if(before)await pause(4200);else await pause(200);
  async function reveal(card){
   return card.evaluate(n=>new Promise(resolve=>{
    const button=n.querySelector('.codes-actions button'),details=n.querySelector('.codes-details');
    const start=performance.now(),observer=new MutationObserver(()=>{if(!details.hidden){observer.disconnect();resolve(performance.now()-start);}});
    observer.observe(details,{attributes:true,attributeFilter:['hidden']});button.click();
   }));
  }
  const firstMs=await reveal(first);
  assert.equal(await first.locator('.codes-text').textContent(),secrets[0].text);
  if(!before){
   assert.deepEqual(await first.locator('.delivery-message-link').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['https://2fa.live/','http://example.test/help']);
   assert.equal(await first.locator('.codes-text script').count(),0);assert.equal(await page.evaluate(()=>window.messageExecuted),undefined);
   assert.equal(await first.locator('.delivery-message-link').first().evaluate(n=>getComputedStyle(n).color),'rgb(113, 229, 166)');
  }
  for(const value of ['netflix@example.test','Synthetic-N','Otaq A','0408'])await first.getByText(value,{exact:true}).waitFor();
  await first.getByRole('button',{name:'Gizlət'}).click();
  assert.equal(await first.locator('.codes-text').textContent(),'');
  const repeatMs=await reveal(first);
  if(!before){
   assert.equal(calls[0],1);
   assert.ok(firstMs<100&&repeatMs<100);
   await first.getByRole('button',{name:'Kopyala'}).click();
   await first.getByText('Məlumat kopyalandı',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.copied),secrets[0].text);
   const coldStart=performance.now();
   await second.getByRole('button',{name:'Göstər'}).click();
   await second.getByText('Hesab məlumatı hazırlanır…',{exact:true}).waitFor({timeout:400});
   const feedbackMs=Math.round(performance.now()-coldStart);
   assert.equal(await first.locator('.codes-loading').count(),0);
   await second.getByText('Synthetic-C',{exact:true}).waitFor();
   assert.equal(await second.locator('.codes-text').textContent(),secrets[1].text);
   assert.deepEqual(calls,[1,1]);
   if(live){await fs.mkdir('outputs/codes-reveal',{recursive:true});await page.screenshot({path:'outputs/codes-reveal/'+engine.name()+'-'+width+'.png'});}
   uid='other';await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'other'}})));
   await page.getByText('Hələ kodunuz yoxdur.',{exact:true}).waitFor();
   assert.equal(await page.getByText('Synthetic-N',{exact:true}).count(),0);
   assert.equal(await page.getByText('Synthetic-C',{exact:true}).count(),0);
   uid='owner';await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{user_id:'owner'}})));
   await second.waitFor();expired=true;
   await second.getByRole('button',{name:'Göstər'}).click();
   await first.waitFor({state:'detached'});
   assert.equal(await page.getByText('Synthetic-N',{exact:true}).count(),0);
   assert.equal(await page.getByText('Synthetic-C',{exact:true}).count(),0);
   console.log(JSON.stringify({engine:engine.name(),width,coldFeedbackMs:feedbackMs,expiryCleared:true}));
  }
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(JSON.stringify({before,live,engine:engine.name(),width,firstMs:Math.round(firstMs*10)/10,repeatMs:Math.round(repeatMs*10)/10,detailRequests:calls}));
 }finally{await browser.close();}
}
