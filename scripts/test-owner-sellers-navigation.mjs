// Full owner HTML + actual CMS/menu scripts; isolated DB/mail and HTTP identity.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {shopFixture} from './shop-test-fixture.mjs';
import {createSellerRouting,ensureSellerRouting} from '../mirpanel-admin/community/seller-routing.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const f=await shopFixture(),{pool}=f,security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
await ensureSellerRouting(pool);let fail=false,sends=0;
f.catalog.products[0].title='YouTube Premium';f.catalog.products[0].image='/fixture-product.svg';f.catalog.products[0].plans.push({...f.catalog.products[0].plans[0],id:'annual',label:'12 ay'});f.catalog.products[1].title='Dizayn xidməti';f.catalog.products[1].image='/fixture-product.svg';
const activeSellers=[crypto.randomUUID(),crypto.randomUUID()];for(const [i,id]of activeSellers.entries())await pool.query('insert into routing_sellers(id,name,email,user_id,active) values($1,$2,$3,$4,true)',[id,i?'Vəli':'Əli',i?'b@example.test':'a@example.test',i?'b':'a']);
const router=createSellerRouting({pool,security,loadCatalog:async()=>f.catalog,origin:'https://mirpanel.com',send:async()=>{sends++;if(fail)throw Object.assign(Error('Synthetic failure'),{deliveryDisposition:'failed',deliveryCode:'SYNTHETIC_SEND_FAILED'});return{id:'synthetic-'+sends};}});
const state=extractAdminState(fs.readFileSync('app.js','utf8')),out='payment-test-artifacts/owner-sellers';fs.mkdirSync(out,{recursive:true});
let posts=0,checks=0,failRequest=false,emptyMode=false;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://local'),p=url.pathname,json=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};try{
 if(p==='/api/session')return json({csrfToken:'synthetic',role:'admin'});
 if(p==='/api/admin/state')return json({data:state,sha:'synthetic',csrfToken:'synthetic',loadedAt:new Date().toISOString()});
 if(p==='/api/admin/community/sellers'){
  if(!req.headers.cookie?.includes('qa_owner=1'))return json({error:'Yalnız admin üçün.'},403);
  let input=null;if(req.method==='POST'){posts++;let raw='';for await(const b of req)raw+=b;input=JSON.parse(raw);if(failRequest)return json({error:'Sınaq: göndəriş bağlantısı alınmadı'},503);}
  const result=await router.admin(input,'synthetic-owner');if(!input){if(emptyMode){result.sellers=[];result.invitations=[];}result.tasks=['open','claimed','completed','needs_review'].map((state,i)=>({id:crypto.randomUUID(),order_code:'SINAQ-'+(i+1),product_id:'ordinary',title:'YouTube Premium',plan_name:'1 aylıq',quantity:1,state,seller_id:activeSellers[0],seller_name:'Əli',created_at:'2026-11-24T08:00:00Z',claimed_at:state==='claimed'?'2026-11-24T08:05:00Z':null,completed_at:state==='completed'?'2026-11-24T08:10:00Z':null}));}return json(result);
 }
 if(p==='/api/admin/community/shop')return json({pending:0,topups:[]});
 if(p==='/api/admin/community/dashboard')return json({users:0,orders:0,walletCents:0});
 if(p==='/api/admin/payment-orders')return json({orders:[],counts:{pending:0},pagination:{total:0,totalPages:1}});
 if(p.startsWith('/api/'))return json({items:[],methods:[],stories:[],banners:[],managed:true});
 if(p==='/fixture-product.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" rx="8" fill="#d20b1c"/><path d="M40 18v28l24-14z" fill="white"/></svg>');}
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):'mirpanel-admin/public/'+(p==='/'?'admin.html':p.slice(1));
 if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
 }catch(e){json({error:e.message},e.status||500);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){
 const b=await engine.launch({headless:true,executablePath:engine===chromium?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});
 try{for(const width of [320,390,430,1440]){
  const ctx=await b.newContext({viewport:{width,height:1000}});await ctx.addCookies([{name:'qa_owner',value:'1',url:origin}]);await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const p=await ctx.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));const sellers=p.locator('#sellersView');
  emptyMode=true;await p.goto(origin+'/admin.html#saticilar');await sellers.getByText('Hələ satıcı əlavə edilməyib',{exact:true}).waitFor();emptyMode=false;await sellers.getByRole('button',{name:'↻ Siyahını yenilə',exact:true}).click();await sellers.getByRole('heading',{name:'Əli',exact:true}).waitFor();eq(await p.title(),'Satıcılar | MirPanel idarə paneli');eq(await sellers.getByRole('link',{name:'Satıcı panelini aç'}).getAttribute('href'),'https://mirpanel.com/satici');
  eq(await sellers.locator('.sellerAssignment').count(),0);await sellers.getByRole('button',{name:'+ Satıcı əlavə et',exact:true}).first().click();
  let dialog=p.getByRole('dialog');eq(await dialog.getByLabel('E-poçt ünvanı',{exact:true}).isEditable(),true);
  const name='İzolə Satıcı '+engine.name()+width,email='owner.test.'+engine.name()+width+'@gmail.com';await dialog.getByLabel('Satıcının adı',{exact:true}).fill(name);await dialog.getByLabel('E-poçt ünvanı',{exact:true}).fill(email);
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/'+engine.name()+'-'+width+'-invite.png'});
  failRequest=true;await dialog.getByRole('button',{name:'Dəvət göndər',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'göndəriş bağlantısı alınmadı'}).waitFor();eq(await dialog.getByLabel('E-poçt ünvanı',{exact:true}).inputValue(),email);failRequest=false;
  const writes=posts;await dialog.getByRole('button',{name:'Dəvət göndər',exact:true}).dblclick();await dialog.waitFor({state:'hidden'});eq(posts,writes+1);
  const row=(await router.admin()).sellers.find(s=>s.email===email);assert.ok(row);eq((await pool.query('select count(*)::int n from seller_invitations where seller_id=$1',[row.id])).rows[0].n,1);
  await sellers.getByRole('button',{name:'+ Satıcı əlavə et',exact:true}).first().click();dialog=p.getByRole('dialog');await dialog.getByLabel('Satıcının adı',{exact:true}).fill(name);await dialog.getByLabel('E-poçt ünvanı',{exact:true}).fill(email);await dialog.getByRole('button',{name:'Dəvət göndər',exact:true}).click();await dialog.waitFor({state:'hidden'});eq((await pool.query('select count(*)::int n from seller_invitations where seller_id=$1',[row.id])).rows[0].n,1);
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/'+engine.name()+'-'+width+'-sellers.png',fullPage:true});
  await sellers.locator('[data-seller-tab="products"]').click();const form=sellers.locator('.sellerAssignment');await form.getByRole('button',{name:'YouTube Premium',exact:true}).click();
  await form.getByLabel('Paket',{exact:true}).selectOption({label:'1 aylıq'});const choices=form.locator('.sellerChoiceGrid');
  for(const id of activeSellers)await choices.locator('input[value="'+id+'"]').check();await form.getByRole('checkbox',{name:'Yeni sifarişləri bu satıcılara göndər',exact:true}).check();await form.getByRole('button',{name:'Seçimi yadda saxla'}).click();await sellers.getByRole('status').filter({hasText:'yenidən yoxlanıldı'}).waitFor();eq((await router.admin()).members.filter(x=>x.product_id==='ordinary'&&x.plan_key==='0').map(x=>x.seller_id).sort(),[...activeSellers].sort());
  await form.getByLabel('Paket',{exact:true}).selectOption({label:'12 ay'});eq(await form.getByRole('checkbox',{name:'Yeni sifarişləri bu satıcılara göndər',exact:true}).isChecked(),false);eq(await form.locator('.sellerChoiceGrid input:checked').count(),0);
  await form.getByRole('button',{name:'Dizayn xidməti',exact:true}).click();eq(await form.getByLabel('Paket',{exact:true}).locator('option').count(),1);eq(await form.locator('.sellerChoiceGrid input:checked').count(),0);
  await form.getByLabel('1. Məhsul seç',{exact:true}).fill('YouTube');eq(await form.locator('.sellerProduct').count(),1);await form.getByRole('button',{name:'YouTube Premium',exact:true}).click();eq(await form.locator('.sellerChoiceGrid input:checked').count(),2);eq(await choices.locator('input[value="'+row.id+'"]').isDisabled(),true);
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/'+engine.name()+'-'+width+'-products.png',fullPage:true});
  await p.reload();await sellers.getByRole('button',{name:'+ Satıcı əlavə et',exact:true}).first().waitFor();await sellers.locator('[data-seller-tab="products"]').click();eq(await sellers.locator('.sellerChoiceGrid input:checked').count(),2);
  await sellers.locator('[data-seller-tab="orders"]').click();for(const text of ['Gözləyən','İcrada','Tamamlanan','Problemli']){await sellers.getByRole('button',{name:text,exact:true}).click();eq(await sellers.locator('.sellerCard').count(),1);eq(await sellers.locator('.sellerCard .sellerBadge').textContent(),text);}await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/'+engine.name()+'-'+width+'-orders.png',fullPage:true});
  eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(errors.filter(e=>!(e.startsWith('/127.0.0.1:')&&(e.endsWith('/api/admin/community/shop?only=topup-count due to access control checks.')||e.endsWith('/api/admin/payment-inventory due to access control checks.')))),[]);
  await ctx.clearCookies();eq(await p.evaluate(async()=> (await fetch('/api/admin/community/sellers')).status),403);
  await ctx.close();
 }}finally{await b.close();}
}
await router.drainMail();await router.drainMail();fail=true;const requestId=crypto.randomUUID(),input={action:'invite',name:'Failure fixture',email:'failure.fixture@gmail.com',requestId};await router.admin(input,'owner');await router.drainMail();let d=await router.admin();eq(d.invitations.find(i=>i.id===requestId).mail_state,'failed');
await Promise.all([router.admin({action:'retryInvite',id:requestId},'owner'),router.admin({action:'retryInvite',id:requestId},'owner')]);eq(Number((await pool.query('select count(*) n from seller_mail where invitation_id=$1',[requestId])).rows[0].n),1);
eq((await router.admin()).invitations.find(i=>i.id===requestId).mail_state,'queued');
await pool.query("update seller_invitations set expires_at=now()-interval '1 minute' where id=$1",[requestId]);const newRequest=crypto.randomUUID();await router.admin({...input,requestId:newRequest},'owner');await router.admin({...input,requestId:newRequest},'owner');eq(Number((await pool.query('select count(*) n from routing_sellers where email=$1',[input.email])).rows[0].n),1);eq(Number((await pool.query('select count(*) n from seller_invitations where seller_id=(select id from routing_sellers where email=$1)',[input.email])).rows[0].n),2);
console.log(JSON.stringify({checks,fullCmsMenu:true,isolatedOnly:true,realInvitations:0,realOrders:0}));
}finally{await new Promise(r=>server.close(r));await f.close();}
