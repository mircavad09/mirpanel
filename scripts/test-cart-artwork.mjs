import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const {products}=extractAdminState(await fs.readFile('app.js','utf8'));
const artwork=prefix=>products.find(p=>p.image?.startsWith('uploads/products/'+prefix+'-')).image;
const product=(id,title,image)=>({id,title,image,plans:[{label:'1 Ay',price:4.99}]});
const catalog=[
 product('capcut','CapCut Pro',artwork('capcut')),
 product('spotify','Spotify Premium',artwork('spotify')),
 product('netflix','Netflix Şəxsi',artwork('netflix')),
 product('broken','Qırıq şəkil sınağı','uploads/products/missing-test.png'),
 product('missing','Şəkilsiz məhsul','')
];
const origin='https://cart-artwork.test',url=origin+'/mehsul/capcut-pro';
const capcut={productId:'capcut',planIndex:0,quantity:2};
const missing={productId:'missing',planIndex:0,quantity:1};
const stale='uploads/products/old-capcut-test.png';
const assertImage=async(row,path)=>{
 const img=row.locator('.mir-cart-artwork img');
 await img.waitFor({state:'visible'});
 assert.equal(await img.evaluate(n=>n.naturalWidth>0),true);
 assert.equal(await img.getAttribute('src'),new URL(path,origin+'/').href);
};

for(const [engine,width] of [[webkit,390],[chromium,1440]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const saved of [false,true]){
   const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<500,isMobile:width<500,reducedMotion:'reduce'});
   const requests=[];
   await page.route(origin+'/**',async route=>{
    const u=new URL(route.request().url());
    requests.push(u.pathname);
    if(u.pathname==='/api/payments/shop/quote'){
     const items=route.request().postDataJSON().items.map(x=>({...x,title:catalog.find(p=>p.id===x.productId).title,planName:'1 Ay',image:x.productId==='capcut'?stale:'',unitCents:499}));
     await new Promise(resolve=>setTimeout(resolve,300));
     return route.fulfill({json:{items,totalCents:items.reduce((c,x)=>c+x.unitCents*x.quantity,0)}}).catch(()=>{});
    }
    if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],removed:true}});
    if(u.href===url)return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><a id="cartHeaderLink" href="/sebet">Səbət</a><script>const DATA={products:${JSON.stringify(catalog)}};${saved?`localStorage.setItem('mirpanel.cart.v1',${JSON.stringify(JSON.stringify([capcut,missing]))});localStorage.setItem('mirpanel.cart.preview.v1',${JSON.stringify(JSON.stringify({'["capcut",0]':{title:'CapCut Pro',image:stale}}))});`:''}</script><script src="/cart-store.js"></script>`});
    const types={'.js':'text/javascript','.css':'text/css','.png':'image/png'};
    const file=u.pathname.slice(1),type=types[file.slice(file.lastIndexOf('.'))];
    if(type&&/^(?:cart-store\.(?:js|css)|uploads\/products\/[a-z0-9_.-]+\.png)$/i.test(file)){
     const body=await fs.readFile(file).catch(()=>null);
     if(body)return route.fulfill({contentType:type,body});
    }
    return route.fulfill({status:404,body:''});
   });
   await page.goto(url);
   if(!saved)await page.evaluate(({capcut,missing})=>{
    MirpanelCart.commitDraft({draftId:'11111111-1111-4111-8111-111111111111'},capcut);
    MirpanelCart.commitDraft({draftId:'22222222-2222-4222-8222-222222222222'},missing);
   },{capcut,missing});
   await page.locator('#cartHeaderLink').click();
   const dialog=page.getByRole('dialog',{name:'Səbət'});
   await assertImage(dialog.locator('[data-cart-product=capcut]'),artwork('capcut'));
   await dialog.getByText('Sifarişiniz hazırdır — ödənişi tamamlayın').waitFor();
   await assertImage(dialog.locator('[data-cart-product=capcut]'),artwork('capcut'));
   for(const [title,prefix] of [['Spotify Premium','spotify'],['Netflix Şəxsi','netflix']]){
    await assertImage(dialog.locator('.mir-cart-suggestion').filter({hasText:title}),artwork(prefix));
   }
   for(const row of [dialog.locator('[data-cart-product=missing]'),dialog.locator('.mir-cart-suggestion').filter({hasText:'Qırıq şəkil sınağı'})]){
    await row.locator('.mir-cart-artwork svg').waitFor();
    await row.locator('.mir-cart-artwork img').waitFor({state:'detached'});
   }
   assert.ok(requests.includes('/uploads/products/missing-test.png'));
   assert.ok(!requests.some(p=>p.startsWith('/mehsul/uploads/')||p.includes('old-capcut')));
   assert.deepEqual(await page.evaluate(()=>MirpanelCart.read().map(({productId,quantity})=>({productId,quantity}))),[{productId:'capcut',quantity:2},{productId:'missing',quantity:1}]);
   await page.close();
   console.log(JSON.stringify({engine:engine.name(),width,saved,cart:true,recommendations:true,fallback:true}));
  }
 }finally{await browser.close();}
}
