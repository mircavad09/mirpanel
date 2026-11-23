// Isolated UI/provider fixtures only. No request may reach a live payment API.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {onRequest as paymentPage} from '../functions/odenis/epoint/[[path]].js';
const records=new Map(),out='payment-test-artifacts/wallet-selection';fs.mkdirSync(out,{recursive:true});let posts=0,m10=false;
const names={'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'},header=fs.readFileSync('customer-header.html','utf8'),id='11111111-1111-4111-8111-111111111111';
const liveAssets=new Map();
if(process.argv.includes('--live-assets')){
 for(const name of ['shop-ui.js','wallet-topup.js','epoint-wallet.js','wallet-selection.js','epoint-payment.js','topup-amount.js','shop.css']){
  const p='/community-assets/'+name,r=await fetch('https://mirpanel.com'+p+'?verify='+Date.now(),{cache:'no-store'});assert.equal(r.status,200,p);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.toString().replaceAll('\r\n','\n'),fs.readFileSync('mirpanel-admin/community/public/'+name,'utf8').replaceAll('\r\n','\n'),p+' deployed source');liveAssets.set(p,bytes);
 }
 for(const name of ['apple-pay-mark','birbank-symbol','m10-logo']){const p='/assets/wallet/methods/'+name+'.svg',r=await fetch('https://mirpanel.com'+p+'?verify='+Date.now(),{cache:'no-store'});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.toString().replaceAll('\r\n','\n'),fs.readFileSync(p.slice(1),'utf8').replaceAll('\r\n','\n'));liveAssets.set(p,bytes);}
 console.log('Verified deployed assets downloaded; all payment APIs below remain isolated fixtures');
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),p=u.pathname,json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(liveAssets.has(p)){res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':'image/webp');return res.end(liveAssets.get(p));}
 if(p==='/api/community/state')return json({profile:{user_id:'isolated-wallet',display_name:'Sınaq',balanceCents:1200}});
 if(p==='/api/community/notifications')return json({items:[],unread:0});
 if(p==='/api/payments/shop/wallet')return json({cents:1200,items:[],topups:[],more:false});
 if(['/api/payments/shop/topup/methods','/api/payments/methods'].includes(p))return json({methods:[{id,available:true,displayName:'Sintetik bank',maskedNumber:'****0000'}]});
 if(p==='/api/payments/epoint/status'&&!u.searchParams.has('ref'))return json({enabled:false,methods:{'apple-pay':true,'google-pay':true,birbank:true,m10},limits:{minCents:100,maxCents:50000}});
 if(p==='/api/payments/epoint/start'){
  let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);assert.ok(names[body.method]);assert.equal(req.method,'POST');posts++;
  const cents=Math.round(Number(body.amount)*100),old=records.get(body.requestId);if(old){assert.equal(old.method,body.method);assert.equal(old.cents,cents);}else records.set(body.requestId,{method:body.method,cents,status:'pending'});
  return json({state:'ready',...(body.method.endsWith('-pay')?{widget:'https://epoint.az/api/1/token/widget/isolated'}:{redirect:'https://epoint.az/wallet/isolated?ref='+body.requestId})});
 }
 if(['/api/payments/epoint/status','/api/payments/epoint/checkout'].includes(p)){
  const ref=u.searchParams.get('ref'),row=records.get(ref);if(!row)return json({error:'Tapılmadı'},404);
  return json({...row,state:'ready',...(row.method.endsWith('-pay')?{widget:'https://epoint.az/api/1/token/widget/isolated'}:{redirect:'https://epoint.az/wallet/isolated?ref='+ref}),...(row.status==='success'?{balanceCents:1200+row.cents}:{})});
 }
 if(p.startsWith('/api/'))return json({});
 if(p.startsWith('/odenis/epoint/')){const response=paymentPage({request:new Request(u)});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());}
 if(p==='/balans'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page">'+header+'<main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script><script src="/site-header.js"></script></body></html>');}
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/svg+xml');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const engine of ['chrome','webkit']){
  const b=await(engine==='chrome'?chromium:webkit).launch({headless:true,executablePath:engine==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});
  try{for(const width of [320,390,430,1440])for(const method of ['google-pay','birbank','m10']){
   // m10 is enabled only in this isolated fixture to exercise the shared code.
   m10=method==='m10';const c=await b.newContext({viewport:{width,height:850},userAgent:method==='google-pay'?'Mozilla/5.0 (Linux; Android 14) Chrome/140.0':'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0'}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await c.addInitScript(()=>{Object.defineProperty(window,'PaymentRequest',{value:class{canMakePayment(){return Promise.resolve(true);}}});});
   await c.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.origin===origin)return route.continue();
    if(u.origin==='https://epoint.az'&&u.pathname.startsWith('/api/1/token/widget/'))return route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><p>İzolə edilmiş Google Pay sahəsi — real ödəniş yoxdur</p>'});
    if(u.origin==='https://epoint.az'&&u.pathname==='/wallet/isolated'){const ref=u.searchParams.get('ref'),row=records.get(ref);return route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><h1>'+names[row.method]+' — yalnız sınaq</h1><p>'+row.cents+' qəpik</p><a href="'+origin+'/odenis/epoint/ugurlu?ref='+ref+'">Nəticəyə qayıt</a>'});}
    return route.abort();
   });
   const size=records.size,writes=posts;await p.goto(origin+'/balans');const tile=p.locator('[data-digital-wallet="'+method+'"]'),next=p.locator('.wallet-topup-continue');await tile.waitFor();
   assert(await p.locator('.wallet-topup').evaluate(n=>n.getBoundingClientRect().top>document.querySelector('#balansi-artir').getBoundingClientRect().bottom));
   assert.equal(await p.getByText(/Google Pay üçün Google Cüzdanı|Epoint ödənişinin vəziyyəti/).count(),0);assert.equal(await p.locator('[data-digital-wallet="apple-pay"]').count(),0);
   if(!m10)assert.equal(await p.locator('[data-digital-wallet="m10"]').count(),0);
   await tile.click();await p.getByRole('button',{name:'10 ₼',exact:true}).click();await p.getByRole('button',{name:'5 ₼',exact:true}).click();await tile.click();
   assert.equal(posts,writes);assert.equal(records.size,size);assert.equal(new URL(p.url()).pathname,'/balans');assert.equal(await tile.getAttribute('aria-pressed'),'true');assert.match(await next.textContent(),/Balansa əlavə et · 5,00/);
   assert.equal(await p.locator('.wallet-method-art').count(),0,'no banner artwork');
   await p.locator('.wallet-method-logo').evaluateAll(async nodes=>{await Promise.all(nodes.map(n=>n.decode()));});assert(await p.locator('.wallet-method-logo').evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>n.naturalWidth>0&&getComputedStyle(n).objectFit==='contain'&&n.src.endsWith('.svg'))));
   assert.equal(await p.locator('.wallet-method-tiles').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3);
   for(const label of await p.locator('[data-digital-wallet] strong').allTextContents())assert(!/davam|AZN|\d+[.,]\d{2}/.test(label),'static method names only');
   const heights=await p.locator('.wallet-method-tile').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert(Math.max(...heights)-Math.min(...heights)<2,'equal card heights');
   await next.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));assert(await next.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await p.screenshot({path:out+'/'+engine+'-'+method+'-mobile.jpg'});
   await next.click();let dialog=p.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.textContent(),/Balansınıza 5,00/);assert.match(await dialog.textContent(),new RegExp(names[method]));await dialog.getByRole('button',{name:'Geri',exact:true}).click();assert.equal(posts,writes);assert.equal(records.size,size);assert.equal(await tile.getAttribute('aria-pressed'),'true');
   await next.click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).evaluate(n=>{n.click();n.click();});
   let ref;
   if(method==='google-pay'){
    await p.waitForURL('**/odenis/epoint/odeme?ref=*');ref=new URL(p.url()).searchParams.get('ref');await p.locator('iframe[title="Google Pay — Epoint təhlükəsiz ödəniş"]').waitFor();assert.match(await p.locator('[data-apple-amount]').textContent(),/5,00/);assert.match(await p.locator('[data-payment-method]').textContent(),/Google Pay/);await p.reload();await p.locator('iframe').waitFor();
    records.get(ref).status='success';await p.getByRole('button',{name:'Yenidən cəhd et'}).click();await p.waitForURL('**/odenis/epoint/ugurlu?ref=*');await p.getByRole('heading',{name:'Balansınız uğurla artırıldı',exact:true}).waitFor();
   }else{
    await p.waitForURL('https://epoint.az/wallet/isolated?ref=*');ref=new URL(p.url()).searchParams.get('ref');await p.getByRole('heading',{name:names[method]+' — yalnız sınaq',exact:true}).waitFor();await p.reload();
    await p.goBack();await next.waitFor();assert.equal(await tile.getAttribute('aria-pressed'),'true');assert.match(await next.textContent(),/5,00/);await next.click();await p.getByRole('button',{name:'Təsdiq et',exact:true}).click();await p.waitForURL('https://epoint.az/wallet/isolated?ref=*');assert.equal(new URL(p.url()).searchParams.get('ref'),ref);
    records.get(ref).status='failed';records.get(ref).cancelled=true;await p.getByRole('link',{name:'Nəticəyə qayıt'}).click();await p.getByRole('heading',{name:'Ödəniş ləğv edildi',exact:true}).waitFor();
   }
   assert.equal(records.size,size+1);assert.equal(records.get(ref).method,method);assert.equal(records.get(ref).cents,500);assert.deepEqual(errors,[]);await c.close();console.log('PASS '+engine+' '+width+' '+method+': selection/amount/back create zero; confirmed one operation; own amount, official fixture, retry/return safe');
  }}finally{await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
