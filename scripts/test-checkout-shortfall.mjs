import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live');
const origin=live?'https://mirpanel.com':'https://mirpanel.test';
const assets=['shop.css','shop-ui.js','wallet-topup.js','topup-amount.js','cart-ready.js','cart-store.js','checkout-sounds.js','session-state.js'];
const files=new Map(await Promise.all(assets.map(async name=>[name,await readFile(new URL('../'+(assets.indexOf(name)<4?'mirpanel-admin/community/public/':'')+name,import.meta.url))])));
const item={productId:'qa-capcut',planIndex:0,quantity:1,termsVersion:'qa'};
for(const [engine,width] of [[chromium,320],[chromium,1440],[webkit,390]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const cents of [0,125,499]){
   const page=await browser.newPage({viewport:{width,height:800}});
   let writes=0,quotes=0;
   await page.addInitScript(line=>{if(!localStorage.getItem('qa-init')){localStorage.setItem('qa-init','1');localStorage.setItem('mirpanel.cart.v1',JSON.stringify([line]));}},item);
   await page.route('**/*',async r=>{
    const {origin:host,pathname:path}=new URL(r.request().url());
    if(host!==origin)return r.abort();
    if(path==='/api/payments/shop/quote'){
     quotes++;
     assert.deepEqual(r.request().postDataJSON().items,[item]);
     return r.fulfill({json:{balanceCents:cents,totalCents:499,items:[{...item,title:'Sintetik CapCut',planName:'1 ay',unitCents:499}]}});
    }
    if(r.request().method()!=='GET'){writes++;return r.abort();}
    if(path==='/api/community/state')return r.fulfill({json:{profile:{id:'qa',emailVerified:true}}});
    if(path==='/api/payments/shop/wallet')return r.fulfill({json:{cents,items:[],topups:[]}});
    if(path==='/api/payments/methods')return r.fulfill({json:{methods:[]}});
    if(path==='/api/payments/storefront')return r.fulfill({json:{products:[]}});
    if(['/odenis','/balans'].includes(path))return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/shop.css?v=checkout-shortfall-1"><main class="shop-page" id="shopApp"></main><script type="module" src="/community-assets/shop-ui.js?v=checkout-shortfall-1"></script>'});
    const name=path.split('/').at(-1);
    if(files.has(name))return live?r.continue():r.fulfill({contentType:name.endsWith('.css')?'text/css':'text/javascript',body:files.get(name)});
    return r.fulfill({status:404,body:''});
   });
   await page.goto(origin+'/odenis?mode=wallet');
   const submit=page.getByRole('button',{name:'Sifarişi tamamla · 4,99 ₼'});
   await submit.waitFor();
   assert.equal(await submit.isDisabled(),true);
   await page.getByRole('checkbox').check();
   assert.equal(await submit.isDisabled(),cents<499);
   const check=page.locator('.checkout-tile:has(input[value=wallet]) .checkout-check');
   assert.equal(await check.evaluate(n=>getComputedStyle(n).color),'rgb(100, 230, 164)');
   const warning=page.locator('.checkout-warning');
   assert.equal(await warning.isVisible(),cents<499);
   if(cents<499){
    assert.match(await warning.innerText(),new RegExp('Mövcud balansınız: '+(cents===0?'0,00':'1,25')+' ₼'));
    const missing=warning.locator('.checkout-shortfall-missing');
    assert.equal(await missing.innerText(),'Çatışmayan məbləğ: '+(cents===0?'4,99':'3,74')+' ₼');
    assert.equal(await missing.evaluate(n=>getComputedStyle(n).borderBottomWidth),'1px');
    const topup=warning.getByRole('link',{name:'Balansını artır'});
    assert.equal(await topup.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 212, 0)');
    assert.equal(await topup.locator('svg').count(),1);
    await topup.click();
    await page.locator('#balansi-artir').getByRole('heading',{name:'Məbləği seçin'}).waitFor();
    assert.equal(new URL(page.url()).hash,'#balansi-artir');
    await page.getByRole('link',{name:'← Alışa qayıt'}).click();
    await submit.waitFor();
    assert.ok(quotes>=2);
   }
   assert.deepEqual(await page.evaluate(()=>window.MirpanelCart.checkout()),[item]);
   assert.equal(writes,0);
   console.log(engine.name(),width,cents,'OK');
   await page.close();
  }
 }finally{await browser.close();}
}
