import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const field=(key,label)=>({key,label,type:'text',required:true,minLength:0,maxLength:400,digits:0,options:[]});
const games=[{id:'pubg_mobile',title:'PUBG Mobile',fields:[field('player_id','Player ID')]},{id:'free_fire',title:'Free Fire',fields:[field('player_id','Player ID'),field('server_id','Server')]}].map(p=>({...p,confirmationModal:{enabled:false},plans:[{label:'Paket 1',price:1},{label:'Paket 2',price:3.5}]}));
const out='outputs/game-validation';fs.mkdirSync(out,{recursive:true});let passed=0;
for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}:{headless:true});
 try{for(const width of [390,1440])for(const product of games)for(const source of ['home','product','edit']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);let draftCount=0,networkFailed=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://game.test/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(path==='/cart-ready.js')return route.fulfill({contentType:'text/javascript',body:'export async function ensureCart(){return {read:()=>[],commitDraft:(d,m)=>{window.committed={d,m};},open(){window.cartOpened=true}}}'});
   if(path==='/api/payments/shop/quote'){const item=req.postDataJSON().items[0];return route.fulfill({json:{items:[{...item,title:product.title,planName:product.plans[item.planIndex].label,fields:product.fields,accountCheck:true,confirmationEnabled:false,terms:'Synthetic',termsVersion:'synthetic-'+product.id,unitCents:350}],totalCents:350,balanceCents:5000}});}
   if(path==='/api/payments/shop/draft'&&req.method()==='GET')return route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',productId:product.id,planIndex:1,termsVersion:'synthetic-'+product.id,values:{}}});
   if(path==='/api/payments/shop/draft'){draftCount++;const body=req.postDataJSON();await new Promise(r=>setTimeout(r,120));return route.fulfill({json:{draftId:body.id,termsVersion:body.termsVersion}});}
   if(path==='/api/payments/shop/epinby-account'){
    const input=req.postDataJSON(),id=input.values.player_id;assert.equal(input.productId,product.id);assert.equal(input.planIndex,1);
    if(id==='000001'){await new Promise(r=>setTimeout(r,1100));return route.fulfill({json:{state:'verified',name:'OLD PLAYER',allowCheckout:true}}).catch(()=>{});}
    if(id==='000003')return route.fulfill({json:{state:'invalid',message:'Hesab tapılmadı.',allowCheckout:false}});
    if(id==='000005'&&!networkFailed){networkFailed=true;return route.abort('failed');}
    if(id==='000006')return route.fulfill({json:{state:'unavailable',code:'EPINBY_PRODUCT_UNAVAILABLE',message:'Seçilmiş paket aktiv kataloqda yoxdur.',allowCheckout:false}});
    return route.fulfill({json:{state:'verified',name:'Sintetik oyunçu',allowCheckout:true}});
   }
   if(path.startsWith('/community-assets/')||/\.(?:js|mjs)$/.test(path)){
    const file=path.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+path.slice(18):path.slice(1);
    if(fs.existsSync(file))return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(file,'utf8')});return route.abort();
   }
   return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width"><style>body{background:#111;color:#eee}#modal{display:none}</style><body class="${source==='home'?'home-page':''}"><div id="homePageView"><div id="grid"><article data-product-id="${product.id}"><button class="homeCardAdd">+</button></article></div></div><button id="pp-order-btn">İndi al</button><button id="edit">Redaktə et</button><div id="modal"></div><script>const DATA={products:${JSON.stringify(games)}};let currentProduct=DATA.products.find(p=>p.id===${JSON.stringify(product.id)}),currentPlanIdx=1;function lockBodyScroll(){};window.MirpanelInventory={refresh:async()=>true,productState:p=>({canOrder:true,plans:p.plans.map(()=>({canOrder:true}))}),planState:()=>({canOrder:true})};</script><script src="/order-confirmation.js"></script><script type="module">import {editCartLine} from '/community-assets/cart-entry.js?v=game-validation-1';document.querySelector('#edit').onclick=()=>editCartLine({productId:${JSON.stringify(product.id)},planIndex:1,quantity:1,draftId:'00000000-0000-4000-8000-000000000001'});</script>`});
  });
  await page.goto('https://game.test'+(source==='home'?'/':source==='edit'?'/sebet':'/mehsul/'+product.id));
  await page.locator(source==='home'?'.homeCardAdd':source==='edit'?'#edit':'#pp-order-btn').click();
  if(source==='home')await page.locator('.homeCardPlanPicker').getByRole('button',{name:/Paket 2/}).click();
  const dialog=page.locator('dialog.cart-entry[open]'),id=dialog.getByLabel('Player ID',{exact:true}),next=dialog.locator('button[type=submit]');await id.waitFor();
  if(product.id==='free_fire'){await id.fill('000002');await dialog.getByText('«Server» sahəsini doldurun.').waitFor();assert(await next.isDisabled());await dialog.getByLabel('Server',{exact:true}).fill('0001');}
  await id.fill('000001');await page.waitForTimeout(550);await id.fill('000002');await dialog.getByText('Oyunçu tapıldı',{exact:true}).waitFor();await page.waitForTimeout(700);assert.equal(await dialog.getByText('OLD PLAYER').count(),0);assert.equal(await dialog.locator('.player-result-id').textContent(),'Oyunçu ID-si: 000002');
  await id.fill('000003');assert.equal(await dialog.locator('.player-result-card').count(),0);await dialog.getByText('Hesab tapılmadı.',{exact:true}).waitFor();assert(await next.isDisabled());
  await id.fill('000006');await dialog.getByText('Seçilmiş paket aktiv kataloqda yoxdur.').waitFor();assert(await next.isDisabled());
  await id.fill('000005');await dialog.getByRole('button',{name:'Yenidən cəhd et',exact:true}).click();await dialog.getByText('Oyunçu tapıldı',{exact:true}).waitFor();assert(await next.isEnabled());
  if(source==='product')await dialog.screenshot({path:out+'/'+name+'-'+width+'-'+product.id+'.png'});
  await next.evaluate(b=>{b.click();b.click();});await page.waitForFunction(()=>window.cartOpened===true);assert.equal(draftCount,1);const saved=await page.evaluate(()=>window.committed);assert.equal(saved.m.productId,product.id);assert.equal(saved.m.planIndex,1);assert.equal(saved.m.edit,source==='edit');assert.deepEqual(errors,[]);
  console.log('PASS',name,width,product.id,source,'stale/invalid/package/retry/double-submit');passed++;await context.close();
 }}finally{await browser.close();}
}
console.log('PASS',passed,'isolated real-entry browser scenarios; no real supplier orders');
