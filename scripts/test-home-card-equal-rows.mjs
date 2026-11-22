import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
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

const output=path.resolve('outputs/home-card-equal-rows');await fs.mkdir(output,{recursive:true});
let browser;
try{
 for(const [name,engine] of [['chrome',chromium],['webkit',webkit]]){
  browser=await engine.launch(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  for(const width of [320,390,430,1440]){
   const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   let count=6,ready=1;const errors=[];let writes=0;
   await ctx.addInitScript(()=>sessionStorage.setItem('mirpanel.intro.seen','1'));
   await ctx.route('**/*',route=>{
    const req=route.request(),u=new URL(req.url()),p=u.pathname;
    if(req.method()!=='GET'){writes++;return route.abort();}
    if(p==='/api/payments/inventory')return route.fulfill({json:{products:products.map(product=>{
     const stock=['netflix_umumi','youtube'].includes(product.id)?0:product.id==='zoom'?count:8;
     return {productId:product.id,scope:'product',unlimited:false,available:stock,canOrder:stock>0,plans:product.plans.map((_,i)=>({planKey:String(i),tracked:true,available:stock,canOrder:stock>0,fulfillment:{automatic:true,ready:stock?ready:0}}))};
    })}});
    if(p==='/api/product-sales')return route.fulfill({json:{initialized:true,productId:u.searchParams.get('productId'),productTotal:2319,siteTotal:12000}});
    if(u.origin!==origin)return route.abort();
    if(p.startsWith('/api/'))return route.fulfill({json:{banners:[],stories:[],items:[],products:[]}});
    return route.continue();
   });
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MirpanelInventory);
   await page.evaluate(()=>window.MirpanelInventory.refresh({force:true}));
   const grid=page.locator('#homePageView #grid');await grid.locator('.homeCardSales:not([hidden])').first().waitFor();
   await grid.locator('[data-product-id="youtube"] .cardStockBadge.out').waitFor();
   const geometry=()=>grid.locator('.homeProductCard:visible').evaluateAll(nodes=>nodes.map(n=>{
    const rect=s=>{const e=s===':scope'?n:n.querySelector(s),r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}:null;};
    return{id:n.dataset.productId,group:n.parentElement.className,card:rect(':scope'),image:rect('.imgWrap'),title:rect('.title'),price:rect('.homeCardPrices'),sales:rect('.homeCardSales'),stock:rect('.cardStockLine'),plus:rect('.homeCardAdd'),icon:rect('.homeCardAdd span')};
   }));
   const check=async()=>{
    const data=await geometry(),rows=new Map();
    for(const d of data){const key=Math.round(d.card.y);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(d);}
    for(const row of rows.values()){
     assert(row.length<=(width<768?2:5));
     for(const field of ['card','image','title','price','sales']){
      const first=row[0][field];for(const d of row){assert(Math.abs(d[field].y-first.y)<1,field+' top '+d.id);assert(Math.abs(d[field].height-first.height)<1,field+' height '+d.id);}
     }
    }
    for(const d of data){assert(Math.abs(d.image.width/d.image.height-16/9)<.02);if(d.plus){assert(d.plus.y>=d.title.bottom);assert(Math.abs(d.plus.width-d.plus.height)<1);assert(Math.abs(d.plus.x+d.plus.width/2-d.icon.x-d.icon.width/2)<1);assert(Math.abs(d.plus.y+d.plus.height/2-d.icon.y-d.icon.height/2)<1);}}
    for(const id of ['youtube','netflix_umumi']){const card=grid.locator('[data-product-id="'+id+'"]');assert.equal(await card.locator('.cardStockBadge').textContent(),'Stokda yoxdur');assert(await card.locator('.homeCardAdd').isDisabled());}
    for(const id of ['netflix','spotify','zoom'])assert.equal(await grid.locator('[data-product-id="'+id+'"] .cardStockLine').count(),0);
    assert(!/Son \d+ ədəd|Stok: \d+/.test(await grid.textContent()));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    return data;
   };
   const before=await check();
   for(const value of [1,5,6]){count=value;await page.evaluate(()=>window.MirpanelInventory.refresh({force:true}));assert.deepEqual(await check(),before);}
   ready=0;await page.evaluate(()=>window.MirpanelInventory.refresh({force:true}));assert.deepEqual(await check(),before);assert.equal(await grid.locator('.homeCardInstant').count(),0);
   ready=1;await page.evaluate(()=>window.MirpanelInventory.refresh({force:true}));await check();
   if(name==='chrome'&&[390,1440].includes(width)){
    await grid.evaluate(n=>n.scrollIntoView({block:'start'}));
    await grid.locator('.img').evaluateAll(imgs=>Promise.all(imgs.filter(i=>i.complete).map(i=>i.decode().catch(()=>{}))));
    await page.locator('.home-product-section[aria-labelledby="home-section-subscriptions"]').screenshot({path:path.join(output,'preview-'+width+'.png'),animations:'disabled'});
   }
   assert.equal(writes,0);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({engine:name,width,equalRows:true,pairs:['Netflix Şəxsi / Netflix Ümumi','YouTube / Spotify'],reservedStock:true,stockChanges:[1,5,6],instantOverlay:true,overflow:false,realWrites:writes}));
   await ctx.close();
  }
  await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}


