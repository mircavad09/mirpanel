import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest as paymentPage} from '../functions/odenis/epoint/[[path]].js';
const output='payment-test-artifacts/payment-choice-groups';fs.mkdirSync(output,{recursive:true});
const liveAssets=new Map();
if(process.argv.includes('--live-assets')){
 for(const name of ['shop-ui.js','product-payment.js','epoint-payment.js','epoint-wallet.js','shop.css']){
  const url='/community-assets/'+name,r=await fetch('https://mirpanel.com'+url+'?verify='+Date.now(),{cache:'no-store'});assert.equal(r.status,200,url);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.toString().replaceAll('\r\n','\n'),fs.readFileSync('mirpanel-admin/community/public/'+name,'utf8').replaceAll('\r\n','\n'),url+' deployed code');liveAssets.set(url,bytes);
 }
 console.log('Live client files match release; all payment endpoints below are isolated fixtures.');
}
const names={card:'Bank kartı — Visa / Mastercard','apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'},records=new Map();let posts=0,checks=0;
const item={productId:'ordinary',planIndex:0,quantity:1,termsVersion:'synthetic',title:'Uzun məhsul adı — yalnız izolyasiya edilmiş sınaq',planName:'1 aylıq paket',unitCents:599,available:null,fields:[],image:'/assets/capcut.png'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname,json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(liveAssets.has(p)){res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/css');return res.end(liveAssets.get(p));}
 if(p==='/api/community/state')return json({profile:{id:'a',user_id:'a',emailVerified:true,display_name:'İzolə sınaq'}});
 if(p==='/api/payments/shop/quote')return json({items:[{...item,...(req.headers['x-fixture-invalid']==='details'?{detailsMissing:true}:req.headers['x-fixture-invalid']==='stock'?{available:0}:{})}],totalCents:599,balanceCents:Number(req.headers['x-fixture-balance']||0)});
 if(p==='/api/payments/epoint/status'&&!u.search)return json({purchaseMethods:Object.fromEntries(Object.keys(names).map(m=>[m,m!=='m10'||req.headers['x-fixture-method']==='m10']))});
 if(p==='/api/payments/shop/epoint'){
  posts++;let raw='';for await(const b of req)raw+=b;const b=JSON.parse(raw);assert.equal(b.expectedTotalCents,599);assert.equal(b.mode,'epoint');assert.equal(b.consentAccepted,true);assert.ok(names[b.epointMethod]);
  if(!records.has(b.requestId))records.set(b.requestId,{purpose:'purchase',status:'pending',state:'ready',method:b.epointMethod,cents:599,checkoutId:b.requestId});
  return json({id:b.requestId,paymentUrl:'/odenis/epoint/odeme?ref='+b.requestId});
 }
 if(p==='/api/payments/epoint/checkout'){
  const row=records.get(u.searchParams.get('ref'));assert.ok(row);return json({...row,...(row.method.endsWith('-pay')?{widget:'https://epoint.az/isolated-widget'}:{redirect:'https://epoint.az/isolated-wallet'})});
 }
 if(p.startsWith('/api/'))return json({});
 if(p==='/cart-ready.js'){res.setHeader('Content-Type','text/javascript');return res.end('export async function ensureCart(){}');}
 if(p==='/odenis'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page"><main id="shopApp" class="shop-page"></main><script>const items='+JSON.stringify([item])+';window.MirpanelCart={checkout:()=>items,read:()=>items,clearPaid(){},previewRows:()=>items};</script><script type="module" src="/community-assets/shop-ui.js"></script></body></html>');
 }
 if(p.startsWith('/odenis/epoint/')){const r=paymentPage({request:new Request(u)});res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());}
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file));
 }catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of ['chrome','webkit']){
 const browser=await(engine==='chrome'?chromium:webkit).launch({headless:true,executablePath:engine==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});
 try{for(const width of [320,390,430,1440])for(const method of Object.keys(names)){
  console.log(JSON.stringify({engine,width,method}));
  const ctx=await browser.newContext({viewport:{width,height:850},extraHTTPHeaders:{'x-fixture-method':method},userAgent:method==='apple-pay'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1':method==='google-pay'?'Mozilla/5.0 (Linux; Android 14) Chrome/140.0':'Mozilla/5.0 Windows Chrome/140.0'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await ctx.addInitScript(()=>{window.ApplePaySession={canMakePayments:()=>true};window.PaymentRequest=class{canMakePayment(){return Promise.resolve(true);}};});
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();if(u.origin==='https://epoint.az')return route.fulfill({contentType:'text/html',body:'<h1>İzolə edilmiş ödəniş ekranı</h1>'});return route.abort();});
  const before=posts,size=records.size;await page.goto(origin+'/odenis');const tile=page.locator('input[name="paymentMode"][value="'+method+'"]');await tile.waitFor({state:'attached'});if(['google-pay','birbank','m10'].includes(method))await page.getByText('Digər ödənişlər',{exact:true}).click();await tile.check();
  assert.equal(posts,before);assert.equal(records.size,size);checks+=2;
  const mainOrder=await page.locator('.checkout-primary-methods input').evaluateAll(nodes=>nodes.map(n=>n.value));assert.deepEqual(mainOrder,method==='apple-pay'?['wallet','card','apple-pay']:['wallet','card']);checks++;
  const heights=await page.locator('.checkout-primary-methods .checkout-tile').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert.equal(new Set(heights).size,1);checks++;assert.equal(await page.locator('input[value=transfer]').isDisabled(),true);assert.equal(await page.locator('input[value=bank-account]').isDisabled(),true);assert.equal(await page.locator('input[value=apple-pay]').count(),method==='apple-pay'?1:0);assert.equal(await page.locator('input[value=m10]').isDisabled(),method!=='m10');assert.equal(await page.getByText('Portmanat',{exact:true}).count(),0);checks+=5;
  assert.equal(await page.locator('.checkout-shortfall').isVisible(),false);checks++;
  assert.equal(await page.getByRole('button',{name:'Sifarişi tamamla · 5,99 ₼',exact:true}).isDisabled(),true);checks++;
  await page.locator('.checkout-consent input').check();const go=page.getByRole('button',{name:'Sifarişi tamamla · 5,99 ₼',exact:true});
  assert.equal(await page.locator('dialog').count(),0);checks++;
  if(engine==='chrome'&&method==='card'&&[390,1440].includes(width))await page.screenshot({path:output+'/selection-'+width+'.png',fullPage:true});
  await go.evaluate(b=>{b.click();b.click();});
  if(method.endsWith('-pay')){await page.locator('iframe').waitFor();assert.match(await page.locator('h1').textContent(),/sifariş ödənişi/);assert.match(await page.locator('[data-apple-amount]').textContent(),/5,99/);checks+=2;}
  else await page.waitForURL('https://epoint.az/isolated-wallet');
  assert.equal(posts,before+1);assert.equal(records.size,size+1);assert.deepEqual(errors,[]);checks+=3;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks++;
  await ctx.close();
 }
 for(const invalid of ['none','details','stock']){
  const ctx=await browser.newContext({viewport:{width:390,height:850},extraHTTPHeaders:{'x-fixture-balance':'12345678','x-fixture-invalid':invalid}}),page=await ctx.newPage();
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const before=posts;await page.goto(origin+'/odenis');await page.locator('input[value=card]').waitFor();
  assert.match(await page.locator('label:has(input[value=wallet])').innerText(),/123[\s.,]?456,78/);checks++;
  assert.equal(await page.locator('input[value=wallet]').isChecked(),true);checks++;
  await page.locator('.checkout-consent input').check();
  assert.equal(await page.getByRole('button',{name:'Sifarişi tamamla · 5,99 ₼',exact:true}).isEnabled(),invalid==='none');checks++;
  assert.equal(posts,before);checks++;await ctx.close();
 }
 }finally{await browser.close();}
}console.log(JSON.stringify({checks,engines:['Chrome','WebKit'],widths:[320,390,430,1440],deviceTests:'emulated capabilities only',realProviderCalls:0,realPayments:0}));
}finally{await new Promise(r=>server.close(r));}
