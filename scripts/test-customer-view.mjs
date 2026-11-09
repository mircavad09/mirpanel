// Isolated PostgreSQL + actual admin HTTP server + customer UI, no outgoing mail.
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {readCustomerView} from '../mirpanel-admin/community/customer-view-data.mjs';
import {createCustomerView,CUSTOMER_VIEW_TTL} from '../mirpanel-admin/customer-view.mjs';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT||'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),eq=(a,b)=>{assert.deepEqual(a,b);checks++;};let checks=0,child,upstream,gateServer,browser;
const password=crypto.randomBytes(24).toString('base64url'),key=crypto.randomBytes(32).toString('base64'),secret=crypto.randomBytes(32).toString('base64'),security=createPaymentSecurity({encryptionKey:key,tokenSecret:secret});
const out='outputs/customer-view';fs.mkdirSync(out,{recursive:true});
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private,no-store'});res.end(JSON.stringify(data));};
try{
 for(const name of ['account-panel-migration.sql','payment-history-number-migration.sql','subscriptions-migration.sql','customer-activity-migration.sql','ready-stock-migration.sql'])await f.db.exec(f.db.read('mirpanel-admin/community/'+name));
 await f.db.exec(f.db.read('supabase/migrations/202611100001_topup_rejection_email.sql'));
 await f.pool.query("insert into community_profiles(user_id,display_name) values('a','Sınaq A'),('b','Sınaq B') on conflict do nothing");
 await f.pool.query("insert into wallet_accounts(user_id,cents) values('a',4890),('b',2100) on conflict(user_id) do update set cents=excluded.cents");
 const ids={},deliveries={};
 for(const [i,user]of ['a','b'].entries()){
  const hash=(user==='a'?'a':'b').repeat(64),item={productId:'ordinary',planIndex:0,quantity:1},q=await f.shop.quote({user},[item],hash);
  const purchase=await f.shop.checkout({user},hash,{mode:'wallet',items:[{...item,termsVersion:q.items[0].termsVersion}],requestId:f.id(),consentAccepted:true});
  const id=purchase.orderId,delivery=f.id();ids[user]=id;deliveries[user]=delivery;
  const snap={productId:'ordinary',planId:'month',planName:'1 aylıq',unitPrice:5,quantity:1,amount:5,durationMonths:1,image:'/synthetic.png'};
  await f.pool.query(`update public.payment_orders set product_id='ordinary',plan_name='1 aylıq',product_title=$2,status='approved',checkout_snapshot=$3,completed_at=clock_timestamp(),service_expires_on=current_date+20 where id=$1`,[id,'Sintetik məhsul '+user,snap]);
  await f.pool.query('insert into customer_order_deliveries(id,order_id,line_index,quantity,message_cipher,actor) values($1,$2,0,1,$3,\'synthetic\')',[delivery,id,security.encryptSecret(JSON.stringify({id:delivery,order:id,line:0,message:'Yalnız '+user+' üçün\nİstifadə qaydası',email:user+'@example.test',password:'test-'+user}))]);
 }
 await f.pool.query("update wallet_accounts set cents=case user_id when 'a' then 4890 else 2100 end where user_id in ('a','b')");
 const dependencies={catalog:async()=>f.catalog,security,store:{...f.store,inventorySnapshot:()=>f.rpc('inventory_snapshot')}};
 const before=await f.pool.query("select to_jsonb(p) profile,(select count(*)::int from community_presence) presence from community_profiles p where user_id='a'");
 for(const user of ['a','b']){
  const state=await readCustomerView(f.pool,user,'/api/community/state',dependencies);eq(state.profile.user_id,user);eq(state.profile.balanceCents,user==='a'?4890:2100);
  const list=await readCustomerView(f.pool,user,'/api/payments/my-orders',dependencies);eq(list.orders.map(o=>o.id),[ids[user]]);
  const codes=await readCustomerView(f.pool,user,'/api/payments/my-orders/codes',dependencies);eq(codes.codes.map(c=>c.id),[deliveries[user]]);
  const detail=await readCustomerView(f.pool,user,'/api/payments/my-orders/codes/'+deliveries[user],dependencies);eq(detail.password,'test-'+user);
  await assert.rejects(readCustomerView(f.pool,user,'/api/payments/my-orders/codes/'+deliveries[user==='a'?'b':'a'],dependencies),e=>e.status===404);checks++;
  const subs=await readCustomerView(f.pool,user,'/api/payments/shop/subscriptions',dependencies);eq(subs.subscriptions.length,1);eq(subs.subscriptions[0].days,20);
  const payments=await readCustomerView(f.pool,user,'/api/community/payment-history',dependencies);eq(payments.accountId,user);eq(payments.balance,user==='a'?'4890':'2100');
  for(const p of ['/api/community/profile','/api/community/messages','/api/payments/shop/checkout','/api/payments/shop/renew']){await assert.rejects(readCustomerView(f.pool,user,p,dependencies),e=>e.status===403);checks++;}
 }
 eq((await f.pool.query("select to_jsonb(p) profile,(select count(*)::int from community_presence) presence from community_profiles p where user_id='a'")).rows,before.rows);
 // Expiry, session binding, owner revocation and write denial at HTTP boundary.
 let time=Date.now(),allowed=true;
 const gate=createCustomerView({authorize:async req=>allowed&&req.headers.cookie==='admin=one'?'owner':null,mutation:req=>req.headers['x-csrf-token']==='valid',sessionBinding:req=>req.headers.cookie,open:async(_,id)=>({name:id,memberNumber:1}),read:(_,p)=>({path:p}),json,now:()=>time});
 gateServer=http.createServer(gate);await new Promise(r=>gateServer.listen(0,'127.0.0.1',r));const gateBase='http://127.0.0.1:'+gateServer.address().port;
 const open=async()=>{const r=await fetch(gateBase+'/api/admin/community/customer-view',{method:'POST',headers:{Cookie:'admin=one','x-csrf-token':'valid'},body:JSON.stringify({userId:'a'})});return(await r.json()).url;};
 let view=await open();eq((await fetch(gateBase+view)).status,403);eq((await fetch(gateBase+view,{headers:{Cookie:'admin=one'}})).status,200);
 for(const method of ['POST','PUT','PATCH','DELETE'])eq((await fetch(gateBase+view.replace('/admin/','/api/admin/')+'?path=/api/community/profile',{method,headers:{Cookie:'admin=one'},body:'{}'})).status,403);
 const old=view;view=await open();eq((await fetch(gateBase+old,{headers:{Cookie:'admin=one'}})).status,403);allowed=false;eq((await fetch(gateBase+view,{headers:{Cookie:'admin=one'}})).status,403);allowed=true;time+=CUSTOMER_VIEW_TTL+1;eq((await fetch(gateBase+view,{headers:{Cookie:'admin=one'}})).status,403);
 await new Promise(r=>gateServer.close(r));gateServer=null;
 const sessions=new Map();
 upstream=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/rest/v1/rpc/admin_session_action')){let raw='';for await(const b of req)raw+=b;const p=JSON.parse(raw),k=p.p_hash+':'+p.p_binding;let row=sessions.get(k);if(p.p_action==='revoke'){sessions.delete(k);return json(res,200,null);}if(p.p_action==='create'||p.p_action==='touch'&&row){row={expiresAt:new Date(Date.now()+3600000).toISOString()};sessions.set(k,row);}return json(res,200,row||null);}
  if(req.url.startsWith('/rest/v1/rpc/inventory_snapshot'))return json(res,200,await f.rpc('inventory_snapshot'));
  if(req.url.startsWith('/rest/v1/rpc/consume_payment_rate_limit'))return json(res,200,{allowed:true});
  return json(res,200,[]);
 });await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const up='http://127.0.0.1:'+upstream.address().port,base='http://127.0.0.1:10589';
 const url=new URL('postgres://localhost');Object.assign(url,{hostname:f.connection.host,port:String(f.connection.port),username:f.connection.user,password:f.connection.password||'',pathname:'/'+f.database});
 const code=`import fs from 'node:fs';const native=globalThis.fetch;globalThis.fetch=(u,o)=>String(u?.url||u).startsWith(${JSON.stringify(up)})?native(u,o):String(u?.url||u).includes('/contents/app.js')?Promise.resolve(Response.json({sha:'synthetic',content:fs.readFileSync('app.js').toString('base64')})):Promise.resolve(Response.json({message:'isolated'},{status:401}));await import(${JSON.stringify(new URL('../mirpanel-admin/server.mjs',import.meta.url).href)});`;
 child=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true,env:{...process.env,PORT:'10589',ADMIN_USERNAME:'synthetic-owner',ADMIN_PASSWORD:password,MIRPANEL_GITHUB_TOKEN:'synthetic',SUPABASE_URL:up,SUPABASE_SECRET_KEY:'synthetic',PAYMENT_ENCRYPTION_KEY_B64:key,PAYMENT_TOKEN_SECRET_B64:secret,COOKIE_SECURE:'false',RENDER_EXTERNAL_URL:base,COMMUNITY_OWNER_ENABLED:'true',COMMUNITY_PUBLIC_ENABLED:'true',COMMUNITY_TEST:'true',COMMUNITY_ORIGIN:'http://127.0.0.1:55464',COMMUNITY_DATABASE_URL:url.href,COMMUNITY_AUTH_SECRET:crypto.randomBytes(48).toString('base64url'),COMMUNITY_GOOGLE_CLIENT_ID:'synthetic',COMMUNITY_GOOGLE_CLIENT_SECRET:'synthetic'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',b=>{errors+=String(b);});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('STARTUP_TIMEOUT '+errors)),20000);child.stdout.on('data',b=>{if(String(b).includes('Mirpanel admin:')){clearTimeout(timer);resolve();}});});
 for(const [engine,name]of [[chromium,'chrome'],[webkit,'webkit']]){
  browser=await engine.launch({headless:true,...(name==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  const ctx=await browser.newContext();eq((await ctx.request.post(base+'/api/login',{data:{username:'synthetic-owner',password}})).status(),200);const s=await(await ctx.request.get(base+'/api/session')).json();
  await ctx.route('https://mirpanel.com/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmGQAAAAASUVORK5CYII=','base64')}));
  for(const width of [320,390,430,1440]){
   for(const user of ['a','b']){
    const r=await ctx.request.post(base+'/api/admin/community/customer-view',{data:{userId:user},headers:{'x-csrf-token':s.csrfToken}});eq(r.status(),200);const grant=await r.json();
    const page=await ctx.newPage();await page.setViewportSize({width,height:900});let pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(base+grant.url);await page.locator('.profile-hero h1').waitFor();eq(await page.locator('.profile-hero h1').textContent(),'Sınaq '+user.toUpperCase());
    eq(await page.locator('.profile-avatar').isDisabled(),true);
    eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const tab of ['orders','codes','subscriptions','payments']){
     await page.locator('[data-account-tab="'+tab+'"]').click();
     const target={orders:'.browser-order',codes:'.codes-card',subscriptions:'.subs-card',payments:'.account-payment-list article'}[tab];
     try{await page.locator(target).first().waitFor({timeout:18000});}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true});console.log(JSON.stringify({tab,text:await page.locator('main').textContent(),pageErrors,serverErrors:errors}));throw e;}
     if(tab==='subscriptions'){eq(await page.locator('.subs-renew').first().isDisabled(),true);eq(await page.locator('.subs-image img').first().getAttribute('src'),'https://mirpanel.com/synthetic.png');}
     if(tab==='codes'){await page.getByRole('button',{name:'Göstər',exact:true}).first().click();await page.getByText('Yalnız '+user+' üçün',{exact:false}).waitFor();eq((await page.locator('main').textContent()).includes('test-'+(user==='a'?'b':'a')),false);}
    }
    if(user==='a'){await page.locator('[data-account-tab="subscriptions"]').click();await page.locator('.subs-card').waitFor();await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true});}
    eq(pageErrors,[]);
    for(const path of ['/api/community/profile','/api/community/messages','/api/payments/shop/checkout','/api/payments/shop/renew'])eq((await ctx.request.post(base+grant.url.replace('/admin/','/api/admin/')+'?'+new URLSearchParams({path}),{data:{}})).status(),403);
    await page.close();
   }
  }
  const adminPage=await ctx.newPage();
  await adminPage.route('**/view-button-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><main id="content"></main><script type="module">
   import {renderControlsTab} from '/admin-user-controls.js?v=customer-view-1';
   const call=async(path,data)=>{if(path.startsWith('/user-controls'))return {identity:{id:'a',email:'a@example.test',password_login:false,emailVerified:true}};const r=await fetch('/api/admin/community'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-csrf-token':${JSON.stringify(s.csrfToken)}},body:data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error);return v;};
   await renderControlsTab({content:document.querySelector('main'),tab:'other',selected:{user:{id:'a',name:'Sınaq A',memberNumber:1002}},call,valid:()=>true});
  </script>`}));
  await adminPage.goto(base+'/view-button-fixture');const popupEvent=adminPage.waitForEvent('popup');await adminPage.getByRole('button',{name:'İstifadəçi gözündən bax',exact:true}).click();const popup=await popupEvent;await popup.locator('.profile-hero h1').waitFor();eq(await popup.locator('.profile-hero h1').textContent(),'Sınaq A');eq(await popup.evaluate(()=>window.opener===null),true);await popup.close();await adminPage.close();
  const audits=(await f.pool.query("select actor_id,target_id,details from community_audit where action='customer-view' order by id desc limit 1")).rows;eq([audits[0].actor_id,audits[0].target_id,audits[0].details.readOnly],['owner','a',true]);
  // No CSRF and employee/customer/anonymous sessions cannot open a view.
  eq((await ctx.request.post(base+'/api/admin/community/customer-view',{data:{userId:'a'}})).status(),403);
  await ctx.clearCookies();eq((await ctx.request.post(base+'/api/admin/community/customer-view',{data:{userId:'a'}})).status(),403);
  await ctx.close();await browser.close();browser=null;
 }
 eq((await f.pool.query("select to_jsonb(p) profile,(select count(*)::int from community_presence) presence from community_profiles p where user_id='a'")).rows,before.rows);
 eq((await f.pool.query('select count(*)::int n from session')).rows[0].n,0);
 console.log(JSON.stringify({checks,result:'PASS',engines:['Chrome','WebKit'],widths:[320,390,430,1440],database:'isolated',mailSent:0}));
}finally{await browser?.close();child?.kill();if(upstream)await new Promise(r=>upstream.close(r));if(gateServer)await new Promise(r=>gateServer.close(r));await f.close();}
