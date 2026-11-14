import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT||'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const requested=[],card={id:'order',kind:'order',number:'12664',title:'CapCut Pro',cents:499,submitted_at:'2026-11-07T22:13:09Z',operation_at:'2026-11-08T08:01:47Z',status:'approved',by_receipt:true,mime:'image/png'};
const credit={...card,id:'credit',kind:'topup',number:'1',title:'Balans yükləmə',cents:600,mime:'application/pdf'};
const rejected={...card,id:'rejected',kind:'topup',number:'2',title:'Balans yükləmə',cents:200,status:'rejected',mime:null,operation_at:null};
const waiting={...credit,id:'waiting',number:'3',cents:125,status:'reviewing',mime:null};
let decided=false;
const paymentModule='mirpanel-admin/community/public/account-payments.js';
let paymentSource=fs.readFileSync(paymentModule,'utf8');
if(process.argv.includes('--live-assets')){
 const response=await fetch('https://mirpanel.com/community-assets/account-payments.js');
 assert.ok(response.ok);
 const deployed=await response.text();
 assert.equal(deployed.replaceAll('\r\n','\n'),paymentSource.replaceAll('\r\n','\n'));
 paymentSource=deployed;
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(u.pathname==='/api/community/payment-history'){
  const status=u.searchParams.get('status'),page=u.searchParams.get('page');requested.push([status,page]);
  const recent=decided?{...waiting,status:'approved',cents:100}:waiting;
  const items=status==='approved'?(decided?[credit,recent]:[credit]):status==='rejected'?[rejected]:status==='reviewing'?[]:page==='2'?[rejected]:[card,credit,recent];
  return json({accountId:'a',balance:'51',total:decided?'700':'600',month:decided?'700':'600',rejectedCents:'200',all:31,approved:decided?30:29,reviewing:decided?0:1,rejected:1,items:u.searchParams.get('topup')?[credit]:items,more:!u.searchParams.get('topup')&&status==='all'&&page==='1'});
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
 if(/\.(js|css)$/.test(file)&&!file.includes('..')&&fs.existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');return res.end(file===paymentModule?paymentSource:fs.readFileSync(file));}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/profil?tab=payments';
try{
 for(const [engine,width] of (process.env.MIRPANEL_BROWSER_CHROMIUM_ONLY?[[chromium,1440],[chromium,320],[chromium,390]]:[[chromium,1440],[chromium,320],[webkit,390]])){
  const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.MIRPANEL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const p=await b.newPage({viewport:{width,height:820},isMobile:width<600,hasTouch:width<600});
   await p.route('https://synthetic.supabase.co/**',r=>r.fulfill({status:200,contentType:r.request().url().endsWith('.pdf')?'application/pdf':'image/png',body:''}));
   decided=false;await p.goto(url);await p.getByText('Balans yükləmə №1',{exact:true}).waitFor();assert.equal(await p.getByText('Sifariş №12664',{exact:true}).count(),0);
   assert.equal(await p.getByRole('link',{name:'Balans yüklə'}).getAttribute('href'),'/balans');
   assert.deepEqual(await p.locator('.account-payment-summary strong').allTextContents(),['0,51 ₼','6,00 ₼','6,00 ₼','2,00 ₼']);
   await p.getByText('+6,00 ₼',{exact:true}).waitFor();
   assert.equal(await p.locator('[data-status=all] .pay-status-count').textContent(),'31');
   assert.equal(await p.locator('[data-status=approved] .pay-status-count').textContent(),'29');
   fs.mkdirSync('outputs/profile-records',{recursive:true});await p.screenshot({path:'outputs/profile-records/payments-initial-'+engine.name()+'-'+width+'.png'});
   const search=p.getByRole('searchbox'),before=requested.length;
   await search.fill('№1');assert.equal(await p.locator('.account-payment-row').count(),1);
   await search.fill('№2');await p.getByText('Bu səhifədə axtarışa uyğun ödəniş yoxdur.').waitFor();assert.equal(requested.length,before);
   await p.getByRole('button',{name:'Növbəti'}).click();await p.getByText('Balans yükləmə №2',{exact:true}).waitFor();
   await p.getByText('Son əməliyyat: Vaxt qeydə alınmayıb').waitFor();
   assert.equal(await p.locator('[data-status=all] .pay-status-count').textContent(),'31');
   await search.clear();await p.locator('.account-payment-filters [data-status=approved]').click();
   await p.getByRole('button',{name:'Qəbzi böyüt: Balans yükləmə №1'}).click();await p.getByRole('link',{name:'PDF qəbzini aç'}).waitFor();
   await p.getByRole('button',{name:'Bağla',exact:true}).click();
   await p.locator('.account-payment-filters [data-status=reviewing]').click();await p.getByText('Bu filtrə uyğun ödəniş yoxdur.').waitFor();
   await p.locator('.account-payment-filters [data-status=rejected]').click();await p.getByText('Balans yükləmə №2',{exact:true}).waitFor();
   const monthly=p.locator('[data-metric=month] strong');
   const rejectedTotal=p.locator('[data-metric=rejected]');
   assert.equal(await monthly.textContent(),'6,00 ₼');
   assert.equal(await rejectedTotal.locator('strong').textContent(),'2,00 ₼');
   assert.equal(await rejectedTotal.locator('small').textContent(),'1 əməliyyat');
   await p.locator('.account-payment-filters [data-status=all]').click();
   const recent=p.locator('.account-payment-row').filter({hasText:'Balans yükləmə №3'});
   await recent.getByText('Yoxlanılır',{exact:true}).waitFor();
   decided=true;
   await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
   await recent.getByText('Təsdiqləndi',{exact:true}).waitFor();
   assert.equal(await monthly.textContent(),'7,00 ₼');
   await p.reload();await recent.getByText('Təsdiqləndi',{exact:true}).waitFor();
   assert.equal(await monthly.textContent(),'7,00 ₼');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.goto(url+'&topup=credit');await p.getByRole('article',{name:'Seçilmiş müraciət'}).waitFor();
   assert.equal(await p.locator('.account-payment-row').count(),1);assert.equal(await p.locator('.account-payment-selected').textContent().then(t=>t.includes('Balans yükləmə №1')),true);
   await p.locator('.account-payment-filters [data-status=all]').click();assert.equal(await p.locator('.account-payment-selected').count(),0);await p.getByText('Balans yükləmə №1',{exact:true}).waitFor();assert.equal(await p.getByText('Sifariş №12664',{exact:true}).count(),0);
   fs.mkdirSync('outputs/profile-records',{recursive:true});await p.screenshot({path:'outputs/profile-records/payments-'+engine.name()+'-'+width+'.png'});
   console.log('PASS '+engine.name()+' '+width+'px: metrics, current-page search, stable numbers, Baku seconds, PNG and PDF preview');
  }finally{await b.close();}
 }
}finally{await new Promise(r=>server.close(r));}
