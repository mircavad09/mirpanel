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
 if(p==='/api/payments/shop/payment-selection'){const row=records.get(u.searchParams.get('id'));return json({id:u.searchParams.get('id'),status:row?.status||'pending',method:row?.method||'card',items:[item],quote:{items:[item],totalCents:599,balanceCents:0},consentAccepted:true});}
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
try{for(const engine of [chromium,webkit]){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:950},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1'}),page=await ctx.newPage();page.setDefaultTimeout(10000);await ctx.addInitScript(()=>window.ApplePaySession={canMakePayments:()=>true});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({contentType:'text/html',body:'<h1>TEST — Provider only</h1>'}));let selected=null;await page.route('**/api/payments/shop/epoint',async r=>{selected=r.request().postDataJSON().epointMethod;await r.fallback();});
 await page.goto(origin+'/odenis');await page.locator('input[value="apple-pay"]').waitFor({state:'attached'});assert.deepEqual(await page.locator('.checkout-primary-methods input').evaluateAll(n=>n.map(x=>x.value)),['wallet','card','apple-pay']);assert.equal(await page.locator('input[value=wallet]').isChecked(),true);await page.locator('.checkout-consent input').check();assert.equal(await page.getByRole('button',{name:'Sifarişi tamamla · 5,99 ₼',exact:true}).isDisabled(),true);await page.locator('input[value="apple-pay"]').check();
 await page.evaluate(()=>{MirpanelCart.read()[0].quantity=2;dispatchEvent(new Event('mirpanel:cart'));});await page.waitForFunction(()=>document.querySelector('input[value="apple-pay"]')?.checked);await page.evaluate(()=>{MirpanelCart.read()[0].quantity=1;dispatchEvent(new Event('mirpanel:cart'));});await page.waitForFunction(()=>document.querySelector('input[value="apple-pay"]')?.checked);await page.locator('.checkout-consent input').check();
 fs.mkdirSync('outputs/incident-13342',{recursive:true});if(engine===chromium)await page.screenshot({path:'outputs/incident-13342/selection-'+width+'.png',fullPage:true});await page.getByRole('button',{name:'Sifarişi tamamla · 5,99 ₼',exact:true}).click();await page.locator('iframe').waitFor();assert.equal(selected,'apple-pay');assert.match(await page.locator('h1').innerText(),/Apple Pay ilə sifariş/);const current=records.get(new URL(page.url()).searchParams.get('ref'));current.status='failed';current.openingExpired=true;await page.getByRole('button',{name:'Yenidən cəhd et'}).click();await page.getByText('Başqa ödəniş üsulu seçə bilərsiniz.',{exact:true}).waitFor();assert.equal(await page.getByText('Ödəniş tamamlanmadı',{exact:true}).count(),0);
 await page.goto(origin+'/odenis');await page.locator('input[value=card]').waitFor();await page.locator('input[value=card]').check();await page.locator('.checkout-consent input').check();await page.getByRole('button',{name:'Sifarişi tamamla · 5,99 ₼',exact:true}).click();await page.waitForURL('https://epoint.az/isolated-wallet');assert.equal(selected,'card');console.log('PASS '+engine.name()+' '+width+': wallet/card/apple ID order, no balance auto-switch, Apple retained across quote redraw, correct method submit, widget, expired opening separated, card redirect; synthetic only');await ctx.close();
 const inapp=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 iPhone WhatsApp'}),blocked=await inapp.newPage();await blocked.goto(origin+'/odenis');await blocked.getByText('Apple Pay üçün Safari-də açın və ya bank kartını seçin.',{exact:true}).waitFor();assert.equal(await blocked.locator('input[value=apple-pay]').count(),0);assert.equal(await blocked.locator('input[value=wallet]').isChecked(),true);await inapp.close();
 }}finally{await browser.close();}}}finally{await new Promise(r=>server.close(r));}
