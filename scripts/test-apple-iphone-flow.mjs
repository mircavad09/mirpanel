import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest as paymentPage} from '../functions/odenis/epoint/[[path]].js';
const records=new Map(),out='payment-test-artifacts/apple-iphone-flow';fs.mkdirSync(out,{recursive:true});let writes=0,failStart=false,failRead=false;
const id='11111111-1111-4111-8111-111111111111',header=fs.readFileSync('customer-header.html','utf8');
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),p=u.pathname,json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(p==='/api/community/state')return json({profile:{user_id:'synthetic-apple',display_name:'İzolə edilmiş sınaq',balanceCents:1200}});
 if(p==='/api/community/notifications')return json({items:[],unread:0});
 if(p==='/api/payments/shop/wallet')return json({cents:1200,items:[],topups:[],more:false});
 if(p==='/api/payments/shop/topup/methods'||p==='/api/payments/methods')return json({methods:[{id,available:true,displayName:'Sintetik bank',maskedNumber:'****0000'}]});
 if(p==='/api/payments/epoint/start'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);assert.equal(body.method,'apple-pay');writes++;
  const old=records.get(body.requestId);if(old)assert.equal(old.cents,Math.round(Number(body.amount)*100));
  else records.set(body.requestId,{cents:Math.round(Number(body.amount)*100),status:'pending'});
  if(failStart){failStart=false;return json({error:'Sintetik itmiş cavab. Eyni ödənişə davam edin.'},503);}
  return json({state:'ready',widget:'https://epoint.az/api/1/token/widget/isolated-apple'});
 }
 if(p==='/api/payments/epoint/status'&&!u.searchParams.has('ref'))return json({enabled:false,methods:{'apple-pay':true,'google-pay':true,birbank:true,m10:false},limits:{minCents:100,maxCents:50000}});
 if(p==='/api/payments/epoint/status'||p==='/api/payments/epoint/apple-checkout'){
  if(failRead)return json({error:'Sintetik müvəqqəti bağlantı xətası'},503);
  const row=records.get(u.searchParams.get('ref'));if(!row)return json({error:'Tapılmadı'},404);
  return json({...row,method:'apple-pay',state:'ready',...(row.status==='pending'?{widget:'https://epoint.az/api/1/token/widget/isolated-apple'}:{}),...(row.status==='success'?{balanceCents:1200+row.cents}:{})});
 }
 if(p.startsWith('/api/'))return json({});
 if(p.startsWith('/odenis/epoint/')){const response=paymentPage({request:new Request(u)});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());}
 if(p==='/balans'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page">'+header+'<main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script><script src="/site-header.js"></script></body></html>');}
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'image/svg+xml');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
async function context(browser,width,userAgent=iphone,supported=true){
 const c=await browser.newContext({viewport:{width,height:850},userAgent});
 await c.addInitScript(supported=>{Object.defineProperty(window,'ApplePaySession',{value:{canMakePayments:()=>supported}});Object.defineProperty(window,'PaymentRequest',{value:class{canMakePayment(){return Promise.resolve(true);}}});},supported);
 await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.request().url().startsWith('https://epoint.az/api/1/token/widget/')?route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><p>İzolə edilmiş Epoint vidcet sahəsi — real ödəniş yoxdur</p><button onclick="parent.postMessage({status:\'success\',amount:999},\'*\')">Sintetik bildiriş</button>'}):route.abort());return c;
}
async function launch(engine){return(engine==='chrome'?chromium:webkit).launch({headless:true,executablePath:engine==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});}
try{
 for(const engine of ['chrome','webkit']){
  const browser=await launch(engine);
  try{
   for(const width of [320,390,430,1440]){
    const c=await context(browser,width),p=await c.newPage(),errors=[],consoleErrors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});const initialSize=records.size,initialWrites=writes;
    await p.goto(origin+'/balans');const apple=p.locator('[data-digital-wallet="apple-pay"]');await apple.waitFor();
    assert(await p.locator('.wallet-topup').evaluate(n=>n.getBoundingClientRect().top<document.querySelector('#balansi-artir').getBoundingClientRect().top));
    await apple.click();assert.equal(await apple.getAttribute('aria-pressed'),'true');assert.equal(records.size,initialSize);
    const input=p.getByLabel('Başqa məbləğ',{exact:true}),submit=p.locator('.apple-topup-actions button');
    assert.equal(await submit.isEnabled(),false,'fresh Apple selection requires a subsequent amount choice');
    await p.getByRole('button',{name:'10 ₼',exact:true}).click();assert.match(await submit.textContent(),/10,00/);
    for(const bad of ['0.99','','500.01','-1','1.001']){await input.fill(bad);assert.equal(await submit.isEnabled(),false);}
    await input.fill('5,00');assert.match(await submit.textContent(),/5[,.]00/);assert.equal(writes,initialWrites);
    if(width===390)await p.screenshot({path:out+'/'+engine+'-selection.jpg',fullPage:true});
    await submit.click();const dialog=p.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.textContent(),/Balansınıza 5[,.]00/);assert.match(await dialog.textContent(),/Apple Pay/);
    if(width===390)await p.screenshot({path:out+'/'+engine+'-confirmation.jpg'});
    await dialog.getByRole('button',{name:'Geri',exact:true}).click();assert.equal(await input.inputValue(),'5,00');assert.equal(records.size,initialSize);
    await submit.click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).evaluate(n=>{n.click();n.click();});
    await p.waitForURL('**/odenis/epoint/apple-pay?ref=*');let ref=new URL(p.url()).searchParams.get('ref');assert.equal(records.size,initialSize+1);assert.equal(writes,initialWrites+1);
    assert.equal(new URL(p.url()).searchParams.has('amount'),false);assert.equal(records.get(ref).cents,500);
    const frame=p.frameLocator('iframe[title="Apple Pay — Epoint təhlükəsiz ödəniş"]');try{await frame.getByText('İzolə edilmiş Epoint vidcet sahəsi',{exact:false}).waitFor({timeout:8000});}catch(e){console.log(JSON.stringify({url:p.url(),body:await p.locator('body').innerText(),errors,consoleErrors}));throw e;}
    await p.goto(p.url()+'&amount=999');await p.locator('iframe').waitFor();assert.match(await p.locator('[data-apple-amount]').textContent(),/5[,.]00/);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(writes,initialWrites+1);
    if(width===390)await p.screenshot({path:out+'/'+engine+'-payment.jpg',fullPage:true});
    await p.getByRole('link',{name:'Geri — Balansa qayıt',exact:true}).click();await p.locator('.apple-topup-actions button').waitFor();assert.equal(await input.isEnabled(),false);assert.match(await submit.textContent(),/5[,.]00/);
    await submit.click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).click();await p.waitForURL('**/odenis/epoint/apple-pay?ref=*');assert.equal(new URL(p.url()).searchParams.get('ref'),ref);assert.equal(records.size,initialSize+1);
    await p.goBack();await p.locator('.apple-topup-actions button').waitFor();assert.match(await submit.textContent(),/5,00/);await submit.click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).click();await p.waitForURL('**/odenis/epoint/apple-pay?ref=*');assert.equal(new URL(p.url()).searchParams.get('ref'),ref);
    await frame.getByRole('button',{name:'Sintetik bildiriş'}).click();assert.equal(records.get(ref).status,'pending');assert.equal(await p.getByRole('heading',{name:'Balansınız uğurla artırıldı'}).count(),0);
    failRead=true;await p.getByRole('button',{name:'Yenidən cəhd et'}).click();await p.getByText('Sintetik müvəqqəti bağlantı xətası').waitFor();failRead=false;
    records.get(ref).status=width===320?'failed':'success';if(width===320)records.get(ref).cancelled=true;
    await p.getByRole('button',{name:'Yenidən cəhd et'}).click();await p.waitForURL('**/odenis/epoint/ugurlu?ref=*');
    await p.getByRole('heading',{name:width===320?'Ödəniş ləğv edildi':'Balansınız uğurla artırıldı',exact:true}).waitFor();
    if(width!==320)assert.match(await p.locator('[data-epoint-message]').textContent(),/5[,.]00/);
    assert.equal(records.size,initialSize+1);assert.deepEqual(errors,[]);await c.close();
    console.log('PASS '+engine+' '+width+': iPhone-policy fixture, method/amount/confirm, separate server-valued page, back/reload/replay, pending and verified '+(width===320?'cancellation':'success'));
   }
   for(const [agent,supported] of [['Mozilla/5.0 (iPad) Safari',true],['Mozilla/5.0 (Macintosh) Safari',true],['Mozilla/5.0 (Linux; Android 14) Chrome',true],[iphone,false]]){
    const c=await context(browser,390,agent,supported),p=await c.newPage();await p.goto(origin+'/balans');await p.locator('[data-digital-wallet="birbank"]').waitFor();assert.equal(await p.locator('[data-digital-wallet="apple-pay"]').count(),0);await c.close();
   }
   const c=await context(browser,390),p=await c.newPage();await p.goto(origin+'/balans');await p.locator('[data-digital-wallet="apple-pay"]').click();await p.getByRole('button',{name:'5 ₼',exact:true}).click();const size=records.size;
   failStart=true;await p.locator('.apple-topup-actions button').click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).click();await p.getByText('Sintetik itmiş cavab. Eyni ödənişə davam edin.').waitFor();
   await p.locator('.apple-topup-actions button').click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).click();await p.waitForURL('**/odenis/epoint/apple-pay?ref=*');assert.equal(records.size,size+1);await c.close();
   console.log('PASS '+engine+': Android/iPad/desktop/unsupported iPhone hidden, alternatives remain; lost create reply reuses one operation');
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
