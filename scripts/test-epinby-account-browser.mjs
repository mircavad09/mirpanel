import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const version='player-gold-seal-2';
const output=new URL('../outputs/player-gold-seal/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const longName='Nümunə oyunçu — BakıQızılKomandasınınÇoxUzunOyunçuAdı123456';
const assets=new Map();
for(const name of ['cart-entry.js','cart-entry.css','checkout-fields.js','entry-styles.js','request-lifecycle.mjs']){
 const source=await fs.readFile(name==='request-lifecycle.mjs'?name:'mirpanel-admin/community/public/'+name,'utf8');
 if(process.argv.includes('--live-assets')){
  const response=await fetch('https://mirpanel.com/'+(name==='request-lifecycle.mjs'?'':'community-assets/')+name+'?v='+version);
  assert.ok(response.ok);
  const deployed=await response.text();
  assert.equal(deployed.replaceAll('\r\n','\n'),source.replaceAll('\r\n','\n'));
  assets.set(name,deployed);
 }else assets.set(name,source);
}
const field=(key,label,extra={})=>({key,label,type:'text',required:true,maxLength:40,minLength:0,digits:0,...extra});
const products=[
 {id:'pubg_mobile',title:'PUBG Mobile',plans:[{label:'60 UC',cents:349,fields:[field('player_id','Player ID',{placeholder:'PUBG Mobile ID nömrənizi daxil edin'})]}]},
 {id:'free_fire',title:'Free Fire',plans:[{label:'100 Diamonds',cents:250,fields:[field('player_id','Player ID'),field('server_id','Server')]}]},
 {id:'telegram_premium',title:'Telegram Premium',plans:[{label:'100 Stars',cents:249,fields:[field('telegram_username','Telegram istifadəçi adı')]}]}
];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const width of [320,390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:850}}),page=await ctx.newPage();
   if(process.argv.includes('--without-any'))await ctx.addInitScript(()=>{Object.defineProperty(AbortSignal,'any',{configurable:true,value:undefined});Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined});});
   let releaseSlow,startSlow,draft,navigated;
   const started=new Promise(r=>startSlow=r);
   const delayed=new Promise(r=>releaseSlow=r);
   let lookedUp=0,failed=false;
   await ctx.route('https://checkout.test/**',async route=>{
    const {pathname}=new URL(route.request().url()),name=pathname.split('/').at(-1);
    if(assets.has(name))return route.fulfill({contentType:name.endsWith('.css')?'text/css':'text/javascript',body:assets.get(name)});
    if(pathname==='/cart-ready.js')return route.fulfill({contentType:'text/javascript',body:'export async function ensureCart(){return {commitDraft:(saved,line)=>{window.savedLine=line},open(){}}}'});
    if(name==='quote'){
     const item=route.request().postDataJSON().items[0],p=products.find(x=>x.id===item.productId),plan=p.plans[item.planIndex];
     return route.fulfill({json:{balanceCents:1000,items:[{...item,terms:'Sintetik şərtlər',termsVersion:'test-'+p.id,planName:plan.label,fields:plan.fields,unitCents:plan.cents,accountCheck:true}]}});
    }
    if(name==='epinby-account'){
     const {productId,planIndex,termsVersion,values}=route.request().postDataJSON();lookedUp++;
     assert.equal(planIndex,0);assert.equal(termsVersion,'test-'+productId);
     const value=values.player_id||values.telegram_username;
     if(value==='000001'){startSlow();await delayed;return route.fulfill({json:{state:'verified',name:'Gecikmiş hesab',allowCheckout:true}}).catch(()=>{});}
     if(value==='000003'||value==='@wrong_account')return route.fulfill({json:{state:'invalid',message:'Hesab tapılmadı.',allowCheckout:false}});
     if(value==='000004')return route.fulfill({json:{state:'unavailable',message:'Hesab adı yoxlanmır.',allowCheckout:true}});
     if(value==='000005'&&!failed){failed=true;return route.abort('failed');}
     const p=products.find(p=>p.id===productId);
     assert.deepEqual(Object.keys(values).sort(),p.plans[0].fields.map(f=>f.key).sort());
     return route.fulfill({json:{state:'verified',name:productId==='free_fire'?longName:'Nümunə hesab',allowCheckout:true}});
    }
    if(name==='draft'){
     draft=route.request().postDataJSON();
     return route.fulfill({json:{draftId:draft.id,termsVersion:draft.termsVersion}});
    }
    if(pathname==='/odenis'){navigated=true;return route.fulfill({contentType:'text/html',body:'<h1>Sınaq ödəniş səhifəsi</h1>'});}
    return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{background:#101114;color:#eee}</style><button>İndi al</button><script type="module">
     import {startCartEntry} from '/community-assets/cart-entry.js';
     const products=${JSON.stringify(products)}, p=products.find(x=>x.id===new URLSearchParams(location.search).get('product'));
     document.querySelector('button').onclick=()=>startCartEntry(p,p.plans[0],{loginOnGuest:true});
    </script>`});
   });
   const dialog=page.locator('dialog[open]');
   const open=async p=>{
    await page.goto('https://checkout.test/?product='+p.id);
    await page.getByRole('button',{name:'İndi al'}).click();
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button',{name:'Təsdiqləyirəm'}).click();
    assert.equal(await dialog.getByRole('button',{name:/Ödənişə keç/}).textContent(),'Ödənişə keç · '+(p.plans[0].cents/100).toFixed(2).replace('.',',')+' ₼');
   };
   const seal=dialog.locator('.player-result-card'),verified=seal.getByText('Oyunçu tapıldı',{exact:true}),invalid=dialog.getByText('Hesab tapılmadı.',{exact:true});
   const screenshot=async product=>{
    assert(await seal.evaluate((card,product)=>{
     const name=card.querySelector('.player-result-name');
     const idField=card.closest('form').querySelector('.cart-entry-check-input input');
     const a=card.getBoundingClientRect(),b=idField.getBoundingClientRect();
     return a.right<=innerWidth&&name.scrollWidth<=name.clientWidth&&getComputedStyle(card).backgroundImage.includes('gradient')
      &&Math.abs(a.left-b.left)<1&&Math.abs(a.right-b.right)<1&&a.top>=b.bottom&&a.top-b.bottom<=12
      &&(product!=='pubg-mobile'||a.height>b.height&&a.height-b.height<=20);
    },product));
    await dialog.screenshot({path:fileURLToPath(new URL([process.argv.includes('--live-assets')?'live':'local',engine.name(),width,product].join('-')+'.png',output))});
   };
   const next=dialog.getByRole('button',{name:/Ödənişə keç/});
   await open(products[0]);
   const player=dialog.getByLabel('Player ID',{exact:true});
   assert.equal(await player.getAttribute('placeholder'),'PUBG Mobile ID nömrənizi daxil edin');
   assert.equal(await dialog.getByText('ID haradan tapılır?').count(),0);
   await player.fill('000001');await started;
   await dialog.getByText('Hesab yoxlanılır…').waitFor();
   assert.equal(await seal.count(),0);
   assert.equal(await next.isDisabled(),true);
   await player.fill('000002');await verified.waitFor();
   releaseSlow();await dialog.getByText('Nümunə hesab',{exact:true}).waitFor();
   assert.equal(await dialog.getByText('Gecikmiş hesab').count(),0);
   assert.equal(await seal.locator('.player-result-id').textContent(),'Oyunçu ID-si: 000002');
   assert.equal(await seal.locator('.player-result-content').evaluate(n=>n.childElementCount),3);
   await screenshot('pubg-mobile');
   await player.fill('000003');assert.equal(await seal.count(),0);
   await invalid.waitFor();assert.equal(await next.isDisabled(),true);assert.equal(await seal.count(),0);
   await player.fill('abc');await dialog.getByText('Player ID yalnız rəqəmlərdən ibarət olmalıdır.').waitFor();
   await open(products[1]);
   const before=lookedUp;await player.fill('000004');assert.equal(lookedUp,before);
   await dialog.getByLabel('Server',{exact:true}).fill('0001');
   await dialog.getByText('Hesab adı yoxlanmır.').waitFor();assert.equal(await verified.count(),0);assert.equal(await next.isEnabled(),true);
   await player.fill('000005');await dialog.getByRole('button',{name:'Yenidən cəhd et'}).click();await verified.waitFor();
   assert.equal(await seal.locator('.player-result-name').textContent(),longName);
   assert.equal(await seal.locator('.player-result-id').textContent(),'Oyunçu ID-si: 000005');
   await screenshot('free-fire');
   await player.fill('');assert.equal(await seal.count(),0);
   await open(products[2]);
   const username=dialog.getByLabel('Telegram istifadəçi adı',{exact:true});
   assert.equal(await player.count(),0);
   await username.fill('@wrong_account');await invalid.waitFor();assert.equal(await next.isDisabled(),true);
   await username.fill('@synthetic_player');await dialog.getByText('Hesab təsdiqləndi',{exact:true}).waitFor();
   assert.equal(await seal.count(),0);
   await dialog.getByText('@synthetic_player',{exact:true}).waitFor();
   assert(await dialog.evaluate(d=>d.getBoundingClientRect().right<=innerWidth&&d.scrollWidth<=d.clientWidth));
   await next.click();await page.waitForURL('**/odenis');
   assert(navigated);assert.deepEqual(draft.values,{telegram_username:'@synthetic_player'});
   assert.equal(draft.productId,'telegram_premium');assert.equal(draft.planIndex,0);
   await ctx.close();
   console.log(engine.name(),width,'PASS PUBG, Free Fire, Telegram Stars, stale response, retry, selected price and checkout');
  }
 }finally{await browser.close();}
}
