import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const requested=[],card={id:'order',kind:'order',number:'12664',title:'CapCut Pro',cents:499,submitted_at:'2026-11-07T22:13:09Z',operation_at:'2026-11-08T08:01:47Z',status:'approved',by_receipt:true,mime:'image/png'};
const credit={...card,id:'credit',kind:'topup',number:'1',title:'Balans yükləmə',cents:500,mime:'application/pdf'};
const rejected={...card,id:'rejected',kind:'topup',number:'2',title:'Balans yükləmə',cents:200,status:'rejected',mime:null,operation_at:null};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(u.pathname==='/api/community/payment-history'){
  const status=u.searchParams.get('status'),page=u.searchParams.get('page');requested.push([status,page]);
  const items=status==='approved'?[card,credit]:status==='rejected'?[rejected]:status==='reviewing'?[]:page==='2'?[rejected]:[card,credit];
  return json({accountId:'a',balance:'125',total:'499',month:'499',rejectedCents:'200',all:31,approved:30,reviewing:0,rejected:1,items,more:status==='all'&&page==='1'});
 }
 if(u.pathname==='/api/payments/my-orders/order/receipt'||u.pathname==='/api/payments/shop/topup/receipt'){
  const topup=u.pathname.includes('/topup/');return json({url:'https://synthetic.supabase.co/'+(topup?'test.pdf':'test.png'),mime:topup?'application/pdf':'image/png'});
 }
 if(u.pathname==='/profil'){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html lang="az"><meta name="viewport" content="width=device-width"><body style="background:#0c1014"><main style="max-width:950px;margin:auto" id="app"></main><script type="module">
   import {mountPayments} from '/community-assets/account-payments.js';
   const el=(tag,a,...children)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,String(v));e.append(...children.filter(v=>v!=null));return e;};
   const button=(label,fn)=>{const b=el('button',{type:'button'},label);b.onclick=fn;return b;};
   mountPayments({content:document.querySelector('#app'),el,button,link:(label,href,cls)=>el('a',{href,class:cls},label),api:u=>fetch(u).then(r=>r.json()),validate:d=>{if(d.accountId!=='a')throw Error();}});
  </script></body></html>`);
 }
 const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):'';
 if(/\.(js|css)$/.test(file)&&!file.includes('..')&&fs.existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(file));}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/profil?tab=payments';
try{
 for(const [engine,width] of [[chromium,1440],[chromium,320],[webkit,390]]){
  const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const p=await b.newPage({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
   await p.route('https://synthetic.supabase.co/**',r=>r.fulfill({status:200,contentType:r.request().url().endsWith('.pdf')?'application/pdf':'image/png',body:''}));
   await p.goto(url);await p.getByText('Sifariş №12664',{exact:true}).waitFor();
   assert.equal(await p.getByRole('link',{name:'Balans yüklə'}).getAttribute('href'),'/balans');
   assert.deepEqual(await p.locator('.account-payment-summary strong').allTextContents(),['1,25 ₼','4,99 ₼','4,99 ₼','2,00 ₼']);
   const orderRow=p.locator('.account-payment-row').filter({hasText:'Sifariş №12664'});
   await orderRow.getByText('08.11.2026 02:13:09',{exact:true}).waitFor();await orderRow.getByText('08.11.2026 12:01:47',{exact:true}).waitFor();
   await p.getByText('+5,00 ₼',{exact:true}).waitFor();
   assert.equal(await p.locator('[data-status=all] .pay-status-count').textContent(),'31');
   assert.equal(await p.locator('[data-status=approved] .pay-status-count').textContent(),'30');
   const search=p.getByRole('searchbox'),before=requested.length;
   await search.fill('№12664');assert.equal(await p.locator('.account-payment-row').count(),1);
   await search.fill('№2');await p.getByText('Bu səhifədə axtarışa uyğun ödəniş yoxdur.').waitFor();assert.equal(requested.length,before);
   await p.getByRole('button',{name:'Növbəti'}).click();await p.getByText('Balans yükləmə №2',{exact:true}).waitFor();
   await p.getByText('Son əməliyyat: Vaxt qeydə alınmayıb').waitFor();
   assert.equal(await p.locator('[data-status=all] .pay-status-count').textContent(),'31');
   await search.clear();await p.locator('.account-payment-filters [data-status=approved]').click();
   await p.getByRole('button',{name:'Qəbzi böyüt: Sifariş №12664'}).click();await p.locator('dialog[open] img').waitFor();
   await p.getByRole('button',{name:'Bağla',exact:true}).click();
   await p.getByRole('button',{name:'Qəbzi böyüt: Balans yükləmə №1'}).click();await p.getByRole('link',{name:'PDF qəbzini aç'}).waitFor();
   await p.getByRole('button',{name:'Bağla',exact:true}).click();
   await p.locator('.account-payment-filters [data-status=reviewing]').click();await p.getByText('Bu filtrə uyğun ödəniş yoxdur.').waitFor();
   await p.locator('.account-payment-filters [data-status=rejected]').click();await p.getByText('Balans yükləmə №2',{exact:true}).waitFor();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log('PASS '+engine.name()+' '+width+'px: metrics, current-page search, stable numbers, Baku seconds, PNG and PDF preview');
  }finally{await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
