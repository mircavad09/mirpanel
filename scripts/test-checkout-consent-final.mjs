import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest as paymentPage} from '../functions/odenis/epoint/[[path]].js';
const output='payment-test-artifacts/consent-final';fs.mkdirSync(output,{recursive:true});
const liveAssets=new Map();
if(process.argv.includes('--live-assets')){
 for(const name of ['shop-ui.js','product-payment.js','epoint-payment.js','epoint-wallet.js','shop.css','checkout-consent.js']){
  const url='/community-assets/'+name,r=await fetch('https://mirpanel.com'+url+'?verify='+Date.now(),{cache:'no-store'});assert.equal(r.status,200,url);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.toString().replaceAll('\r\n','\n'),fs.readFileSync('mirpanel-admin/community/public/'+name,'utf8').replaceAll('\r\n','\n'),url+' deployed code');liveAssets.set(url,bytes);
 }
 console.log('Live client files match release; all payment endpoints below are isolated fixtures.');
}
const names={card:'Bank kartı — Visa / Mastercard','apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'},records=new Map();let posts=0,checks=0;
const item={productId:'ordinary',planIndex:0,quantity:1,termsVersion:'synthetic',title:'Uzun məhsul adı — yalnız izolyasiya edilmiş sınaq',planName:'1 aylıq paket',unitCents:599,available:null,fields:[],image:'/assets/capcut.png'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1'),p=u.pathname,json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(liveAssets.has(p)){res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/css');return res.end(liveAssets.get(p));}
 if(p==='/api/payments/storefront')return json({completedOrders:1624});
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
 if(p==='/api/payments/storefront')return json({completedOrders:1624});
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
 try{for(const width of [320,390,430,1440]){
 const ctx=await browser.newContext({viewport:{width,height:850}}),page=await ctx.newPage();page.setDefaultTimeout(10000);
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({contentType:'text/html',body:'<h1>Isolated provider</h1>'}));
 page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));const before=posts;await page.goto(origin+'/odenis');await page.locator('input[value=card]').waitFor();await page.locator('input[value=card]').check();
 const accept=page.locator('.checkout-consent input'),go=page.locator('.checkout-final-submit'),warning=page.locator('.checkout-consent-warning');
 await page.locator('.checkout-trust p').filter({hasText:'tamamlanmış sifariş'}).waitFor();assert.match(await page.locator('.checkout-trust').innerText(),/1[.,\s]?624 tamamlanmış sifariş/);checks++;assert.equal(await accept.isChecked(),false);assert.equal(await go.isEnabled(),true);assert.equal(await warning.isVisible(),false);checks+=3;
 assert.equal(await page.locator('.checkout-submit-arrow').count(),1);assert.match(await page.locator('.checkout-method-explanation').innerText(),/Visa · Mastercard/);checks+=2;
 await go.scrollIntoViewIfNeeded();if(engine==='chrome'&&width===390)await page.screenshot({path:output+'/before-390.png',fullPage:true});
 await go.click();assert.equal(posts,before);assert.equal(await warning.isVisible(),true);assert.match(await page.locator('.checkout-consent').getAttribute('class'),/required/);assert.equal(await accept.evaluate(n=>n===document.activeElement),true);checks+=4;
 if(engine==='chrome'&&width===390)await page.screenshot({path:output+'/warning-390.png',fullPage:true});
 for(const [title,anchor]of [['Ödəniş qaydalarını','4'],['geri qaytarma şərtlərini','6'],['məsuliyyət hədlərini','8']]){const link=page.getByRole('link',{name:title,exact:true});assert.equal(await link.getAttribute('href'),'/sertler#sertler-'+anchor);const popup=page.waitForEvent('popup');await link.click();const opened=await popup;await opened.close();assert.equal(await accept.isChecked(),false);checks+=2;}
 await accept.check();assert.equal(await warning.isVisible(),false);assert.doesNotMatch(await page.locator('.checkout-consent').getAttribute('class'),/required/);assert.equal(posts,before);checks+=3;
 if(engine==='chrome'&&width===390)await page.screenshot({path:output+'/accepted-390.png',fullPage:true});
 await page.locator('.checkout-other-toggle').click();await page.locator('input[value=birbank]').check();assert.doesNotMatch(await page.locator('.checkout-method-explanation').innerText(),/Visa|Mastercard/);assert.match(await page.locator('.checkout-method-explanation').innerText(),/Birbank/);checks+=2;await page.locator('input[value=card]').check();
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await go.evaluate(n=>getComputedStyle(n,'::before').animationName),'none');checks++;await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route('**/api/payments/shop/epoint',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic server failure'})}),{times:1});
 await go.evaluate(b=>{b.click();b.click();});await page.getByText('Synthetic server failure',{exact:true}).waitFor();assert.equal(await go.isEnabled(),true);assert.equal(await accept.isChecked(),true);assert.equal(posts,before);checks+=3;
 await page.unroute('**/api/payments/shop/epoint');await page.route('**/api/payments/shop/epoint',async r=>{await new Promise(resolve=>setTimeout(resolve,300));await r.continue();});
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));const box=await go.boundingBox();assert.ok(box.y+box.height<850-90);checks++;
 await go.evaluate(b=>{b.click();b.click();});await page.getByRole('button',{name:'Ödəniş açılır…',exact:true}).waitFor();assert.equal(await go.isDisabled(),true);checks++;await page.waitForURL('https://epoint.az/isolated-wallet');assert.equal(posts,before+1);checks++;
 console.log(JSON.stringify({engine,width,checks}));await ctx.close();
 }}finally{await browser.close();}
}console.log(JSON.stringify({checks,realPayments:0,realOrders:0,physicalDevice:false}));}finally{await new Promise(r=>server.close(r));}
