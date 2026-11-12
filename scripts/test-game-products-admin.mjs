import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {extractAdminState,normalizeAdminPayload} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles,generateProductListingPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {createEpinbyConnection} from '../mirpanel-admin/epinby-connection.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const publicDir=new URL('../mirpanel-admin/public/',import.meta.url);
const state=extractAdminState(await fs.readFile(new URL('../app.js',import.meta.url),'utf8'));
const row={api_key_cipher:'encrypted',webhook_secret_cipher:'never-exposed',credential_version:1,last_status:'confirmed',currency:'USD'};
const supplierProducts=[
 {id:11,name:'60 UC',game:'PUBG MOBIL TOPUP',game_id:1,category:'PUBG WEB CN AUTO',category_id:1,region:'CN',type:'TOPUP',fields:[{key:'player_id',label:'Player ID',required:true}],price:'0.8900',stock_status:'FINITE',stock_count:25,image:'https://epinby.com/sample.png'},
 {id:12,name:'100 Stars',game:'Telegram',game_id:2,category:'Stars',category_id:2,type:'VOUCHER',fields:[],price:'1.1200',stock_status:'UNLIMITED',image:'https://epinby.com/sample.png'}
];
const calls=[];
const epinby=createEpinbyConnection({pool:async()=>({query:async()=>({rows:[row]})}),security:{decryptSecret:()=> 'synthetic'},
 transport:async({path,query,body})=>{
  assert.equal(body,undefined);
  if(path==='/api/v1/games')return {success:true,data:[{id:1,name:'PUBG Mobile'},{id:2,name:'Telegram'}]};
  assert.equal(path,'/api/v1/products');calls.push(query.page);
  return {success:true,data:[supplierProducts[query.page-1]],meta:{current_page:query.page,last_page:2,total:2}};
 }});
const fixture=await epinby({action:'epinby-catalog'});
assert.deepEqual(calls,[1]);assert.equal(fixture.products[0].stockCount,25);assert.equal(fixture.complete,false);
assert.equal(fixture.products[0].region,'CN');
fixture.products.push(...(await epinby({action:'epinby-catalog',page:2})).products);fixture.meta={page:1,lastPage:1,total:2,perPage:50};
fixture.games=(await epinby({action:'epinby-catalog',gamesOnly:true})).games;
assert(!JSON.stringify(fixture).includes('never-exposed'));
assert.equal(inventoryAvailability({id:'epinby_11',plans:[{price:3}]},{scope:'product',available:100}).canOrder,false);
const live=process.argv.includes('--live-assets');
const origin=live?'https://mirpanel.onrender.com':'https://mirpanel.test';
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
    let integrations=0,documents=0,published,expectedPubgPrice=3.49;
    const freeFire={id:99,name:'100+10 Diamond',game:'Garena Free Fire Vouchers(Official)',category:'Diamonds',region:'Global',gameId:3,categoryId:3,type:'VOUCHER',price:'0.9364',stockCount:1560,stockStatus:'FINITE'};
    const fillers=Array.from({length:48},(_,i)=>({...fixture.products[1],id:1000+i,name:'Synthetic credits '+i}));
    await page.addInitScript(()=>window.gameQaDocument=Math.random());
    await context.route('**/*',async route=>{
     const req=route.request(),u=new URL(req.url());
     if(u.href==='https://epinby.com/sample.png')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>'});
     if(u.origin!==origin){
      if(u.hostname.includes('epinby')||['fetch','xhr'].includes(req.resourceType()))supplierRequests++;
      return route.abort();
     }
     if(req.isNavigationRequest())documents++;
     if(u.pathname.startsWith('/api/')){
      if(req.method()!=='GET'){
       if(u.pathname==='/api/admin/api-integrations'&&req.postDataJSON()?.action==='epinby-read')return route.fulfill({json:fixture.connection});
       if(u.pathname==='/api/admin/preview'){
        const added=req.postDataJSON().data.products.filter(p=>p.plans.some(plan=>plan.supplier?.productId===11));
        if(added.length){
         assert.equal(added.length,1);assert.equal(added[0].id,'pubg_mobile');
         const catalog=normalizeAdminPayload(req.postDataJSON().data);
         const product=catalog.products.find(p=>p.id==='pubg_mobile');
         const plan=product.plans.find(p=>p.id==='epinby_11');
         assert.equal(product.soldOut,false);assert.equal(plan.price,expectedPubgPrice);
         assert.equal(plan.supplier.productId,11);assert.equal(plan.formFields[0].key,'player_id');
         assert.equal(plan.image,'https://epinby.com/sample.png');
         assert.match([...generateProductListingPageFiles(catalog.products).values()].join(''),/pubg-mobile/);
         const html=[...generateProductPageFiles([product]).values()].join('');
         assert.match(html,/epinby-package-thumb/);
         assert.doesNotMatch(html,/disabled>Alış hələ açılmayıb/);
        }
        return route.fulfill({json:{previewDigest:'test',productCount:1,activeProductCount:1,pageCount:1,warnings:[]}});
       }
       if(u.pathname==='/api/admin/save'){
        published=normalizeAdminPayload(req.postDataJSON().data);
        assert.equal(published.products.flatMap(p=>p.plans).filter(p=>p.supplier?.productId===11).length,1);
        return route.fulfill({json:{sha:'synthetic-saved',commitSha:'synthetic-commit',committedAt:new Date().toISOString()}});
       }
       writes++;return route.fulfill({status:405,json:{}});
      }
      let json={items:[],settings:{},products:[],orders:[],methods:[],counts:{},pending:0};
      if(u.pathname==='/api/session')json={csrfToken:'synthetic'};
      if(u.pathname==='/api/admin/state')json={data:state,sha:'synthetic',csrfToken:'synthetic'};
      if(u.pathname==='/api/admin/homepage-banners')json={banners:[],managed:true};
      if(u.pathname==='/api/admin/api-integrations'){
       if(u.searchParams.get('view')==='epinby-catalog'){
        const gameId=Number(u.searchParams.get('gameId')),page=Number(u.searchParams.get('page'))||1;
        const products=gameId===1?[fixture.products[0]]:gameId===3?[freeFire]:[...fixture.products,...fillers,freeFire];
        json={...fixture,games:[...fixture.games,{id:3,name:'Garena Free Fire Vouchers(Official)'}],products:products.slice((page-1)*50,page*50),meta:{page,lastPage:Math.ceil(products.length/50),total:products.length,perPage:50}};
       }else if(u.searchParams.get('view')==='epinby-categories')json={categories:Number(u.searchParams.get('gameId'))===3?[{id:3,name:'Diamonds'}]:[{id:1,name:'UC'}]};
       else {integrations++;json={products:[],suppliers:[],mappings:[],jobs:[],drafts:[]};}
      }
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
    await panel.getByText('Bağlantı təsdiqləndi',{exact:true}).waitFor();
    assert.equal(await page.locator('.navBtn[data-view="gameProducts"] .adminMenuIcon').count(),1);
    await page.waitForFunction(()=>document.querySelectorAll('#gameCatalogProducts .gameCatalogProduct').length===50);
    assert.equal(await panel.locator('#gameCatalogProducts :is(img,input[type=file])').count(),0);
    const boxes=await panel.locator('.gameCatalogProduct').evaluateAll(rows=>rows.slice(0,2).map(row=>{const {x,y,width,height}=row.getBoundingClientRect();return {x,y,width,height};}));
    assert(boxes[1].y>=boxes[0].y+boxes[0].height&&boxes[0].x===boxes[1].x);
    assert.equal(integrations,0,'Opening the shell must not call integration APIs');
    const search=panel.getByRole('searchbox');
    await search.fill('Free Fire — 100+10 Diamond');
    await panel.getByRole('heading',{name:'Free Fire — 100+10 Diamond',exact:true}).waitFor();
    assert.equal(await panel.locator('.gameCatalogProduct:visible').count(),1);
    await panel.getByRole('button',{name:'Təmizlə',exact:true}).click();
    await panel.getByRole('button',{name:'Daha çox paket yüklə'}).click();
    await panel.getByRole('heading',{name:'Free Fire — 100+10 Diamond',exact:true}).waitFor();
    assert.equal(await panel.locator('.gameCatalogProduct:visible').count(),51);
    await panel.getByRole('searchbox').fill('PUBG Mobile');
    await panel.getByRole('searchbox').press('Enter');
    assert.equal(documents,1);
    assert.equal(await panel.locator('.gameCatalogProduct:visible').count(),1);
    await panel.getByRole('button',{name:'Təmizlə',exact:true}).click();
    assert.equal(await panel.getByRole('searchbox').inputValue(),'');
    await panel.getByLabel('Oyun',{exact:true}).selectOption('1');
    await panel.getByLabel('Kateqoriya',{exact:true}).selectOption('1');
    await page.waitForFunction(()=>document.querySelector('#gameCatalogHint')?.textContent.startsWith('1 görünən'));
    assert.equal(await panel.locator('.gameCatalogProduct:visible').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await panel.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));
    await page.screenshot({path:new URL((live?'live-assets-':'')+engine.name()+'-'+width+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
    await openView('apiIntegrations');
    await page.locator('#apiIntegrationsView').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>gameQaDocument),token);
    await page.locator('#integrationDrafts option').first().waitFor({state:'attached'});
    assert.equal(integrations,1);
    await openView('gameProducts');
    // Refresh/direct hash entry restores the same admin workspace.
    await page.waitForLoadState('networkidle');
    await page.reload();await panel.waitFor({state:'visible'});
    assert.equal(new URL(page.url()).hash,'#gameProducts');
    assert.equal(context.pages().length,1);
    const card=panel.locator('.gameCatalogProduct').first();
    await card.getByRole('heading',{name:'PUBG Mobile — 60 UC',exact:true}).waitFor();
    await card.getByText('PUBG WEB CN AUTO',{exact:false}).waitFor();
    await card.locator('[data-sale-price]').fill('3.49');
    await card.locator('[data-game-add]').click();
    const picker=page.getByRole('dialog',{name:'Hansı məhsula əlavə edilsin?'});
    await picker.waitFor();
    assert(await picker.locator('option').filter({hasText:'Netflix'}).count());
    assert(await picker.locator('option').filter({hasText:'CapCut'}).count());
    await picker.getByLabel('Kateqoriya',{exact:true}).selectOption('epinby-games');
    await picker.getByLabel('Məhsul axtar').fill('PUBG');
    await picker.getByLabel('Məhsullar',{exact:true}).selectOption('pubg_mobile');
    assert(await picker.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));
    await picker.getByRole('button',{name:'Təsdiqlə'}).click();
    await page.getByRole('heading',{name:'Dəyişiklikləri yoxlayın'}).waitFor({timeout:5000}).catch(async error=>{
     console.error(await page.locator('body').innerText().then(t=>t.slice(-1800)));
     throw error;
    });
    await page.locator('#modalConfirm').click();
    await page.waitForFunction(()=>!state.dirty);
    assert.equal(published.products.find(p=>p.id==='pubg_mobile').plans.find(p=>p.id==='epinby_11').price,3.49);
    await page.locator('#modalCancel').click();
    fixture.products[0].price='1.5900';
    await panel.getByRole('button',{name:'Kataloqu yenilə'}).click();
    await card.getByText('1.5900',{exact:true}).waitFor();
    await card.getByText('Kataloqda var · PUBG Mobile',{exact:true}).waitFor();
    assert.equal(await card.locator('[data-sale-price]').inputValue(),'3.49');
    assert.equal(await page.evaluate(()=>state.data.products.flatMap(p=>p.plans).filter(p=>p.supplier?.productId===11).length),1);
    const originalPricingId=published.products.find(p=>p.id==='pubg_mobile').plans.find(p=>p.supplier?.productId===11).pricingId;
    expectedPubgPrice=3.79;
    await card.locator('[data-sale-price]').fill('3.79');
    await card.getByRole('button',{name:'Qiyməti yenilə'}).click();
    await page.getByRole('heading',{name:'Dəyişiklikləri yoxlayın'}).waitFor();
    await page.locator('#modalConfirm').click();
    await page.waitForFunction(()=>!state.dirty);
    assert.equal(published.products.find(p=>p.id==='pubg_mobile').plans.find(p=>p.supplier?.productId===11).pricingId,originalPricingId);
    await page.locator('#modalCancel').click();
    const stars=panel.locator('.gameCatalogProduct').filter({hasText:'100 Stars'});
    await stars.locator('[data-sale-price]').fill('2.49');
    await stars.locator('[data-game-add]').click();
    await picker.waitFor();
    const targets=picker.getByLabel('Məhsullar',{exact:true});
    assert.deepEqual(await targets.locator('option').allTextContents(),['Telegram Premium']);
    assert.equal(await targets.inputValue(),'telegram_premium');
    await picker.getByRole('button',{name:'Təsdiqlə'}).click();
    await page.getByRole('heading',{name:'Dəyişiklikləri yoxlayın'}).waitFor();
    await page.locator('#modalConfirm').click();
    await page.waitForFunction(()=>!state.dirty);
    const telegram=published.products.find(p=>p.id==='telegram_premium');
    assert.equal(telegram.plans.find(p=>p.supplier?.productId===12).price,2.49);
    assert.equal(published.products.some(p=>p.title==='Telegram Stars'),false);
    assert.match(generateProductPageFiles([telegram]).get('mehsul/telegram-premium.page'),/100 Stars/);
    await page.locator('#modalCancel').click();
    await panel.getByLabel('Oyun',{exact:true}).selectOption('3');
    await panel.getByLabel('Kateqoriya',{exact:true}).selectOption('3');
    const diamond=panel.locator('.gameCatalogProduct').filter({hasText:'100+10 Diamond'});
    await diamond.locator('[data-sale-price]').fill('4.49');
    await diamond.locator('[data-game-add]').click();
    await picker.waitFor();
    assert.equal(await targets.inputValue(),'free_fire');
    await picker.getByRole('button',{name:'Təsdiqlə'}).click();
    await page.getByRole('heading',{name:'Dəyişiklikləri yoxlayın'}).waitFor();
    await page.locator('#modalConfirm').click();
    await page.waitForFunction(()=>!state.dirty);
    const fire=published.products.find(p=>p.id==='free_fire');
    assert.equal(fire.plans.find(p=>p.supplier?.productId===99).price,4.49);
    assert.equal(fire.image,state.products.find(p=>p.id==='free_fire').image);
    // WebKit reports navigation-aborted background badges as access-control errors.
    // Catalog requests must still be error-free.
    assert.deepEqual(errors.filter(e=>!e.includes('/api/admin/payment-orders?tab=pending')&&!e.includes('/api/admin/community/shop?only=topup-count due to access control checks.')),[]);
    await context.close();
    console.log(JSON.stringify({engine:engine.name(),width,mode:live?'live assets / isolated shell':'isolated',rows:true,noImages:true,filters:true,pageTwo:true,targets:['PUBG Mobile','Telegram Premium','Free Fire'],noDuplicate:true,priceUpdate:true}));
   }
  }finally{await browser.close();}
 }
 assert.equal(writes,0);assert.equal(supplierRequests,0);
 console.log(JSON.stringify({writes,supplierRequests,passed:true}));
}catch(e){console.error(e);process.exitCode=1;}
