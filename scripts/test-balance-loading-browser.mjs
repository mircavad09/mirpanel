import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live');
const origin=live?'https://mirpanel.com':'https://mirpanel.test';
const version='balance-loading-1';
const assetFiles=new Map();
for(const name of ['shop.css','shop-ui.js','wallet-topup.js','topup-amount.js','page-navigation.js','customer-footer.js','customer-footer.css']){
 const pathname=['shop.css','shop-ui.js','wallet-topup.js','topup-amount.js'].includes(name)?'/community-assets/'+name:'/'+name;
 assetFiles.set(pathname,await fs.readFile(pathname.startsWith('/community-assets')?'mirpanel-admin/community/public/'+name:name));
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const app='<main id="shopApp" class="shop-page shop-wallet-page"><h1>Balansım</h1><div class="shop-wallet-loading" role="status">Balans məlumatı yüklənir…</div></main>';
const markup=(body,head='')=>'<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+head+'</head><body><header class="site-header">MirPanel</header>'+body+'</body></html>';
const footer='<script src="/customer-footer.js"></script>';
const shopStyle='<link rel="stylesheet" href="/community-assets/shop.css?v='+version+'">';
const shopScript='<script type="module" src="/community-assets/shop-ui.js?v='+version+'"></script>';
for(const [engine,width] of [[chromium,390],[chromium,1440],[webkit,390]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const from of ['direct','cart','profile','failure']){
   if(process.env.MIRPANEL_BALANCE_ENGINE&&engine.name()!==process.env.MIRPANEL_BALANCE_ENGINE)continue;
   const page=await browser.newPage({viewport:{width,height:800}});
   const root='/balans',cartTarget='/balans?returnTo=%2Fodenis%3Fmode%3Dwallet#balansi-artir';
   const initial=from==='cart'?'/odenis?mode=wallet':from==='profile'?'/profil':root;
   let requests=0,releaseWallet;
   const walletGate=new Promise(r=>{releaseWallet=r;});
   const delay=from==='failure'?350:2500;
   const race=from==='direct';
   await page.addInitScript(()=>{
    window.errorFlashes=[];
    new MutationObserver(()=>{
     const text=document.querySelector('#shopApp, .site-route-loading')?.textContent;
     if(text?.includes('Yükləmə alınmadı'))window.errorFlashes.push(text);
    }).observe(document,{childList:true,subtree:true});
   });
   await page.route('**/*',async r=>{
    const {origin:host,pathname:path}=new URL(r.request().url());
    if(host!==origin)return r.abort();
    const html=(body,head)=>r.fulfill({contentType:'text/html; charset=utf-8',body:markup(body,head)});
    const js=body=>r.fulfill({contentType:'text/javascript',body});
    if(path==='/balans'){
     if(from==='cart'||from==='profile')await wait(350);
     const navigation=r.request().headers()['x-mirpanel-navigation'];
     if(live)return r.continue();
     return html(app+(navigation?'':shopScript+footer),shopStyle);
    }
    if(path==='/odenis'||path==='/profil')return html('<main><a href="'+(from==='cart'?cartTarget:root)+'">Balansını artır</a></main>'+footer+'<script src="/page-navigation.js?v='+version+'" defer></script>');
    if(path==='/api/payments/shop/wallet'){
     requests++;
     const turn=requests;
     await Promise.all([wait(delay),walletGate]);
     if(from==='failure'&&turn===1)return r.fulfill({status:503,json:{error:'Sintetik server xətası'}});
     return r.fulfill({json:{cents:500,items:[],topups:[]}}).catch(()=>{});
    }
    if(path==='/api/payments/methods')return r.fulfill({json:{methods:[]}});
    if(path==='/api/payments/storefront')return r.fulfill({json:{}});
    if(path==='/api/community/state')return r.fulfill({json:{profile:{id:'qa',emailVerified:true}}});
    if(path==='/cart-ready.js')return js('export async function ensureCart(){window.MirpanelCart={read:()=>[]}}');
    if(path==='/checkout-sounds.js')return js('export function playCheckoutSound(){}');
    if(path==='/session-state.js'){
     if(race)await wait(3000);
     return js('export async function getCommunityState(){return {ok:true,data:{profile:{id:"qa"}}}}').catch(()=>{});
    }
    if(assetFiles.has(path))return live?r.continue():r.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:assetFiles.get(path)});
    if(live&&path.startsWith('/assets/'))return r.continue();
    return r.fulfill({status:404,body:''});
   });
   await page.goto(origin+initial,{waitUntil:'commit'});
   if(from==='cart'||from==='profile')await page.getByRole('link',{name:'Balansını artır'}).click();
   await page.waitForURL(url=>url.pathname==='/balans');
   if(from!=='failure'){
    await page.getByText('Balans məlumatı yüklənir…',{exact:true}).first().waitFor({timeout:8000}).catch(async e=>{console.error(engine.name(),from,page.url(),await page.locator('body').innerText(),requests);throw e;});
    assert.equal(await page.getByText('Yükləmə alınmadı',{exact:true}).count(),0);
   }
   await page.waitForFunction(()=>document.querySelector('#shopApp'));
   if(from!=='failure')assert.equal(await page.getByRole('button',{name:'Yenidən cəhd et',exact:true}).count(),0);
   const support=page.getByRole('heading',{name:'Sualınız var? Operatora yazın.'});
   await support.waitFor();
   const footerTop=async()=>support.count().then(n=>n?support.evaluate(el=>el.getBoundingClientRect().top+scrollY):null);
   const loadingTop=await footerTop();
   if(race){
    await page.waitForFunction(()=>document.querySelector('.shop-wallet-page'));
    await page.waitForFunction(()=>document.querySelector('#shopApp[aria-busy=true]'));
    for(let i=0;!requests&&i<120;i++)await wait(25);
    assert.ok(requests,'wallet request started');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:{id:'qa'}})));
   }
   releaseWallet();
   if(from==='failure'){
    await page.getByRole('heading',{name:'Yükləmə alınmadı'}).waitFor();
    await page.getByText('Sintetik server xətası').waitFor();
    const errorTop=await footerTop();if(loadingTop!==null)assert.ok(Math.abs(errorTop-loadingTop)<=3);
    await page.getByRole('button',{name:'Yenidən cəhd et'}).click();
    await page.getByText('Balans məlumatı yüklənir…',{exact:true}).first().waitFor();
   }
   await page.getByRole('heading',{name:'Məbləği seçin',exact:true}).waitFor();
   await page.getByRole('button',{name:'Kartdan karta',exact:true}).waitFor();
   if(from!=='failure')assert.deepEqual(await page.evaluate(()=>errorFlashes),[]);
   const readyTop=await footerTop();
   if(loadingTop!==null){
    assert.ok(loadingTop>=800,'support starts below the viewport: '+loadingTop);
    assert.ok(readyTop>=loadingTop-3,'support stays below wallet during loading');
    await support.scrollIntoViewIfNeeded();
    assert.ok(await support.isVisible());
   }
   console.log(engine.name(),width,from,'PASS');
   await page.close();
  }
 }finally{await browser.close();}
}
