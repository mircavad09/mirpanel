// Full owner HTML + actual CMS/menu scripts; isolated DB/mail and HTTP identity.
import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {shopFixture} from './shop-test-fixture.mjs';
import {createSellerRouting,ensureSellerRouting} from '../mirpanel-admin/community/seller-routing.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const f=await shopFixture(),{pool}=f,security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
await ensureSellerRouting(pool);let fail=false,sends=0;
const router=createSellerRouting({pool,security,loadCatalog:async()=>f.catalog,origin:'https://mirpanel.com',send:async()=>{sends++;if(fail)throw Object.assign(Error('Synthetic failure'),{deliveryDisposition:'failed',deliveryCode:'SYNTHETIC_SEND_FAILED'});return{id:'synthetic-'+sends};}});
const state=extractAdminState(fs.readFileSync('app.js','utf8')),out='payment-test-artifacts/owner-sellers';fs.mkdirSync(out,{recursive:true});
let posts=0,checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://local'),p=url.pathname,json=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};try{
 if(p==='/api/session')return json({csrfToken:'synthetic',role:'admin'});
 if(p==='/api/admin/state')return json({data:state,sha:'synthetic',csrfToken:'synthetic',loadedAt:new Date().toISOString()});
 if(p==='/api/admin/community/sellers'){
  if(!req.headers.cookie?.includes('qa_owner=1'))return json({error:'Yalnız admin üçün.'},403);
  let input=null;if(req.method==='POST'){posts++;let raw='';for await(const b of req)raw+=b;input=JSON.parse(raw);}
  return json(await router.admin(input,'synthetic-owner'));
 }
 if(p==='/api/admin/community/shop')return json({pending:0,topups:[]});
 if(p==='/api/admin/community/dashboard')return json({users:0,orders:0,walletCents:0});
 if(p==='/api/admin/payment-orders')return json({orders:[],counts:{pending:0},pagination:{total:0,totalPages:1}});
 if(p.startsWith('/api/'))return json({items:[],methods:[],stories:[],banners:[],managed:true});
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):'mirpanel-admin/public/'+(p==='/'?'admin.html':p.slice(1));
 if(file.includes('..')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
 }catch(e){json({error:e.message},e.status||500);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){
 const b=await engine.launch({headless:true,executablePath:engine===chromium?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Users/user/AppData/Local/ms-playwright/webkit-2336/Playwright.exe'});
 try{for(const width of [320,390,1440]){
  const ctx=await b.newContext({viewport:{width,height:1000}});await ctx.addCookies([{name:'qa_owner',value:'1',url:origin}]);await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const p=await ctx.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));const sellers=p.locator('#sellersView');
  await p.goto(origin+'/admin.html#saticilar');await p.getByRole('heading',{name:'Satıcı dəvət et',exact:true}).waitFor();eq(await p.title(),'Satıcılar | MirPanel idarə paneli');eq(await sellers.getByLabel('Gmail ünvanı',{exact:true}).isEditable(),true);
  const name='İzolə Satıcı '+engine.name()+width,email='owner.test.'+engine.name()+width+'@gmail.com';await sellers.getByLabel('Ad',{exact:true}).fill(name);await sellers.getByLabel('Gmail ünvanı',{exact:true}).fill(email);
  const writes=posts;await p.getByRole('button',{name:'Dəvət göndər',exact:true}).dblclick();await p.locator('.seller-admin-status').filter({hasText:/növbə/}).waitFor();eq(posts,writes+1);
  const row=(await router.admin()).sellers.find(s=>s.email===email);assert.ok(row);eq((await pool.query('select count(*)::int n from seller_invitations where seller_id=$1',[row.id])).rows[0].n,1);
  await p.getByRole('button',{name:'Dəvət göndər',exact:true}).click();await p.locator('.seller-admin-status').filter({hasText:/növbə/}).waitFor();eq((await pool.query('select count(*)::int n from seller_invitations where seller_id=$1',[row.id])).rows[0].n,1);
  eq(await sellers.getByLabel('Gmail ünvanı',{exact:true}).inputValue(),email);
  const routeForm=p.locator('form').filter({has:p.getByRole('heading',{name:'Məhsul və paket təyinatı',exact:true})});await routeForm.getByRole('button',{name:'Təyinatı saxla'}).click();await p.locator('.seller-admin-status').getByText('Saxlanıldı.',{exact:true}).waitFor();eq((await router.admin()).routes.find(x=>x.product_id==='ordinary').enabled,false);
  await p.waitForLoadState('networkidle');await p.reload();await p.getByRole('heading',{name:'Satıcı dəvət et',exact:true}).waitFor();await p.waitForLoadState('networkidle');eq(await p.getByRole('checkbox',{name:'Satıcılara avtomatik yönləndir',exact:true}).isChecked(),false);
  eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);eq(errors.filter(e=>!/^\/127\.0\.0\.1:\d+\/api\/admin\/community\/shop\?only=topup-count due to access control checks\.$/.test(e)),[]);
  await p.screenshot({path:out+'/'+engine.name()+'-'+width+'.png',fullPage:true});
  await ctx.clearCookies();eq(await p.evaluate(async()=> (await fetch('/api/admin/community/sellers')).status),403);
  await ctx.close();
 }}finally{await b.close();}
}
await router.drainMail();await router.drainMail();fail=true;const requestId=crypto.randomUUID(),input={action:'invite',name:'Failure fixture',email:'failure.fixture@gmail.com',requestId};await router.admin(input,'owner');await router.drainMail();let d=await router.admin();eq(d.invitations.find(i=>i.id===requestId).mail_state,'failed');
await Promise.all([router.admin({action:'retryInvite',id:requestId},'owner'),router.admin({action:'retryInvite',id:requestId},'owner')]);eq(Number((await pool.query('select count(*) n from seller_mail where invitation_id=$1',[requestId])).rows[0].n),1);
eq((await router.admin()).invitations.find(i=>i.id===requestId).mail_state,'queued');
console.log(JSON.stringify({checks,fullCmsMenu:true,isolatedOnly:true,realInvitations:0,realOrders:0}));
}finally{await new Promise(r=>server.close(r));await f.close();}
