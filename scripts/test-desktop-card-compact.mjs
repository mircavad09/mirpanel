import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';

const live=process.argv.includes('--live');
const {products}=extractAdminState(await fs.readFile('app.js','utf8'));
const type={'.html':'text/html','.page':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/mehsul'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await fs.readFile('mehsul.page'));}
 const name=url.pathname==='/'?'index.html':url.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+url.pathname.slice(18):url.pathname.slice(1)+(/^\/mehsul\/[a-z0-9-]+$/.test(url.pathname)?'.page':'');
 try{
  const bytes=await fs.readFile(name);
  res.setHeader('Content-Type',type[path.extname(name)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [320,390,430,1024,1440,1920]) for(const route of ['/','/mehsul']){
  const context=await browser.newContext({viewport:{width,height:880},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
  try{
   const drafts=[];
   await context.addInitScript(()=>sessionStorage.setItem('mirpanel.intro.seen','1'));
   await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url()),p=u.pathname;
    const json=data=>route.fulfill({json:data});
    if(p==='/api/payments/inventory')return json({products:products.map(product=>({productId:product.id,canOrder:true,scope:product.id==='capcut'?'plan':'product',unlimited:product.id!=='capcut',plans:product.plans.map((_,i)=>({planKey:String(i),canOrder:true,tracked:true,available:i?4:0}))}))});
    if(p==='/api/product-sales')return json({initialized:true,productId:u.searchParams.get('productId'),productTotal:127,siteTotal:12000});
    if(p==='/api/payments/shop/quote'&&r.method()==='POST'){
     const items=r.postDataJSON().items.map(x=>{
      const product=products.find(product=>product.id===x.productId),plan=product.plans[x.planIndex];
      return {...x,title:product.title,planName:plan.label||'Aylıq',terms:'Sintetik səbət sınağı',termsVersion:'fixture',unitCents:Math.round(plan.price*100),available:4,fields:[]};
     });
     return json({items});
    }
    if(p==='/api/payments/shop/draft'&&r.method()==='POST'){
     const {id,productId,planIndex,termsVersion}=r.postDataJSON();
     drafts.push({productId,planIndex});return json({draftId:id,lineId:id,productId,planIndex,termsVersion,quantity:1});
    }
    if(r.method()!=='GET'||u.origin!==origin)return route.abort();
    if(p.startsWith('/api/'))return json({banners:[],stories:[],items:[],products:[]});
    return route.continue();
   });
   const page=await context.newPage();page.setDefaultTimeout(12000);
   await page.goto(origin+route,{waitUntil:'domcontentloaded'});
   const grid=page.locator(route==='/'?'#grid':'.catalog-grid');
   const card=id=>grid.locator('.homeProductCard[data-product-id="'+id+'"]');
   await card('spotify').locator('.homeCardSales:not([hidden])').waitFor();
   await card('capcut').locator('.cardStockLine').waitFor();
   assert.equal(await card('spotify').locator('.cardStockLine').count(),0);
   assert((await card('spotify').locator('.title').innerText()).length>20);
   await page.mouse.move(0,0);
   const layout=await grid.locator('.homeProductCard').evaluateAll(cards=>cards.map(card=>{
    const rect=el=>el?.getBoundingClientRect().toJSON();
    return {card:rect(card),button:rect(card.querySelector('.homeCardAdd')),price:rect(card.querySelector('.homeCardPrices')),current:rect(card.querySelector('.homeCardPrices strong')),sales:rect(card.querySelector('.homeCardSales')),stock:rect(card.querySelector('.cardStockLine'))};
   }));
   const intersects=(a,b)=>a&&b&&a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
   for(const item of layout){
    assert.equal(item.button.width,width>=768?48:44);
    assert.equal(item.button.height,width>=768?48:44);
    assert(Math.abs(item.card.right-item.button.right-(layout[0].card.right-layout[0].button.right))<1);
    if(width>=768){
     assert(Math.abs(item.card.right-item.button.right-13)<1);
     assert(Math.abs((item.button.top+item.button.bottom)/2-(item.price.top+item.price.bottom)/2)<1);
     if(item.stock)assert(Math.abs(item.card.bottom-item.stock.bottom-12)<1);
     const row=layout.filter(x=>Math.abs(x.card.top-item.card.top)<1);
     assert(row.every(x=>Math.abs(x.card.bottom-item.card.bottom)<1));
    }
    else {
     assert(Math.abs((item.button.top+item.button.bottom)/2-(item.current.top+item.current.bottom)/2)<1);
     const gap=item.sales.top-item.current.bottom;
     assert(gap>=0);
     if(item.stock)assert(item.stock.top>=item.sales.bottom);
    }
    if(width>=768)assert(!intersects(item.button,item.price)&&!intersects(item.button,item.sales)&&!intersects(item.button,item.stock));
   }
   if(width<768){
    const original=await fs.readFile('catalog-card.css','utf8');
    const baseline=original.split('/* Desktop: keep the purchase action')[0];
    const before=await grid.locator('.homeProductCard').evaluateAll(nodes=>nodes.map(n=>({height:n.offsetHeight,width:n.offsetWidth,pad:getComputedStyle(n.querySelector('.pad')).gridTemplateRows})));
    const sheet=page.locator('link[href*="catalog-card.css"]');
    await sheet.evaluate(n=>n.disabled=true);
    const temporary=await page.addStyleTag({content:baseline});
    const after=await grid.locator('.homeProductCard').evaluateAll(nodes=>nodes.map(n=>({height:n.offsetHeight,width:n.offsetWidth,pad:getComputedStyle(n.querySelector('.pad')).gridTemplateRows})));
    assert.deepEqual(after,before,'Desktop change altered mobile geometry');
    await temporary.evaluate(n=>n.remove());await sheet.evaluate(n=>n.disabled=false);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390){
    const output=path.resolve('../../outputs/mobil-qiymet-setri');
    await fs.mkdir(output,{recursive:true});
    await grid.evaluate(node=>scrollBy(0,node.getBoundingClientRect().top-155));
    await page.screenshot({path:path.join(output,route==='/'?'sintetik-ana-sehife.png':'sintetik-mehsullar.png')});
   }
   if(width>=1024){
    for(const id of ['spotify','capcut','netflix']){
     const box=card(id),button=box.locator('.homeCardAdd'),initial=await button.boundingBox();
     await box.locator('.homeCardImageLink').hover();
     const expanded=await button.boundingBox();
     assert.equal(expanded.width,116);
     assert.equal(expanded.height,48);
     assert(Math.abs(expanded.x+expanded.width-initial.x-initial.width)<1);
     const price=await box.locator('.homeCardPrices').boundingBox();
     assert(price.x+price.width<=expanded.x);
     await button.focus();
     assert.equal((await button.boundingBox()).width,116);
     await button.hover();
     assert.equal(await button.evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(255, 212, 0)');
     await page.mouse.move(0,0);
    }
   }
   console.log((live?'LIVE ':'LOCAL ')+width+'px '+route+': compact cards, aligned price actions, hover and focus');
  }finally{await context.close();}
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
