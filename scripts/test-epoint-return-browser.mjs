import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {onRequest as returnPage} from '../functions/odenis/epoint/[[path]].js';
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const ref=randomUUID();let state='pending',reads=0,starts=0,enabled=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/community-assets/epoint-wallet.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(fs.readFileSync('mirpanel-admin/community/public/epoint-wallet.js'));}
 if(url.pathname==='/api/payments/epoint/status'){
  if(!url.searchParams.has('ref')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({enabled}));}
  assert.equal(url.searchParams.get('ref'),ref);assert.equal(req.method,'GET');reads++;
  res.writeHead(state==='guest'?401:200,{'Content-Type':'application/json'});
  return res.end(JSON.stringify({status:state,...(state==='success'?{cents:499}:{})}));
 }
 if(url.pathname==='/api/payments/epoint/start'){
  starts++;let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);assert.equal(body.amount,'4.99');assert.match(body.requestId,/^[0-9a-f-]{36}$/);
  res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({state:'creating'}));
 }
 if(url.pathname==='/wallet-test'){
  res.writeHead(200,{'Content-Type':'text/html'});
  return res.end(`<form></form><script type="module">
   import {mountEpointWallet} from '/community-assets/epoint-wallet.js';
   const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';n.className=cls||'';return n;};
   const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
   const link=(text,href)=>{const n=el('a',text);n.href=href;return n;};
   await mountEpointWallet({form:document.querySelector('form'),accountId:'test',getCents:()=>499,signal:new AbortController().signal,el,button,link});
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
 console.log('PASS: mobile and desktop; spoofed redirect, pending, committed success, failed payment, sign-in, feature flag, retained reference and double click.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
