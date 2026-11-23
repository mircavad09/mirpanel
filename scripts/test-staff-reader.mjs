import assert from 'node:assert/strict';
import fs from 'node:fs';import http from 'node:http';import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {shopFixture} from './shop-test-fixture.mjs';
import {makePublicAuth} from '../mirpanel-admin/community/public-auth.mjs';
import {hashPassword} from '../mirpanel-admin/node_modules/better-auth/dist/crypto/password.mjs';
import {staffRole,setStaffRole,staffRead,staffRequest,staffHTML} from '../mirpanel-admin/community/staff-readonly.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture();let server,browser,upstream,child;
const output='outputs/staff-reader';fs.mkdirSync(output,{recursive:true});
try{
 await f.db.exec(f.db.read('mirpanel-admin/community/ready-stock-migration.sql'));
 await f.pool.query("insert into community_profiles(user_id,display_name) values('a','İşçi Sınaq'),('b','Uzun adlı müştəri — sınaq məlumatı') on conflict do nothing");
 await f.pool.query("insert into wallet_accounts(user_id,cents) values('a',5000),('b',12345) on conflict(user_id) do update set cents=excluded.cents");
 const member=(await f.pool.query("select member_number::text n from community_member_numbers where user_id='b'")).rows[0].n;
 const item={productId:'ordinary',planIndex:0,quantity:1},quote=await f.shop.quote({user:'b'},[item],'b'.repeat(64));
 const purchase=await f.shop.checkout({user:'b'},'b'.repeat(64),{mode:'wallet',items:[{...item,termsVersion:quote.items[0].termsVersion}],requestId:f.id(),consentAccepted:true});
 await f.pool.query("update payment_orders set checkout_snapshot=checkout_snapshot||$2::jsonb where id=$1",[purchase.orderId,JSON.stringify({email:'secret-account@example.test',password:'DO-NOT-EXPOSE',pin:'0408',playerId:'PRIVATE'})]);
 const delivery=f.id();await f.pool.query("insert into customer_order_deliveries(id,order_id,line_index,quantity,message_cipher,actor) values($1,$2,0,1,'ENCRYPTED-SECRET','synthetic')",[delivery,purchase.orderId]);
 const before=(await f.pool.query("select cents::text from wallet_accounts where user_id='b'")).rows[0].cents;
 await assert.rejects(staffRead(f.pool,null,'/users'),{status:401});
 await assert.rejects(staffRead(f.pool,'a','/users'),{status:403});
 await assert.rejects(setStaffRole(f.pool,'b',{userId:'a',enabled:true}),{status:403});
 await setStaffRole(f.pool,'owner',{userId:'a',enabled:true});assert(await staffRole(f.pool,'a'));
 for(const q of ['b@example.test',member,'Uzun adlı']){const data=await staffRead(f.pool,'a','/users',new URLSearchParams({q}));assert(data.users.some(u=>u.id==='b'));}
 const result=await staffRead(f.pool,'a','/customer',new URLSearchParams({id:'b'}));
 assert.equal(result.user.balanceCents,before);assert.equal(result.orders.length,1);
 assert.deepEqual(Object.keys(result.user).sort(),['id','name','email','memberNumber','balanceCents'].sort());
 assert.deepEqual(Object.keys(result.orders[0]).sort(),['number','product','package','date','amount','currency','status','lines'].sort());
 assert.equal(result.orders[0].lines[0].package,'1 aylıq');
 assert(!JSON.stringify(result).match(/DO-NOT-EXPOSE|0408|ENCRYPTED-SECRET|secret-account/));
 for(const method of ['POST','PATCH','DELETE','PUT'])await assert.rejects(staffRequest({}, {method},new URL('http://local/api/community/staff/customer')),{status:403});
 for(const route of ['codes','delivery','wallet/credit','admin','password','receipt'])await assert.rejects(staffRequest({}, {method:'GET'},new URL('http://local/api/community/staff/'+route)),{status:403});
 await f.pool.query(`insert into account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values('staff-credential','a','credential','a',$1,now(),now())`,[await hashPassword('Synthetic-only-Staff-729!')]);
 let auth;
 const context={staffRead:async(req,path,query)=>{const s=await auth.api.getSession({headers:new Headers(req.headers)});return staffRead(f.pool,s?.user?.id,path,query);}};
 server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://local');const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(u.pathname==='/api/auth/sign-in/email'){
    let body='';for await(const chunk of req)body+=chunk;const r=await auth.api.signInEmail({body:JSON.parse(body),headers:new Headers(req.headers),asResponse:true});
    res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());
   }
   if(u.pathname.startsWith('/api/community/staff/'))return send(200,await staffRequest(context,req,u));
   if(u.pathname.startsWith('/api/admin/')||u.pathname.startsWith('/api/employee/'))return send(403,{error:'Admin/işçi idarəetmə icazəsi yoxdur.'});
   if(u.pathname==='/profil'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(staffHTML);}
   if(u.pathname.startsWith('/community-assets/')){const name=u.pathname.slice(18);if(!['staff-reader.js','staff-support.js','staff-reader.css'].includes(name))return send(404,{});res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':'text/css'});return res.end(fs.readFileSync('mirpanel-admin/community/public/'+name));}
   return send(404,{});
  }catch(e){send(e.status||503,{error:e.message});}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 auth=makePublicAuth(f.pool,{origin,secret:crypto.randomBytes(48).toString('base64url'),clientId:'synthetic-google',clientSecret:'synthetic-google-secret'},async()=>{}, {enqueue:async()=>{}});
 const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [320,390,430,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage();
  await page.goto(origin+'/profil?tab=isci');await page.getByRole('heading',{name:'İşçi girişi',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'E-poçt',exact:true}).fill('a@example.test');await page.getByLabel('Şifrə',{exact:true}).fill('Synthetic-only-Staff-729!');
  await page.getByRole('button',{name:'İşçi hesabı ilə daxil ol',exact:true}).click();
  await page.getByPlaceholder('Ad, müştəri ID-si və ya e-poçt').waitFor();
  assert(!(await ctx.cookies()).some(c=>c.name==='mirpanel_session')); // No owner admin session.
  await page.getByPlaceholder('Ad, müştəri ID-si və ya e-poçt').fill(member);await page.getByRole('button',{name:'Axtar',exact:true}).click();
  await page.getByRole('button',{name:'Uzun adlı müştəri — sınaq məlumatı',exact:true}).click();
  await page.getByText('Mövcud balans:',{exact:false}).waitFor();await page.screenshot({path:output+'/profile-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'İstifadəçi gözündən bax',exact:true}).click();await page.getByText('Sifariş №',{exact:false}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(!(await page.locator('body').innerText()).includes('DO-NOT-EXPOSE'));
  await page.screenshot({path:output+'/orders-'+width+'.png',fullPage:true});
  for(const route of ['wallet/credit','delivery','users/delete'])assert.equal((await ctx.request.post(origin+'/api/community/staff/'+route,{data:{}})).status(),403);
  if(width===1440){await setStaffRole(f.pool,'owner',{userId:'a',enabled:false});assert.equal((await ctx.request.get(origin+'/api/community/staff/users')).status(),403);await page.getByText('İşçi icazəniz yoxdur və ya ləğv edilib.',{exact:false}).waitFor({timeout:14000});assert.equal(await page.getByText('Sifariş №',{exact:false}).count(),0);}
  await ctx.close();
 }
 // Run the production HTTP router against this disposable DB. All outbound
 // provider calls are replaced; no owner admin login is used for staff reads.
 await setStaffRole(f.pool,'owner',{userId:'a',enabled:true});
 for(const name of ['account-panel-migration.sql','payment-history-number-migration.sql','subscriptions-migration.sql','customer-activity-migration.sql','ready-stock-migration.sql'])await f.db.exec(f.db.read('mirpanel-admin/community/'+name));
 const respond=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 upstream=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/rest/v1/rpc/inventory_snapshot'))return respond(res,200,await f.rpc('inventory_snapshot'));
  return respond(res,200,[]);
 });await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const up='http://127.0.0.1:'+upstream.address().port,base='http://127.0.0.1:10594';
 const url=new URL('postgres://localhost');Object.assign(url,{hostname:f.connection.host,port:String(f.connection.port),username:f.connection.user,password:f.connection.password||'',pathname:'/'+f.database});
 const code=`import fs from 'node:fs';const native=fetch;globalThis.fetch=(u,o)=>String(u?.url||u).startsWith(${JSON.stringify(up)})?native(u,o):String(u?.url||u).includes('/contents/app.js')?Promise.resolve(Response.json({sha:'synthetic',content:fs.readFileSync('app.js').toString('base64')})):Promise.resolve(Response.json({message:'isolated'},{status:401}));await import(${JSON.stringify(new URL('../mirpanel-admin/server.mjs',import.meta.url).href)});`;
 child=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true,env:{...process.env,PORT:'10594',ADMIN_USERNAME:'synthetic-owner',ADMIN_PASSWORD:crypto.randomBytes(24).toString('base64url'),MIRPANEL_GITHUB_TOKEN:'synthetic',SUPABASE_URL:up,SUPABASE_SECRET_KEY:'synthetic',PAYMENT_ENCRYPTION_KEY_B64:crypto.randomBytes(32).toString('base64'),PAYMENT_TOKEN_SECRET_B64:crypto.randomBytes(32).toString('base64'),COOKIE_SECURE:'false',RENDER_EXTERNAL_URL:base,COMMUNITY_OWNER_ENABLED:'true',COMMUNITY_PUBLIC_ENABLED:'true',COMMUNITY_TEST:'true',COMMUNITY_ORIGIN:'http://127.0.0.1:55464',COMMUNITY_DATABASE_URL:url.href,COMMUNITY_AUTH_SECRET:crypto.randomBytes(48).toString('base64url'),COMMUNITY_GOOGLE_CLIENT_ID:'synthetic',COMMUNITY_GOOGLE_CLIENT_SECRET:'synthetic'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',b=>errors+=String(b));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('SERVER_TIMEOUT '+errors)),25000);child.stdout.on('data',b=>{if(String(b).includes('Mirpanel admin:')){clearTimeout(timer);resolve();}});});
 const ctx=await browser.newContext();
 const signed=await ctx.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:'http://127.0.0.1:55464'},data:{email:'a@example.test',password:'Synthetic-only-Staff-729!'}});
 assert.equal(signed.status(),200,await signed.text());
 const listResponse=await ctx.request.get(base+'/api/community/staff/users');assert.equal(listResponse.status(),200,await listResponse.text());
 for(const path of ['/api/admin/community/users','/api/admin/community/users/b/orders/'+purchase.orderId,'/api/admin/users/b/orders/'+purchase.orderId,'/api/admin/community/staff-role','/api/admin/workforce','/admin.html','/employee'])assert.equal((await ctx.request.get(base+path)).status(),403,path);
 for(const path of ['/api/payments/shop/checkout','/api/payments/shop/cancel','/api/payments/shop/topup/submit','/api/admin/community/wallet/credit','/api/admin/community/user-controls','/api/employee/manual-stock/deliver','/api/community/profile','/api/community/staff/customer'])assert.equal((await ctx.request.post(base+path,{data:{}})).status(),403,path);
 await setStaffRole(f.pool,'owner',{userId:'a',enabled:false});assert.equal((await ctx.request.get(base+'/api/community/staff/users')).status(),403);
 await ctx.close();console.log('PASS production server HTTP: independent staff login, own cookie, staff reads, denied admin pages/APIs, checkout/cancel/topup/delivery/profile mutations, role revocation.');
 assert.equal((await f.pool.query("select cents::text from wallet_accounts where user_id='b'")).rows[0].cents,before);
 console.log('PASS real email/password staff login without owner session, search name/ID/email, balance, safe order fields, no secrets, denied mutations, role revocation in open UI, widths 320/390/430/1440. Synthetic local only.');
}finally{child?.kill();await browser?.close();if(upstream)await new Promise(r=>upstream.close(r));if(server)await new Promise(r=>server.close(r));await f.close();}
