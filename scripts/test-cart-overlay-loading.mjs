// Local-only server responses. No provider, order or payment endpoint is called.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='payment-test-artifacts/cart-overlay';fs.mkdirSync(out,{recursive:true});let mode='fast',writes=0,checks=0;
const server=http.createServer(async(req,res)=>{
 const p=new URL(req.url,'http://local').pathname,json=(x,status=200)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(x));};
 if(p==='/api/payments/shop/quote'){
  let raw='';for await(const c of req)raw+=c;const items=JSON.parse(raw).items,scenario=mode,n=items[0]?.quantity;
  const delay=scenario==='slow'?2800:scenario==='race'?(n===1?3000:700):scenario==='timeout'?14000:30;
  await new Promise(r=>setTimeout(r,delay));
  if(scenario==='error')return json({error:'Fixture unavailable'},503);
  return json({items:items.map(x=>({...x,title:'Netflix Şəxsi',planName:'1 ay',unitCents:599,standardCents:599,available:scenario==='race'&&n===1?0:5})),totalCents:items.reduce((a,x)=>a+599*x.quantity,0),balanceCents:5000});
 }
 if(p==='/api/payments/shop/drafts')return json({items:[]});
 if(p==='/api/payments/storefront')return json({products:[]});
 if(req.method!=='GET'){writes++;return json({error:'Forbidden write'},405);}
 if(p.startsWith('/api/'))return json({});
 if(p==='/test'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;background:#090909;color:white;font:16px system-ui}main{padding:20px;height:1500px}</style><main>MIRPANEL · İzolyasiya edilmiş sınaq<button id="open" onclick="MirpanelCart.open()">Səbəti aç</button></main><script>const DATA={products:[{id:"test",title:"Netflix Şəxsi",plans:[{label:"1 ay",price:5.99}]}]};localStorage.setItem("mirpanel.cart.v1",JSON.stringify([{productId:"test",planIndex:0,quantity:1,lineId:"test-line"}]));</script><script src="/cart-store.js"></script>');}
 const file=p.slice(1);if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'image/png');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{for(const engine of [chromium,webkit]){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){mode='fast';const ctx=await browser.newContext({viewport:{width,height:740}}),page=await ctx.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/test');await page.locator('#open').click();const drawer=page.locator('.mir-cart-drawer');await drawer.locator('.mir-cart-next').waitFor();await page.waitForFunction(()=>!document.querySelector('.mir-cart-drawer').classList.contains('is-quote-busy'));eq(await page.locator('.mir-cart-request-loading').count(),0);
 await page.waitForTimeout(250);const initial=await drawer.locator('header').boundingBox();mode='slow';await drawer.getByRole('button',{name:'Artır: Netflix Şəxsi',exact:true}).click();await page.locator('.mir-cart-request-loading').waitFor();
 eq(await page.locator('.mir-cart-notices').evaluate(n=>!n.closest('.mir-cart-drawer')&&n.parentElement.classList.contains('mir-cart-modal-layer')),true);
 const header=await drawer.locator('header').boundingBox();eq(Math.abs(header.y-initial.y)<1&&Math.abs(header.height-initial.height)<1,true);
 const count=await page.evaluate(()=>MirpanelCart.read()[0].quantity);await drawer.getByRole('button',{name:'Artır: Netflix Şəxsi',exact:true}).click();eq(await page.evaluate(()=>MirpanelCart.read()[0].quantity),count);
 eq(await page.locator('.mir-cart-added').count(),1);eq(await page.locator('.mir-cart-notices').evaluate(n=>Number(getComputedStyle(n).zIndex)>Number(getComputedStyle(document.querySelector('.mir-cart-request-loading')).zIndex)),true);
 await page.screenshot({path:out+'/'+engine.name()+'-'+width+'-loading.png'});await page.locator('.mir-cart-added-close').click();await page.locator('.mir-cart-request-loading').waitFor({state:'detached'});eq(await drawer.isVisible(),true);
 mode='race';await page.evaluate(()=>{MirpanelCart.set('test',0,1);MirpanelCart.set('test',0,3);});await page.locator('.mir-cart-request-loading').waitFor();await page.waitForTimeout(600);eq(await page.locator('.mir-cart-request-loading').count(),1);await page.locator('.mir-cart-request-loading').waitFor({state:'detached'});eq(await drawer.locator('.mir-cart-sum strong').innerText(),'17,97 ₼');eq(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mirpanel.cart.preview.v1')))[0].available),5);
 // Closing the cart leaves the independent notice timers and X usable.
 await drawer.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mir-cart-modal-layer'));eq(await page.locator('.mir-cart-notices').evaluate(n=>n.parentElement===document.body),true);await page.locator('.mir-cart-added-close').first().click();
 mode='error';await page.locator('#open').click();await page.getByText('Qiymət və stoku yoxlamaq mümkün olmadı. Yenidən yoxlayın.',{exact:true}).waitFor();eq(await page.locator('.mir-cart-request-loading').count(),0);eq(await page.locator('.mir-cart-next').isDisabled(),true);
 mode='slow';await page.getByRole('button',{name:'Yenidən yoxla',exact:true}).click();await page.locator('.mir-cart-request-loading').waitFor();await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await page.locator('.mir-cart-request-loading').waitFor({state:'detached'});await page.evaluate(()=>dispatchEvent(new Event('pageshow')));
 await page.getByRole('button',{name:'Yenidən yoxla',exact:true}).click();await page.locator('.mir-cart-request-loading').waitFor();await drawer.getByRole('button',{name:'Səbəti bağla',exact:true}).click();await page.locator('.mir-cart-request-loading').waitFor({state:'detached'});eq(await page.locator('.mir-cart-drawer').count(),0);await page.locator('#open').click();await page.locator('.mir-cart-request-loading').waitFor();await page.locator('.mir-cart-request-loading').waitFor({state:'detached'});
 mode='fast';await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.mir-cart-modal-layer'));await page.locator('#open').click();await page.waitForTimeout(200);await page.mouse.click(3,720);await page.waitForFunction(()=>!document.querySelector('.mir-cart-modal-layer'),{},{timeout:1200});
 eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(errors,[]);await ctx.close();console.log('PASS '+engine.name()+' '+width+': external layer, fixed header, slow/error/abort, parallel & stale responses, cart close/Escape/backdrop, no overflow');
 }
 // Real bounded deadline, not a shortened fake clock.
 mode='timeout';const page=await browser.newPage({viewport:{width:390,height:740}});await page.goto(origin+'/test');await page.locator('#open').click();await page.locator('.mir-cart-request-loading').waitFor();await page.getByText('Sorğu vaxtında tamamlanmadı. Səbətiniz saxlanılıb. Yenidən yoxlayın.',{exact:true}).waitFor({timeout:14000});eq(await page.locator('.mir-cart-request-loading').count(),0);eq(await page.evaluate(()=>MirpanelCart.read()[0].quantity),1);await page.close();
 }finally{await browser.close();}}
 eq(writes,0);console.log(JSON.stringify({checks,financialWrites:writes}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
