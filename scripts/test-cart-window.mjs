import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const products=extractAdminState(fs.readFileSync('app.js','utf8')).products;
const names=['Netflix Şəxsi','Amazon Prime Video','CapCut Pro','Spotify Premium','Zoom Pro'];
const items=names.map((title,i)=>({id:'test'+i,title,image:products.find(p=>p.title===title)?.image||products[i].image,plans:[{label:i===0?'1 ay — uzun paket adı, şəxsi profil və zəmanət':'1 ay',price:i===0?5.99:4.99,regularPrice:i===0?25:9.98}]}));
const out='outputs/cart-window';fs.mkdirSync(out,{recursive:true});let quoteFail=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(u.pathname==='/api/payments/shop/quote'){
  let text='';for await(const b of req)text+=b;
  if(quoteFail)return json(503,{error:'Synthetic unavailable'});
  const rows=JSON.parse(text).items.map(x=>{const p=items.find(p=>p.id===x.productId),plan=p.plans[x.planIndex];return {...x,title:p.title,planName:plan.label,image:p.image,unitCents:Math.round(plan.price*100),standardCents:Math.round(plan.price*100),oldUnitCents:plan.regularPrice==null?null:Math.round(plan.regularPrice*100),available:3,termsMissing:false};});
  return json(200,{items:rows,totalCents:rows.reduce((n,x)=>n+x.unitCents*x.quantity,0),balanceCents:10000});
 }
 if(u.pathname==='/api/payments/storefront')return json(200,{products:items.map(p=>({...p,path:'/mehsul/'+p.id,priceCents:Math.round(p.plans[0].price*100)}))});
 if(u.pathname.startsWith('/api/'))return json(200,{});
 if(u.pathname==='/odenis'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<h1>Sintetik ödəniş mərhələsi</h1>');}
 if(u.pathname==='/'||u.pathname.startsWith('/mehsul/')){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d1013;color:white;font:15px system-ui}header{padding:24px;background:#191d20}main{padding:20px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}article{background:#232525;border-radius:14px;overflow:hidden}article img{width:100%}h2{font-size:16px;padding:8px}.browser-bottom-nav{position:fixed;bottom:0;height:60px;background:#20221b;width:100%;display:flex;align-items:center;justify-content:space-around}@media(min-width:700px){main{grid-template-columns:repeat(5,1fr)}.browser-bottom-nav{display:none}}</style><header>MIRPANEL · <a id="cartHeaderLink" href="/sebet">Səbət</a></header><main>${items.map(p=>'<article><img src="'+p.image+'"><h2>'+p.title+'</h2></article>').join('')}</main><nav class="browser-bottom-nav">Ana səhifə　Məhsullar　Balans　Səbət　Profilim</nav><script>const DATA=${JSON.stringify({products:items})};</script><script src="/cart-store.js"></script>`);
 }
 const file=decodeURIComponent(u.pathname.slice(1));if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'image/png'});res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const results=[];
try{
 for(const engine of ['chromium','webkit']){
  const browser=await (engine==='chromium'?chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}):webkit.launch({headless:true}));
  try{for(const width of (process.env.CART_TEST_WIDTHS||'320,390,430,1440').split(',').map(Number)){
   console.log('START',engine,width);
   const ctx=await browser.newContext({viewport:{width,height:width===1440?950:844}}),page=await ctx.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'test0',planIndex:0,quantity:1,termsVersion:'test'},{productId:'test1',planIndex:0,quantity:1,termsVersion:'test'}])));
   await page.goto(origin);await page.locator('#cartHeaderLink').click();const dialog=page.locator('.mir-cart-drawer[open]'),next=dialog.locator('.mir-cart-next');await next.waitFor();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
   assert.equal(new URL(page.url()).pathname,'/');assert.match(await dialog.locator('.mir-cart-savings').innerText(),/24,00/);assert.match(await dialog.locator('.mir-cart-sum').innerText(),/10,98/);
   const rect=await dialog.evaluate(d=>{const r=d.getBoundingClientRect(),b=d.querySelector('.mir-cart-body'),f=d.querySelector('footer').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:d.scrollWidth>d.clientWidth,bodyScroll:b.scrollHeight>b.clientHeight,footerBottom:f.bottom,width:innerWidth,height:innerHeight};});
   assert(rect.left>=10&&rect.right<=width-10&&rect.top>0&&rect.bottom<rect.height-(width<700?60:0));assert(!rect.overflow);assert(rect.footerBottom<=rect.bottom);
   await dialog.getByRole('button',{name:'Artır: Netflix Şəxsi',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);assert.match(await dialog.locator('.mir-cart-sum').innerText(),/16,97/);assert.match(await dialog.locator('.mir-cart-savings').innerText(),/43,01/);
   await dialog.getByRole('button',{name:'Artır: Netflix Şəxsi',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);assert(await dialog.getByRole('button',{name:'Artır: Netflix Şəxsi',exact:true}).isDisabled());
   await dialog.getByRole('button',{name:'Azalt: Netflix Şəxsi',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
   await page.screenshot({path:out+'/'+engine+'-'+width+'.png'});
   await dialog.locator('.mir-cart-body').evaluate(b=>b.scrollTop=b.scrollHeight);assert(await next.isVisible());await dialog.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await page.locator('.mir-cart-drawer').waitFor({state:'detached'});assert.equal(new URL(page.url()).pathname,'/');
   await page.locator('#cartHeaderLink').click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await next.locator('svg').evaluate(x=>getComputedStyle(x).animationName),'none');
   const recommendation=dialog.locator('.mir-cart-offer').first();await recommendation.click();await page.waitForURL('**/mehsul/test2');
   // Add through the same real cart API used after product/package selection.
   await page.evaluate(()=>MirpanelCart.commitDraft({draftId:crypto.randomUUID(),termsVersion:'test'},{productId:'test2',planIndex:0,quantity:1}));await page.locator('#cartHeaderLink').click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);assert.equal(await dialog.locator('[data-cart-product=test2]').count(),1);
   await next.click();await page.waitForURL('**/odenis');assert.match(await page.locator('h1').innerText(),/Sintetik/);
   await page.goto(origin);await page.evaluate(()=>{for(const x of MirpanelCart.read())MirpanelCart.set(x.productId,x.planIndex,0);});await page.locator('#cartHeaderLink').click();assert.match(await dialog.locator('.mir-cart-empty').innerText(),/boşdur/);assert(await next.isDisabled());assert(await dialog.locator('.mir-cart-savings').isHidden());
   await dialog.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await page.evaluate(()=>MirpanelCart.commitDraft({draftId:crypto.randomUUID(),termsVersion:'test'},{productId:'test0',planIndex:0,quantity:1}));quoteFail=true;await page.locator('#cartHeaderLink').click();await dialog.getByRole('button',{name:'Yenidən yoxla',exact:true}).waitFor();assert(await next.isDisabled());quoteFail=false;await dialog.getByRole('button',{name:'Yenidən yoxla',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
   await page.setViewportSize({width,height:600});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
   assert(await dialog.locator('.mir-cart-body').evaluate(b=>b.scrollHeight>b.clientHeight));
   const bounds=await dialog.evaluate(d=>({bottom:d.getBoundingClientRect().bottom,footer:d.querySelector('footer').getBoundingClientRect().bottom}));assert(bounds.bottom<600-(width<700?60:0)&&bounds.footer<=bounds.bottom);
   const old=items[0].plans[0].regularPrice;items[0].plans[0].regularPrice=null;
   await dialog.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await page.locator('.mir-cart-drawer').waitFor({state:'detached'});await page.locator('#cartHeaderLink').click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);
   assert.equal(await dialog.locator('.mir-cart-savings').innerText(),'Səbətin səni gözləyir');items[0].plans[0].regularPrice=old;
   assert.deepEqual(errors,[]);results.push({engine,width,status:'passed',rect});console.log('PASS',engine,width);await ctx.close();
  }}finally{await browser.close();}
 }
 console.log(JSON.stringify(results,null,2));fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
}finally{server.close();}
