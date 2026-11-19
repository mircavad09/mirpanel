import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const {chromium,webkit}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const real=extractAdminState(fs.readFileSync('app.js','utf8')).products;
const products=['prime','netflix','spotify','capcut','zoom'].map((id,i)=>({...real.find(p=>p.id===id)||real[i],id,plans:[{price:i?5.99:2.89,regularPrice:18,label:'1 ay'}]}));
const out='outputs/cart-holiday';fs.mkdirSync(out,{recursive:true});
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),json=data=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(u.pathname==='/api/payments/shop/quote'){let body='';for await(const b of req)body+=b;const items=JSON.parse(body).items.map(x=>{const p=products.find(p=>p.id===x.productId);return {...x,title:p.title,image:p.image,planName:'1 ay',unitCents:Math.round(p.plans[0].price*100),oldUnitCents:1800,available:5,termsMissing:false};});return json({items,totalCents:items.reduce((n,x)=>n+x.quantity*x.unitCents,0),balanceCents:10000});}
 if(u.pathname==='/api/payments/storefront')return json({products:products.map(p=>({...p,priceCents:Math.round(p.plans[0].price*100),path:'/mehsul/'+p.id,from:true}))});
 if(u.pathname.startsWith('/api/'))return json({items:[]});
 if(u.pathname==='/odenis'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<h1>Sintetik ödəniş</h1>');}
 if(u.pathname==='/'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:2000px;background:#0b0b0b;color:white;font:16px system-ui}header{padding:22px;background:#171717}main{padding:20px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}article{background:#151515;border-radius:14px;overflow:hidden}img{width:100%}h2{font-size:15px;padding:10px}nav{position:fixed;bottom:0;background:#171717;width:100%;padding:18px;box-sizing:border-box}</style><header>MIRPANEL</header><main>${products.map(p=>'<article><img src="/'+p.image+'"><h2>'+p.title+'</h2></article>').join('')}</main><nav>Ana səhifə　Məhsullar　Balans　Səbət</nav><script>const DATA=${JSON.stringify({products})};</script><script src="/cart-store.js"></script>`);
 }
 const file=decodeURIComponent(u.pathname.slice(1));if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'image/png'});res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,results=[];
try{for(const [engine,launcher] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await launcher.launch(engine==='chrome'?{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{headless:true});
 try{for(const width of [320,390,430,1440]){
  const ctx=await browser.newContext({viewport:{width,height:width<700?620:900}}),page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'prime',planIndex:0,quantity:1,termsVersion:'synthetic'}])));
  await page.goto(origin);await page.evaluate(()=>{scrollTo(0,120);MirpanelCart.open();});const dialog=page.locator('dialog.mir-cart-drawer');await page.waitForFunction(()=>!document.querySelector('.mir-cart-next')?.disabled);await dialog.locator('.mir-cart-suggestion').first().waitFor();await page.waitForTimeout(200);
  const decor=dialog.locator('.mir-cart-festive');assert.equal(await decor.getAttribute('aria-hidden'),'true');assert(await decor.evaluate(x=>x.inert&&getComputedStyle(x).pointerEvents==='none'));assert.equal(await dialog.evaluate(d=>getComputedStyle(d).backgroundColor),'rgb(0, 0, 0)');
  assert.equal(await dialog.locator('.mir-cart-lights i').count(),36);assert(await dialog.locator('.mir-cart-hat').isVisible());
  const prices=await dialog.locator('.mir-cart-suggestion .mir-cart-info>b').allTextContents();assert(prices.every(x=>/^\d+,\d{2} ₼$/.test(x)));assert.equal(prices[0],'5,99 ₼');
  const close=dialog.getByRole('button',{name:'Səbəti bağla',exact:true}),next=dialog.getByRole('button',{name:'Ödənişə keç',exact:true});
  for(const target of [close,next,dialog.getByRole('button',{name:'Artır: Amazon Prime Video',exact:true})]){
   assert(await target.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);}));
  }
  const initial=await dialog.boundingBox();await page.screenshot({path:out+'/'+engine+'-'+width+'.png'});
  await dialog.getByRole('button',{name:'Artır: Amazon Prime Video',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);assert.match(await dialog.locator('.mir-cart-sum').innerText(),/5,78/);assert.match(await dialog.locator('.mir-cart-savings').innerText(),/30,22/);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await dialog.locator('.mir-cart-lights i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.setViewportSize({width,height:480});await page.waitForTimeout(100);const short=await dialog.boundingBox();assert(short.y>=20&&short.y+short.height<=460);assert(await dialog.locator('.mir-cart-body').evaluate(el=>el.scrollHeight>el.clientHeight));
  await close.click();await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>scrollY),120);
  await page.evaluate(()=>MirpanelCart.open());await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);await next.click();await page.waitForURL('**/odenis');
  await page.goto(origin);await page.evaluate(()=>MirpanelCart.open());await page.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);await dialog.getByRole('button',{name:'Sil: Amazon Prime Video',exact:true}).click();assert.match(await dialog.locator('.mir-cart-empty').innerText(),/boşdur/);
  assert.deepEqual(errors,[]);results.push({engine,width,initial,short,prices,status:'passed'});console.log('PASS',engine,width);await ctx.close();
 }}finally{await browser.close();}
}fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log('PASS holiday trim, hit testing, reduced motion, bare prices, quantity/savings/remove/checkout; no real transactions');
}finally{server.close();}
