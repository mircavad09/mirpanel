import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';import {adminTopupReport} from '../mirpanel-admin/admin-topup-report.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
export async function reportBrowserTests(pool){
 const state=extractAdminState(fs.readFileSync('app.js','utf8'));let writes=0,checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const order=(await pool.query('select p.*,o.order_code from mirpanel_community.epoint_purchases p join public.payment_orders o on o.id=p.order_id where p.paid_at is not null order by p.created_at limit 1')).rows[0];
 const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://local'),p=u.pathname,json=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};try{
  if(req.method!=='GET'){writes++;return json({error:'Read only QA'},403);}
  if(p==='/api/session')return json({csrfToken:'synthetic',role:'admin'});
  if(p==='/api/admin/state')return json({data:state,sha:'synthetic',csrfToken:'synthetic',loadedAt:new Date().toISOString()});
  if(p==='/api/admin/community/shop')return json(u.searchParams.get('only')==='topup-count'?{pending:0,ids:[]}:await adminTopupReport(pool,Object.fromEntries(u.searchParams)));
  if(p==='/api/admin/payment-orders')return json({orders:u.searchParams.get('search')===order.order_code?[{id:order.order_id,orderCode:order.order_code,productTitle:'Synthetic ordinary',planName:'1 aylıq',quantity:1,amount:5,currency:'AZN',status:'reviewing',paymentSource:'epoint',paymentConfirmed:true,paymentMethodLabel:'Apple Pay',createdAt:order.created_at,receiptAvailable:false}]:[],counts:{pending:0},pagination:{total:1,totalPages:1},filters:{products:[],plans:[],methods:[]},statistics:{},permissions:{fields:false,manage:false}});
  if(p.startsWith('/api/'))return json({items:[],methods:[],stories:[],banners:[],managed:true,pending:0});
  const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):'mirpanel-admin/public/'+(p==='/'?'admin.html':p.slice(1));
  if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
 }catch(e){json({error:e.message},e.status||500);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,out='payment-test-artifacts/electronic-report';fs.mkdirSync(out,{recursive:true});
 try{for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true,executablePath:engine===chromium?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});
  try{for(const width of [320,390,430,1440]){const ctx=await browser.newContext({viewport:{width,height:1000}});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
   await p.goto(origin+'/admin.html#balans-muracietleri');const root=p.locator('#communityShopView');await root.getByRole('heading',{name:'Balans və elektron ödənişlər'}).waitFor();await root.locator('[data-method="apple-pay"]').click();await root.getByLabel('Ödəniş məqsədi').selectOption('purchase');await root.getByText('Məhsul alışı',{exact:true}).first().waitFor();
   await p.waitForFunction(()=>{const a=[...document.querySelectorAll('#communityShopView .topupPurpose')];return a.length&&a.every(x=>x.textContent==='Məhsul alışı');});eq(await root.locator('.topupPurpose').filter({hasText:'Balans artırma'}).count(),0);eq(await root.locator('.topupCard button.topupCheck').count(),0);eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await root.getByLabel('Ödəniş məqsədi').selectOption('topup');await p.waitForFunction(()=>{const a=[...document.querySelectorAll('#communityShopView .topupPurpose')];return a.length&&a.every(x=>x.textContent==='Balans artırma');});eq(await root.locator('.topupPurpose').filter({hasText:'Məhsul alışı'}).count(),0);await root.getByLabel('Ödəniş məqsədi').selectOption('all');await root.locator('.topupPurpose').filter({hasText:'Məhsul alışı'}).first().waitFor();
   await p.screenshot({path:out+'/'+engine.name()+'-'+width+'.png',fullPage:true});
   const href='/admin.html?'+new URLSearchParams({paymentOrder:order.order_code,orderId:order.order_id})+'#sifarisler';await p.goto(origin+href);await p.locator('[data-payment-order-id="'+order.order_id+'"] .paymentOrderCardDetails').waitFor();eq(await p.locator('[data-payment-order-id="'+order.order_id+'"] [data-order-toggle]').getAttribute('aria-expanded'),'true');
   eq(errors.filter(e=>!/^\/127\.0\.0\.1:\d+\/api\/admin\/community\/shop\?only=topup-count due to access control checks\.$/.test(e)),[]);await ctx.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 eq(writes,0);console.log(JSON.stringify({browserChecks:checks,engines:['Chromium','WebKit'],widths:[320,390,430,1440],realPayments:0}));
}
