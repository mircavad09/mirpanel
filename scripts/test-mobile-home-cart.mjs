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
 for(const width of [320,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:880},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
  try{
   const drafts=[];
   await context.addInitScript(()=>sessionStorage.setItem('mirpanel.intro.seen','1'));
   await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url()),p=u.pathname;
    const json=data=>route.fulfill({json:data});
    if(p==='/api/payments/inventory')return json({products:products.map(product=>({productId:product.id,scope:product.id==='capcut'?'plan':'product',unlimited:true,plans:product.plans.map((_,i)=>({planKey:String(i),available:i?4:0}))}))});
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
   await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
   const grid=page.locator('#grid');
   const card=id=>grid.locator('.homeProductCard[data-product-id="'+id+'"]');
   await card('zoom').locator('.homeCardSales:not([hidden])').waitFor();
   await page.waitForFunction(()=>document.querySelector('#grid [data-product-id="zoom"]')?.hasAttribute('data-cart-available'));
   if(width>=768){
    assert.equal(await card('zoom').locator('.homeCardAdd').isVisible(),false);
    assert.equal(await card('zoom').locator('.homeCardOrder').innerText(),'→');
    continue;
   }
   assert.equal(await card('zoom').locator('.homeCardOrder').isVisible(),false);
   assert.equal(await card('zoom').locator('.homeCardAdd').innerText(),'+');
   const geometry=await grid.evaluate(node=>{
    const rect=e=>e.getBoundingClientRect();
    const rows=[...node.querySelectorAll('.homeProductCard')].slice(0,4).map(card=>{
     const image=rect(card.querySelector('.imgWrap')),title=card.querySelector('h3'),price=rect(card.querySelector('.homeCardPrices strong')),plus=rect(card.querySelector('.homeCardAdd'));
     return {left:rect(card).left,image:image.height,price:price.top-image.bottom,plus:plus.top-image.bottom,hit:Math.min(plus.width,plus.height),titleLines:Math.round(rect(title).height/parseFloat(getComputedStyle(title).lineHeight)),clamp:getComputedStyle(title).webkitLineClamp,sales:getComputedStyle(card.querySelector('.homeCardSales')).color};
    });
    return {rows,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert(!geometry.overflow,JSON.stringify(geometry));
   assert(geometry.rows[1].left>geometry.rows[0].left&&Math.abs(geometry.rows[2].left-geometry.rows[0].left)<1);
   for(const row of geometry.rows){
    assert(row.hit>=44&&row.clamp==='2'&&row.titleLines<=2&&row.sales==='rgb(89, 216, 160)',JSON.stringify({width,row}));
    assert(Math.abs(row.image-geometry.rows[0].image)<1&&Math.abs(row.price-geometry.rows[0].price)<1&&Math.abs(row.plus-geometry.rows[0].plus)<1,JSON.stringify({width,row,baseline:geometry.rows[0]}));
   }
   const long=card('spotify').locator('.title');
   assert((await long.innerText()).length>20);
   assert.equal(await long.evaluate(node=>getComputedStyle(node).webkitLineClamp),'2');
   assert.equal(await card('zoom').locator('.homeCardDiscount').count(),1);
   assert.equal(await grid.getByText('⚡ Anında',{exact:true}).filter({visible:true}).count(),0);
   assert.equal(await card('zoom').getByText('🔥 Ən çox satılan',{exact:true}).isVisible(),true);
   const consent=page.locator('dialog.cart-entry[open]');
   const accept=async()=>{
    await consent.getByText('Sintetik səbət sınağı').waitFor();
    await consent.getByRole('checkbox').check();
    await consent.getByRole('button',{name:'Təsdiqləyirəm'}).click();
    await consent.waitFor({state:'hidden'});
   };
   await card('zoom').locator('.homeCardAdd').click();await accept();
   await page.locator('.mir-cart-drawer[open]').waitFor();
   await page.keyboard.press('Escape');
   assert.deepEqual(drafts,[{productId:'zoom',planIndex:0}]);
   await card('capcut').locator('.homeCardAdd').click();
   const picker=page.getByRole('dialog',{name:'Paket seçin'});
   assert.equal(await picker.locator('button').first().isDisabled(),true);
   await picker.locator('button').nth(1).click();await accept();
   await page.locator('.mir-cart-drawer[open]').waitFor();
   await page.keyboard.press('Escape');
   assert.deepEqual(drafts,[{productId:'zoom',planIndex:0},{productId:'capcut',planIndex:1}]);
   assert.equal(new URL(page.url()).pathname,'/');
   for(const [id,selector] of [['capcut','.homeCardImageLink'],['spotify','.title a']]){
    const target=card(id).locator(selector),href=await target.getAttribute('href');
    await target.click();await page.waitForURL(origin+href);
    await page.goBack();await card('zoom').locator('.homeCardAdd').waitFor();
   }
   console.log((live?'LIVE ':'LOCAL ')+width+'px: compact cards, image and title links, single and multiple plans, exact cart selections');
  }finally{await context.close();}
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
