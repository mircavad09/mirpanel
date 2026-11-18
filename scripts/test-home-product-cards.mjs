import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {cartPageContent,cartPageScript,cartPageStyle} from '../cart-page.mjs';

const {products}=extractAdminState(await fs.readFile('app.js','utf8'));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/sebet'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><meta charset="utf-8">'+cartPageStyle+cartPageContent+cartPageScript);
 }
 const file=url.pathname==='/'?'index.html':url.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+url.pathname.slice(18):url.pathname.slice(1);
 try{const bytes=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const output=path.resolve('outputs/home-product-cards');
const forbidden=/Anında təqdim olunur|Ödənişdən (?:dərhal )?sonra avtomatik icra olunur/i;
await fs.mkdir(output,{recursive:true});
try{
 for(const width of [320,390,430,768,1024,1440,1920]){
  const mobile=width<768,ctx=await browser.newContext({viewport:{width,height:880},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  let stock=27,calls=0;const drafts=[];
  try{
   await ctx.addInitScript(()=>sessionStorage.setItem('mirpanel.intro.seen','1'));
   await ctx.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    const json=data=>route.fulfill({json:data});
    if(p==='/api/payments/inventory'){
     calls++;
     return json({products:products.map(product=>{
      const tracked=['zoom','capcut'].includes(product.id),count=product.id==='zoom'?stock:24;
      return {productId:product.id,canOrder:true,scope:'product',unlimited:!tracked,available:tracked?count:null,
       plans:product.plans.map((_,i)=>({planKey:String(i),canOrder:true,tracked,available:tracked?count:null,fulfillment:{automatic:true,ready:count}}))};
     })});
    }
    if(p==='/api/product-sales'){
     const productId=url.searchParams.get('productId');
     return json({initialized:true,productId,productTotal:productId==='capcut'?2319:productId==='zoom'?129:2737,siteTotal:12000});
    }
    if(p==='/api/payments/shop/quote'&&req.method()==='POST')return json({items:req.postDataJSON().items.map(x=>{
     const product=products.find(y=>y.id===x.productId),plan=product.plans[x.planIndex];
     return {...x,title:product.title,planName:plan.label||'Aylıq',terms:'Səbət sınağı',termsVersion:'fixture',unitCents:Math.round(plan.price*100),available:27,fields:[]};
    })});
    if(p==='/api/payments/shop/draft'&&req.method()==='POST'){
     const {id,productId,planIndex,termsVersion}=req.postDataJSON();
     drafts.push({productId,planIndex});return json({draftId:id,lineId:id,productId,planIndex,termsVersion,quantity:1});
    }
    if(url.origin!==origin||req.method()!=='GET')return route.abort();
    if(p.startsWith('/api/'))return json({banners:[],stories:[],items:[],products:[]});
    return route.continue();
   });
   const page=await ctx.newPage();
   page.setDefaultTimeout(10000);
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   const grid=page.locator('#homePageView #grid'),cards=grid.locator('.homeProductCard');
   const zoom=grid.locator('[data-product-id="zoom"]'),capcut=grid.locator('[data-product-id="capcut"]');
   await zoom.getByText('Stok: 27',{exact:true}).waitFor();
   await zoom.getByText('129+ dəfə satılıb',{exact:true}).waitFor();
   await capcut.getByText('2 319+ dəfə satılıb',{exact:true}).waitFor();
   const noDelivery=async()=>{
    assert.equal(await grid.locator('.homeCardInstant,.homeCardDelivery').count(),0);
    assert.doesNotMatch(await grid.textContent(),forbidden);
   };
   await noDelivery();
   const geometry=await cards.evaluateAll(elements=>elements.map(card=>{
    const rect=el=>el?.getBoundingClientRect().toJSON();
    const find=s=>rect(card.querySelector(s));
    return {id:card.dataset.productId,card:rect(card),image:find('.imgWrap'),title:find('.title'),price:find('.homeCardPrices'),plus:find('.homeCardAdd'),icon:find('.homeCardAdd span'),sales:find('.homeCardSales:not([hidden])'),stock:find('.cardStockLine')};
   }));
   const rows=new Map();
   for(const item of geometry){const key=Math.round(item.card.top);rows.set(key,(rows.get(key)||0)+1);}
   const perRow=mobile?2:5;
   assert.deepEqual([...rows.values()].slice(0,2),[perRow,perRow]);
   assert([...rows.values()].slice(0,-1).every(n=>n===perRow));
   assert.equal([...rows.values()].at(-1),(geometry.length%perRow)||perRow);
   for(const g of geometry){
    assert(Math.abs(g.image.width/g.image.height-16/9)<.02,g.id);
    assert(g.price.top-g.title.bottom>=0&&g.price.top-g.title.bottom<=6,g.id);
    if(g.plus){
     assert(g.plus.left>=g.price.right-1&&Math.min(g.plus.height,g.plus.width)>=44,g.id);
     assert(Math.abs((g.plus.top+g.plus.bottom-g.icon.top-g.icon.bottom)/2)<1,g.id);
     assert(Math.abs((g.plus.left+g.plus.right-g.icon.left-g.icon.right)/2)<1,g.id);
    }
    if(g.sales&&g.stock)assert(g.stock.top>=g.sales.bottom,g.id);
    if(g.stock)assert(g.card.bottom-g.stock.bottom<=10,g.id);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if([390,1440].includes(width)){
    await grid.evaluate(node=>scrollBy(0,node.getBoundingClientRect().top-135));
    await cards.locator('.img').evaluateAll(nodes=>Promise.all(nodes.slice(0,10).map(img=>img.decode().catch(()=>{}))));
    const boxes=await Promise.all(Array.from({length:perRow*2},(_,i)=>cards.nth(i).boundingBox()));
    const bounds=await grid.boundingBox(),top=Math.floor(boxes[0].y),bottom=Math.ceil(Math.max(...boxes.map(box=>box.y+box.height)));
    await page.screenshot({path:path.join(output,'ana-sehife-'+width+'.png'),animations:'disabled',clip:{x:Math.ceil(bounds.x),y:top,width:Math.floor(bounds.width),height:bottom-top}});
   }
   stock=28;const before=calls;
   await page.evaluate(()=>window.MirpanelInventory.refresh({force:true}));
   await zoom.getByText('Stok: 28',{exact:true}).waitFor();assert(calls>before);
   await noDelivery();
   await page.locator('#tabs [data-home-filter="best"]').click();
   assert((await cards.count())<geometry.length);
   await noDelivery();
   await page.getByRole('tab',{name:'Hamısı',exact:true}).click();
   assert.equal(await cards.count(),geometry.length);
   await capcut.getByText('2 319+ dəfə satılıb',{exact:true}).waitFor();
   await noDelivery();
   if(mobile){
    await zoom.getByRole('button',{name:'Səbətə əlavə et'}).tap();
    const consent=page.locator('dialog.cart-entry[open]');
    await consent.getByText('Səbət sınağı',{exact:true}).waitFor();
    await consent.getByRole('checkbox').check();
    await consent.getByRole('button',{name:'Təsdiqləyirəm'}).click();
    await page.waitForURL(origin+'/sebet');
    await page.getByRole('dialog',{name:'Səbət'}).waitFor();
    assert.deepEqual(drafts,[{productId:'zoom',planIndex:0}]);
    const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('mirpanel.cart.v1')||'[]'));
    assert(cart.some(item=>item.productId==='zoom'&&item.planIndex===0&&item.quantity===1));
   }
   console.log(width+'px: rows '+[...rows.values()].join('/')+', card geometry, forced stock refresh, filters'+(mobile?' and cart':''));
  }finally{await ctx.close();}
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
