import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {parseTopupCents,topupAmountText} from '../mirpanel-admin/community/public/topup-amount.js';
let checks=0,balance=1200,cardsMode='ready',cardReads=0;const requests=[],eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},out='payment-test-artifacts/topup-choices';fs.mkdirSync(out,{recursive:true});
for(const [v,c]of [['1',100],['500',50000],['1,01',101],['12.34',1234],['0005,5',550]]){eq(parseTopupCents(v),c);eq(parseTopupCents(topupAmountText(c)),c);}
for(const v of ['',null,5,'0','0.99','500.01','-1','1.001','1,001','1e2','NaN','5,','1.2.3','1,2.3','+5','Infinity','9'.repeat(40)]){assert.throws(()=>parseTopupCents(v));checks++;}
const header=fs.readFileSync('customer-header.html','utf8'),id='11111111-1111-4111-8111-111111111111',secondId='22222222-2222-4222-8222-222222222222';
const liveAssets=new Map();
if(process.argv.includes('--live')){
 const site='https://mirpanel.com';
 const get=async path=>{const r=await fetch(site+path,{signal:AbortSignal.timeout(15000)});assert.ok(r.ok,path+' '+r.status);return Buffer.from(await r.arrayBuffer());};
 const html=(await get('/balans')).toString();
 for(const file of ['shop.css','shop-ui.js','wallet-topup.js']){
  const path='/community-assets/'+file,version=file==='wallet-topup.js'?'topup-auto-cards-1':file==='shop-ui.js'?'customer-perf-1':'checkout-first-paint-2';
  if(file!=='wallet-topup.js')assert.ok(html.includes(path+'?v='+version),'Live /balans must reference '+path);
  liveAssets.set(path,await get(path+'?v='+version));
 }
 const art='/assets/wallet/balance-gold.png';
 liveAssets.set(art,await get(art));
}
const server=http.createServer(async(req,res)=>{const p=new URL(req.url,'http://local').pathname,json=(v,s=200)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
 if(liveAssets.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/javascript');return res.end(liveAssets.get(p));}
 if(p==='/api/community/state')return json({profile:{user_id:'synthetic',display_name:'Sınaq',avatar:0,balanceCents:balance}});
 if(p==='/api/community/notifications')return json({items:[],unread:0});
 if(p==='/api/payments/methods'||p==='/api/payments/shop/topup/methods'){
  cardReads++;await new Promise(resolve=>setTimeout(resolve,600));
  if(cardsMode==='error')return json({error:'Kart xidməti müvəqqəti əlçatan deyil.'},503);
  return json({methods:cardsMode==='empty'?[]:[{id,available:true,displayName:'Sintetik bank',maskedNumber:'****0000'},{id:secondId,available:true,displayName:'İkinci sintetik bank',maskedNumber:'****0001'}]});
 }
 if(p==='/api/payments/shop/wallet')return json({cents:balance,items:[{cents:500,reason:'Sintetik tarixçə qeydi',created_at:'2026-11-10T00:00:00Z'}],topups:[{requested_cents:500,status:'reviewing'}],more:true});
 if(p==='/api/payments/shop/topup'){if(req.method==='GET')return json({id,status:'draft',methodId:requests.at(-1)?.methodId||id,cents:2010,receiptUploaded:false});let text='';for await(const chunk of req)text+=chunk;requests.push(JSON.parse(text));return json({id,status:'draft'});}
 if(p==='/api/payments/shop/method')return json({id,provider:'Sintetik bank',holder:'Sınaq',number:'0000 0000 0000 0000'});
 if(p==='/api/decorations')return json({});
 if(p.startsWith('/api/'))return json({});
 if(p==='/balans'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page">'+header+'<main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script><script src="/site-header.js"></script></body></html>');}
 const f=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);if(f.includes('..')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'image/svg+xml');res.end(fs.readFileSync(f));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of ['chrome','webkit']){const b=await(engine==='chrome'?chromium:webkit).launch({headless:true,executablePath:engine==='chrome'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});try{for(const width of [320,360,390,430,1440]){const c=await b.newContext({viewport:{width,height:900}}),p=await c.newPage(),errors=[];await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());p.on('pageerror',e=>errors.push(e.message));balance=1200;const initialWrites=requests.length;await p.goto(origin+'/balans');await p.getByRole('status').filter({hasText:'Kartlar yoxlanılır…'}).waitFor();const input=p.getByLabel('Başqa məbləğ',{exact:true}),presets=p.locator('.shop-presets button'),preview=p.locator('.shop-topup-preview span'),next=p.getByRole('button',{name:/^Bu kartla davam et/});await presets.first().waitFor();eq(await p.locator('.shop-wallet-hero').evaluate(n=>getComputedStyle(n).backgroundImage.includes('/assets/wallet/balance-gold.png')),true);eq(await p.locator('#balansi-artir + .wallet-topup h2').textContent(),'Ödəniş üsulu');eq(await p.locator('.wallet-method-tile strong').allTextContents(),['Kartdan karta','Apple Pay','Google Pay','M10','Bank kartı','Hesaba köçürmə']);eq(await p.locator('.wallet-method-tile:disabled .wallet-method-badge').allTextContents(),Array(5).fill('Tezliklə'));eq(await p.locator('.wallet-payment-method').evaluate(el=>getComputedStyle(el).borderColor),'rgb(227, 189, 56)');const cards=p.locator('.wallet-bank-choice');await cards.first().waitFor();
 eq(requests.length,initialWrites);eq(await cards.count(),2);eq(await cards.first().getAttribute('aria-pressed'),'true');
 eq(await next.isVisible(),true);eq(await next.textContent(),'Bu kartla davam et · 5.00 ₼');
 const displayedRequests=requests.length,displayedReads=cardReads;
 await p.getByRole('button',{name:'Kartdan karta',exact:true}).click();
 eq(await cards.first().isVisible(),true);eq(cardReads,displayedReads);eq(requests.length,displayedRequests);
 eq(await presets.allTextContents(),['5 ₼','10 ₼','20 ₼','50 ₼','100 ₼']);eq(await input.inputValue(),'');eq(await input.getAttribute('placeholder'),'0,00');eq(await preview.textContent(),'17.00 ₼');
 const secondary=presets.nth(1),rgb=(target,style,pseudo=null)=>target.evaluate((el,[s,p])=>getComputedStyle(el,p).getPropertyValue(s),[style,pseudo]);
 eq(await rgb(secondary,'background-color'),'rgb(11, 11, 11)');eq(await rgb(secondary,'color'),'rgb(255, 255, 255)');
 await secondary.hover();eq(await rgb(secondary,'border-top-color'),'rgb(255, 212, 0)');
 await p.mouse.move(0,0);await presets.first().focus();await p.keyboard.press('Tab');
 eq(await secondary.evaluate(n=>n.matches(':focus-visible')),true);eq(await rgb(secondary,'border-top-color'),'rgb(255, 212, 0)');
 eq(await rgb(presets.first(),'background-color'),'rgb(255, 212, 0)');
 eq(await rgb(input,'background-color'),'rgb(11, 11, 11)');eq(await rgb(input,'color'),'rgb(255, 255, 255)');
 eq(await rgb(input,'color','::placeholder'),'rgb(255, 255, 255)');eq(await rgb(p.locator('.wallet-custom-currency'),'color'),'rgb(255, 255, 255)');
 const faq=p.getByRole('region',{name:'Balans haqqında suallar'}),details=faq.locator('details');
 eq(await details.count(),3);eq(await faq.locator('details[open]').count(),0);
 for(const row of await details.all()){
  const question=row.locator('summary'),answer=row.locator('p');
  eq(await answer.isVisible(),false);await question.click();eq(await answer.isVisible(),true);
  await question.press('Enter');eq(await answer.isVisible(),false);
 }
 eq(await details.last().locator('p').textContent(),'Çeki göndərdikdən sonra təsdiq adətən 5–10 dəqiqə çəkir. İş saatlarımız hər gün 11:00–00:00-dır.');
 eq(await p.getByRole('heading',{name:/^(Balans müraciətləri|Əməliyyat tarixçəsi)$/}).count(),0);
 eq(await p.getByText('Sintetik tarixçə qeydi',{exact:true}).count(),0);
 eq(await faq.getByRole('link',{name:'Ödənişlərim'}).getAttribute('href'),'/profil?tab=odenislerim');
 const operator=p.locator('#customerFooter').getByRole('link',{name:'Operatora yaz',exact:true});
 await operator.waitFor();eq(await operator.getAttribute('href'),'https://wa.me/994515243545');await operator.click({trial:true});
 for(const n of [5,10,20,50,100]){await presets.filter({hasText:new RegExp('^'+n+' ₼$')}).click();eq(await input.inputValue(),'');eq(await preview.textContent(),(12+n).toFixed(2)+' ₼');eq(await p.locator('.shop-presets [aria-pressed=true]').count(),1);}
 for(const [v,sum]of [['1','13.00 ₼'],['500','512.00 ₼'],['5,25','17.25 ₼'],['0.99','—'],['500.01','—'],['-1','—'],['5.123','—'],['5,123','—'],['1e2','—'],['','—'],['1.01','13.01 ₼']]){await input.fill(v);eq(await preview.textContent(),sum,v);eq(await p.locator('.shop-presets [aria-pressed=true]').count(),0);eq(await next.isDisabled(),sum==='—');}
 await presets.first().click();eq(await input.inputValue(),'');eq(await input.getAttribute('aria-invalid'),'false');eq(await preview.textContent(),'17.00 ₼');eq(await p.locator('#topupAmountError').textContent(),'');
 const geometry=await presets.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{y:r.y,left:r.left,right:r.right,h:r.height};}));eq(new Set(geometry.map(r=>r.y)).size,1);eq(geometry.every(r=>r.left>=0&&r.right<=width&&r.h>=44),true);eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(await preview.evaluate(n=>getComputedStyle(n).color),'rgb(122, 236, 168)');
 if(width===390||width===1440)await p.screenshot({path:out+'/'+engine+'-'+width+'.png',fullPage:true});
 await cards.nth(1).click();eq(await cards.nth(1).getAttribute('aria-pressed'),'true');
 await input.fill('20,10');eq(await next.textContent(),'Bu kartla davam et · 20.10 ₼');const before=requests.length;await next.dblclick();await p.getByRole('button',{name:'Balans əlavə et',exact:true}).waitFor();eq(requests.length,before+1);eq(requests.at(-1).amount,'20.10');eq(requests.at(-1).methodId,secondId);eq(await p.getByRole('button',{name:'Balans əlavə et',exact:true}).isDisabled(),true);
 const savedWrites=requests.length;await p.reload();await p.getByRole('button',{name:'Kartı dəyiş',exact:true}).click();
 await cards.first().waitFor();eq(await cards.nth(1).getAttribute('aria-pressed'),'true');eq(requests.length,savedWrites);
 balance=0;await p.evaluate(()=>localStorage.clear());await p.reload();await presets.first().waitFor();await cards.first().waitFor();eq(await preview.textContent(),'5.00 ₼');eq(await input.inputValue(),'');if(width===390||width===1440){
 const beforeFailures=requests.length;
 cardsMode='empty';await p.reload();
 await p.getByText('Hazırda limiti boş olan aktiv ödəniş kartı yoxdur.',{exact:true}).waitFor();
 eq(await next.isDisabled(),true);eq(requests.length,beforeFailures);
 cardsMode='error';await p.getByRole('button',{name:'Kartları yenidən yoxla',exact:true}).click();
 await p.getByText('Kart xidməti müvəqqəti əlçatan deyil.',{exact:true}).waitFor();
 eq(await next.isDisabled(),true);
 cardsMode='ready';await p.getByRole('button',{name:'Kartları yenidən yoxla',exact:true}).click();
 await cards.first().waitFor();eq(await cards.first().getAttribute('aria-pressed'),'true');eq(await next.isEnabled(),true);
 eq(requests.length,beforeFailures);
 }
 eq(errors,[]);await c.close();}}finally{await b.close();}}
 console.log(JSON.stringify({checks,engines:['chrome','webkit'],widths:[320,360,390,430,1440],productionWrites:0,realTopupsCreated:0}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
