import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {onRequest as returnPage} from '../functions/odenis/epoint/[[path]].js';
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const ref=randomUUID();let state='pending',reads=0,starts=0,enabled=false,walletMethods={},widgetRef=null;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/community-assets/epoint-wallet.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(fs.readFileSync('mirpanel-admin/community/public/epoint-wallet.js'));}
 if(url.pathname==='/api/payments/epoint/status'){
  if(!url.searchParams.has('ref')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({enabled,methods:walletMethods}));}
  assert.ok([ref,widgetRef].includes(url.searchParams.get('ref')));assert.equal(req.method,'GET');reads++;
  res.writeHead(state==='guest'?401:200,{'Content-Type':'application/json'});
  return res.end(JSON.stringify({status:state,...(state==='success'?{cents:499,balanceCents:1250}:{})}));
 }
 if(url.pathname==='/api/payments/epoint/start'){
  starts++;let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);assert.equal(body.amount,'4.99');assert.match(body.requestId,/^[0-9a-f-]{36}$/);
  if(body.method){
   assert.ok(walletMethods[body.method]);widgetRef=body.requestId;res.writeHead(200,{'Content-Type':'application/json'});
   const widget=body.method.endsWith('-pay');
   return res.end(JSON.stringify({state:'ready',...(widget?{widget:'https://epoint.az/api/1/token/widget/browser-test'}:{redirect:origin+'/odenis/epoint/ugurlu?ref='+widgetRef})}));
  }
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({state:'creating'}));
 }
 if(url.pathname==='/wallet-test'){
  res.writeHead(200,{'Content-Type':'text/html'});
  return res.end(`<form></form><script type="module">
   import {mountEpointWallet} from '/community-assets/epoint-wallet.js';
   const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';n.className=cls||'';return n;};
   const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
   const link=(text,href)=>{const n=el('a',text);n.href=href;return n;};
   await mountEpointWallet({form:document.querySelector('form'),accountId:'test',getCents:()=>499,signal:new AbortController().signal,el,button,link,walletOnly:location.search==='?checkout'});
   document.body.dataset.ready='1';
  </script>`);
 }
 const r=returnPage({request:new Request(url)});
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const success=page.getByRole('heading',{name:'Balansınız uğurla artırıldı',exact:true});
  await page.goto(origin+'/odenis/epoint/ugurlu?status=success&amount=999');
  assert.equal(await success.count(),0);
  state='pending';await page.goto(origin+'/odenis/epoint/ugurlu?ref='+ref);
  await page.getByText('Ödəniş hələ balansınıza əlavə edilməyib.',{exact:false}).waitFor();
  assert.equal(await success.count(),0);
  state='success';await page.getByRole('button',{name:'Vəziyyəti yoxla'}).click();await success.waitFor();
  assert.match(await page.locator('[data-epoint-message]').textContent(),/4[,.]99/);
  assert.match(await page.locator('[data-epoint-balance]').textContent(),/12[,.]50/);
  assert.equal(await page.getByRole('link',{name:'Məhsullara bax'}).isVisible(),true);
  assert.equal(await page.getByRole('link',{name:'Ödənişlərimə bax'}).isVisible(),true);
  state='failed';await page.goto(origin+'/odenis/epoint/ugursuz?ref='+ref);await page.getByRole('heading',{name:'Ödəniş tamamlanmadı'}).waitFor();
  assert.equal(await success.count(),0);
  state='guest';await page.goto(origin+'/odenis/epoint/ugurlu?ref='+ref);
  assert.equal(await page.getByRole('link',{name:'Daxil ol'}).getAttribute('href'),'/hesab?next='+encodeURIComponent('/odenis/epoint/ugurlu?ref='+ref));
  await page.close();
 }
 assert.ok(reads>=8);
 const page=await browser.newPage();
 await page.goto(origin+'/wallet-test');await page.locator('body[data-ready]').waitFor();
 assert.equal(await page.getByRole('button',{name:'Epoint ilə ödə'}).count(),0);
 enabled=true;
 await page.reload();await page.getByRole('button',{name:'Epoint ilə ödə'}).evaluate(n=>{n.click();n.click();});
 await page.getByRole('link',{name:'Epoint ödənişinin vəziyyəti'}).waitFor();
 assert.equal(starts,1);
 await page.reload();await page.getByRole('button',{name:/Epoint ödənişinə davam et/}).waitFor();
 await page.close();
 enabled=false;
 for(const [method,device,width] of [['apple-pay','apple',390],['google-pay','google',1440],['m10','none',390],['birbank','none',1440]]){
  state='pending';walletMethods={[method]:true};
  const p=await browser.newPage({viewport:{width,height:900}});
  await p.addInitScript(device=>{
   Object.defineProperty(window,'ApplePaySession',{value:device==='apple'?{canMakePayments:()=>true}:undefined});
   Object.defineProperty(window,'PaymentRequest',{value:class{canMakePayment(){return Promise.resolve(device==='google');}}});
  },device);
  await p.route('https://epoint.az/api/1/token/widget/browser-test',r=>r.fulfill({contentType:'text/html',body:'<button onclick="parent.postMessage({status:\'success\',payment:{amount:999}},\'*\')">Notify browser</button>'}));
  const label=({'apple-pay':'Apple Pay','google-pay':'Google Pay',m10:'m10',birbank:'Birbank'})[method],wrong=method==='apple-pay'?'Google Pay':'Apple Pay';
  await p.goto(origin+'/wallet-test'+(device==='google'?'?checkout':''));
  const pay=p.getByRole('button',{name:new RegExp(label)});await pay.waitFor();
  assert.equal(await p.getByRole('button',{name:new RegExp(wrong)}).count(),0);
  await pay.evaluate(n=>{n.click();n.click();});
  if(method.endsWith('-pay')){
   const widget=p.frameLocator('iframe[title="'+label+' — Epoint təhlükəsiz ödəniş"]');
   await widget.getByRole('button').click();
   await p.getByText('Ödəniş yoxlanılır…',{exact:true}).waitFor();
  }else await p.getByRole('heading',{name:'Ödəniş yoxlanılır…'}).waitFor();
  assert.equal(await p.getByRole('heading',{name:'Balansınız uğurla artırıldı'}).count(),0);
  state='success';await p.getByRole('heading',{name:'Balansınız uğurla artırıldı'}).waitFor({timeout:10000});
  assert.match(await p.locator('[data-epoint-balance]').textContent(),/12[,.]50/);
  await p.close();
 }
 assert.equal(starts,5);
 console.log('PASS: mobile/desktop Apple Pay, Google Pay, m10 and Birbank, widget/redirect, fake browser success rejected, verified success and one request per double click.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
