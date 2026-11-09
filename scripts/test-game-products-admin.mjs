import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const publicDir=new URL('../mirpanel-admin/public/',import.meta.url);
const state=extractAdminState(await fs.readFile(new URL('../app.js',import.meta.url),'utf8'));
const live=process.argv.includes('--live-assets');
const origin=live?'https://mirpanel.onrender.com':'http://mirpanel.test';
const mime={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css'};
const out=new URL('../outputs/game-products/',import.meta.url);
await fs.mkdir(out,{recursive:true});
let writes=0,supplierRequests=0;
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   for(const width of [320,390,430,1440]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let integrations=0,documents=0;
    await page.addInitScript(()=>window.gameQaDocument=Math.random());
    await context.route('**/*',async route=>{
     const req=route.request(),u=new URL(req.url());
     if(u.origin!==origin){
      if(u.hostname.includes('epinby')||['fetch','xhr'].includes(req.resourceType()))supplierRequests++;
      return route.abort();
     }
     if(req.isNavigationRequest())documents++;
     if(u.pathname.startsWith('/api/')){
      if(req.method()!=='GET'){writes++;return route.fulfill({status:405,json:{}});}
      let json={items:[],settings:{},products:[],orders:[],methods:[],counts:{},pending:0};
      if(u.pathname==='/api/session')json={csrfToken:'synthetic'};
      if(u.pathname==='/api/admin/state')json={data:state,sha:'synthetic',csrfToken:'synthetic'};
      if(u.pathname==='/api/admin/homepage-banners')json={banners:[],managed:true};
      if(u.pathname==='/api/admin/api-integrations'){integrations++;json={products:[],suppliers:[],mappings:[],jobs:[],drafts:[]};}
      return route.fulfill({json});
     }
     if(!/^\/[a-z0-9.-]+$/i.test(u.pathname))return route.fulfill({status:404});
     // Live mode uses the public deployed assets with an isolated authenticated shell fixture.
     if(live&&u.pathname!=='/admin.html')return route.continue();
     try{
      const body=await fs.readFile(new URL(u.pathname.slice(1),publicDir));
      return route.fulfill({body,contentType:mime[u.pathname.split('.').at(-1)]});
     }catch{return route.fulfill({status:404});}
    });
    await page.goto(origin+'/admin.html');
    await page.waitForURL('**/admin.html#dashboard');
    const token=await page.evaluate(()=>gameQaDocument);
    async function openView(view){
     if(width<600){
      await page.locator('.mobileMenuToggle').click();
      if(view==='gameProducts')await page.locator('.mobileMenuLinks summary').filter({hasText:'Məhsul idarəetməsi'}).click();
     }
     await page.locator('.navBtn[data-view="'+view+'"]').click();
    }
    await openView('gameProducts');
    const panel=page.locator('#gameProductsView');
    await panel.waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>gameQaDocument),token);
    assert.equal(documents,1);
    assert.equal(context.pages().length,1);
    await panel.getByText('API bağlantısı qurulmayıb',{exact:true}).waitFor();
    await panel.getByText('Məhsulları görmək üçün Epinby API bağlantısını qurun',{exact:true}).waitFor();
    assert.equal(await page.locator('.navBtn[data-view="gameProducts"] .adminMenuIcon').count(),1);
    assert(await panel.getByLabel('Oyun',{exact:true}).isDisabled());
    assert(await panel.getByLabel('Kateqoriya',{exact:true}).isDisabled());
    assert.equal(await panel.locator('.gameCatalogProduct').count(),0,'No invented products');
    assert.equal(integrations,0,'Opening the shell must not call integration APIs');
    await panel.getByRole('searchbox').fill('PUBG Mobile UC');
    await panel.getByRole('searchbox').press('Enter');
    assert.equal(documents,1);
    assert.equal(await panel.locator('.gameCatalogProduct').count(),0);
    await panel.getByRole('button',{name:'Təmizlə',exact:true}).click();
    assert.equal(await panel.getByRole('searchbox').inputValue(),'');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await panel.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));
    await page.screenshot({path:new URL((live?'live-assets-':'')+engine.name()+'-'+width+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
    await panel.getByRole('button',{name:'API inteqrasiyalarını aç',exact:true}).click();
    await page.locator('#apiIntegrationsView').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>gameQaDocument),token);
    await page.locator('#integrationDrafts option').first().waitFor({state:'attached'});
    assert.equal(integrations,1);
    await openView('gameProducts');
    // Refresh/direct hash entry restores the same admin workspace.
    await page.reload();await panel.waitFor({state:'visible'});
    assert.equal(new URL(page.url()).hash,'#gameProducts');
    assert.equal(context.pages().length,1);
    // A future card is tested with isolated synthetic data, never shipped as catalog data.
    await page.evaluate(()=>{
     const card=document.querySelector('#gameCatalogProductTemplate').content.cloneNode(true);
     card.querySelector('[data-game-name]').textContent='Sintetik oyun';
     card.querySelector('[data-product-name]').textContent='Uzun sınaq məhsul adı — '+ 'x'.repeat(90);
     card.querySelector('[data-product-package]').textContent='Sınaq paketi';
     card.querySelector('[data-supplier-price]').textContent='10.00';
     card.querySelector('[data-supplier-currency]').textContent='USD';
     card.querySelector('[data-game-image]').src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#66581c"/></svg>');
     document.querySelector('#gameCatalogProducts').append(card);
     document.querySelector('.gameCatalogEmpty').hidden=true;
    });
    const price=panel.locator('[data-sale-price]');
    await price.fill('25.50');assert.equal(await price.inputValue(),'25.50');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Future card cannot overflow');
    assert.deepEqual(errors,[]);
    await context.close();
    console.log(JSON.stringify({engine:engine.name(),width,mode:live?'live assets / isolated shell':'isolated',inline:true,empty:true,filters:true,refresh:true,futureCard:true}));
   }
  }finally{await browser.close();}
 }
 assert.equal(writes,0);assert.equal(supplierRequests,0);
 console.log(JSON.stringify({writes,supplierRequests,passed:true}));
}catch(e){console.error(e);process.exitCode=1;}
