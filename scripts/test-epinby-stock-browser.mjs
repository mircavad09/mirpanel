import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {inventoryAvailability} from '../inventory-availability.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const product={id:'pubg_mobile',title:'PUBG Mobile',active:true,plans:[{label:'60 UC',price:1.65},{label:'325 UC',price:8}]};
let status='available',quoteReads=0;const publicRows=()=>[inventoryAvailability(product,{scope:'none',plans:product.plans.map((_,i)=>({planKey:String(i),supplierStock:{provider:'epinby',status:i===1&&status!=='all-out'?'available':status==='all-out'?'out':status,count:status==='out'||status==='all-out'?0:null,checkedAt:new Date().toISOString(),intervalMs:60000}}))})];
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),json=data=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(u.pathname==='/api/payments/inventory')return json({products:publicRows()});
 if(u.pathname==='/api/payments/shop/quote'){quoteReads++;let b='';for await(const c of req)b+=c;const items=JSON.parse(b).items.map(x=>{const p=publicRows()[0].plans[x.planIndex];return {...x,title:product.title,planName:product.plans[x.planIndex].label,unitCents:165,oldUnitCents:300,available:p.available,supplierStock:p.supplierStock,termsMissing:false};});return json({items,totalCents:items.reduce((n,x)=>n+x.quantity*x.unitCents,0),balanceCents:10000});}
 if(u.pathname.startsWith('/api/'))return json({items:[],products:[]});
 if(u.pathname==='/'||u.pathname==='/mehsul/pubg-mobile'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><style>body{background:#0b0b0b;color:#fff;font:15px system-ui}main{max-width:700px;margin:30px auto}.homeProductCard,.pp-plan-label{border:1px solid #555;padding:14px;margin:12px}.pp-plan-label[aria-disabled=true]{opacity:.65}[hidden]{display:none}button{padding:12px}.out{color:#f99}.unknown{color:#ffd400}</style><body class="home-page"><main><div id="homePageView"><div id="grid"><article class="homeProductCard" data-product-id="pubg_mobile"><div class="imgWrap"></div><div class="pad"><h2>PUBG Mobile</h2><strong>1,65 ₼</strong><button class="homeCardAdd">+</button></div></article></div></div><div id="productPageView"><h2>PUBG Mobile</h2><span class="product-page-status"></span><div id="pp-plans-container">${product.plans.map(p=>'<div class="pp-plan-label" role="radio"><b>'+p.label+'</b><div class="pp-plan-meta"><span data-plan-stock></span></div></div>').join('')}</div><button id="pp-order-btn">İndi al</button></div><button id="cart">Səbəti aç</button></main><script>const DATA={products:[${JSON.stringify(product)}]};let currentProduct=DATA.products[0],currentPlanIdx=0;window.MIRPANEL_PAYMENT_API=location.origin;document.querySelectorAll('.pp-plan-label').forEach((row,i)=>row.onclick=()=>{currentPlanIdx=i;});document.querySelector('#cart').onclick=()=>MirpanelCart.open();</script><script src="/cart-store.js"></script><script src="/stock-display-fix.js"></script>`);
 }
 const file=u.pathname.slice(1);if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'image/png'});res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,out='outputs/epinby-stock';fs.mkdirSync(out,{recursive:true});
try{for(const [name,engine]of [['chrome',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{headless:true});
 try{for(const width of [390,1440]){
  status='available';quoteReads=0;const ctx=await browser.newContext({viewport:{width,height:900}}),p=await ctx.newPage();p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  // Accelerated UI polling only; the real server interval is tested separately.
  await p.addInitScript(()=>{const interval=window.setInterval;window.setInterval=(f,ms,...args)=>interval(f,ms===15000?250:ms,...args);localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{productId:'pubg_mobile',planIndex:0,quantity:1,termsVersion:'synthetic'}]));});
  await p.goto(origin+'/mehsul/pubg-mobile');await p.waitForFunction(()=>window.MirpanelInventory?.planState(currentProduct,0)?.canOrder===true);
  assert.equal(await p.locator('[data-plan-stock]').first().isVisible(),false,'no fabricated count for infinite supplier stock');
  status='out';await p.waitForFunction(()=>document.querySelector('.pp-plan-label').getAttribute('aria-disabled')==='true');
assert.equal(await p.locator('.pp-plan-label [data-inventory-plan]').first().innerText(),'Stokda bitib');assert.equal(await p.locator('#grid .cardStockBadge').innerText(),'Stokda bitib');
  assert.equal(await p.locator('#pp-order-btn').isDisabled(),false,'other package remains purchasable');assert.equal(await p.evaluate(()=>currentPlanIdx),1);
  await p.screenshot({path:out+'/'+name+'-out-'+width+'.png'});
  await p.locator('#cart').click();const cart=p.locator('.mir-cart-drawer[open]'),next=cart.locator('.mir-cart-next');await cart.getByText('Stokda bitib',{exact:true}).waitFor();assert(await next.isDisabled());
  status='unknown';await cart.getByText('Stok yoxlanıla bilmir',{exact:true}).waitFor();assert(await next.isDisabled());await cart.getByRole('button',{name:'Yenidən yoxla',exact:true}).waitFor();
  status='available';await p.waitForFunction(()=>!document.querySelector('.mir-cart-next').disabled);assert.equal(await cart.getByText('Stokda bitib',{exact:true}).count(),0);
  await cart.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await cart.waitFor({state:'detached'});await p.waitForFunction(()=>document.querySelector('.pp-plan-label').getAttribute('aria-disabled')==='false');
  status='all-out';await p.waitForFunction(()=>document.querySelector('#pp-order-btn').disabled);assert.equal(await p.locator('.product-page-status').innerText(),'Stokda bitib');
  status='available';await p.waitForFunction(()=>!document.querySelector('#pp-order-btn').disabled);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS',name,width,'automatic UI recovery, exact starting package, all out, unknown != out, cart blocked/recovered, no invented count; synthetic polling');await ctx.close();
 }}finally{await browser.close();}
}}finally{server.close();}
