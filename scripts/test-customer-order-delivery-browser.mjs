import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const sample='Sintetik e-poçt: buyer@example.test\n\nİkinci sətir ✨';
const order='12345678-1234-4234-8234-000000000001',delivery='12345678-1234-4234-8234-000000000002';
let status='reviewing',reveals=0;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=body=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(body));};
 if(u.pathname==='/api/payments/my-orders'){
  assert.equal(u.searchParams.get('order'),'9180');
  return json({orders:[{id:order,orderCode:'9180',product:'Synthetic multi-order',amount:11,status,createdAt:'2026-11-08T09:03:00Z',items:[{title:'Synthetic first',quantity:1,planName:'1 ay',unitCents:500},{title:'Synthetic second',quantity:1,planName:'1 aylıq uzun paket adı — uzun sətir üçün sınaq',unitCents:600}],deliveries:status==='completed'?[{id:delivery,line:0,quantity:1}]:[]}],nextCursor:null});
 }
 if(u.pathname==='/api/payments/my-orders/codes')return json({codes:[{id:delivery,title:'Synthetic first',plan:'1 ay',quantity:1,deliveredAt:'2026-11-08T09:05:00Z'}]});
 if(u.pathname==='/api/payments/my-orders/codes/'+delivery){reveals++;return json({text:sample});}
 if(u.pathname==='/profil'){
  const codes=u.searchParams.get('tab')==='codes';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#141414;color:white"><main class="account-panel">${codes?
   '<section id="codes"></section><script type="module">import {mountCodes} from "/community-assets/account-codes.js";const el=(tag,a,...children)=>{const e=document.createElement(tag);for(const [k,v]of Object.entries(a))v===true?e.setAttribute(k,""):e.setAttribute(k,v);e.append(...children);return e;};const button=(label,fn)=>{const b=el("button",{type:"button"},label);b.onclick=fn;return b;};mountCodes({content:document.getElementById("codes"),el,button});</script>':
   '<section id="browserOrders"></section><p id="browserOrdersError" hidden></p><button id="browserOrdersMore" hidden>Daha çox göstər</button><dialog id="browserReceipt"><button id="browserReceiptClose">Bağla</button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>'}</main>`);
 }
 const file={'/browser-orders.js':'browser-orders.js','/browser-orders.css':'browser-orders.css','/community-assets/account-codes.js':'mirpanel-admin/community/public/account-codes.js'}[u.pathname];
 if(file){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));}
 if(u.pathname==='/checkout-sounds.js'){res.setHeader('Content-Type','text/javascript');return res.end('export function playCheckoutSound(k,id){sessionStorage.setItem("played",(Number(sessionStorage.getItem("played"))+1).toString());}');}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const [engine,name,width]of [[chromium,'Chrome desktop',1440],[chromium,'Chrome mobil ölçü',320],[webkit,'WebKit mobil ölçü',390]]){
  status='reviewing';reveals=0;
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const page=await browser.newPage({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
   await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});const timer=window.setInterval;window.setInterval=(fn,ms,...args)=>timer(fn,ms===12000?100:ms,...args);});
   await page.goto(origin+'/profil?tab=orders&order=9180');
   const card=page.locator('details.browser-order');
   await card.getByText('Yoxlanılır').waitFor();assert.equal(await card.getAttribute('open'),'');
   await card.locator('summary').click();assert.equal(await card.getAttribute('open'),null);
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),0);
   status='preparing';await card.getByText('Hazırlanır').waitFor();
   await page.waitForFunction(()=>Number(sessionStorage.getItem('played'))===1);
   status='completed';await card.getByText('Tamamlandı').waitFor();
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),1);
   await page.reload();await card.getByText('Tamamlandı').waitFor();assert.equal(await card.getAttribute('open'),'');
   assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('played'))),1);
   const show=card.getByRole('button',{name:/Təhvil məlumatını göstər/});
   await show.click();await card.getByText('İkinci sətir',{exact:false}).waitFor();
   await card.getByRole('button',{name:'Gizlət',exact:true}).click();assert.equal(await card.locator('pre').textContent(),'');
   assert.equal(reveals,1);
   await page.goto(origin+'/profil?tab=codes');await page.getByText('Synthetic first').waitFor();assert.equal(reveals,1);
   await page.getByRole('button',{name:'Göstər',exact:true}).click();await page.getByText('İkinci sətir',{exact:false}).waitFor();
   await page.getByRole('button',{name:'Gizlət',exact:true}).click();assert.equal(await page.locator('pre').textContent(),'');
   await page.getByRole('button',{name:'Kopyala',exact:true}).click();await page.getByText('Məlumat kopyalandı').waitFor();
   assert.equal(await page.evaluate(()=>window.__copied),sample);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log('PASS '+name+' — deep link, status, one sound transition, private reveal and exact copy');
  }finally{await browser.close();}
 }
}finally{await new Promise(r=>server.close(r));}
