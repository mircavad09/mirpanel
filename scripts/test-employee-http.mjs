import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';import {employeeFixture} from './employee-http-fixture.mjs';
const f=await employeeFixture();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const owner={Cookie:'fixture_owner=yes','X-CSRF-Token':'fixture-admin-csrf'},password='fixture-worker-password';
async function request(path,{body,headers={}}={}){return fetch(f.base+path,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()}:{} )},body:body?JSON.stringify(body):undefined});}
try{
 eq((await request('/api/employee/dashboard')).status,401);eq((await request('/api/admin/workforce/accounts')).status,401);
 let r=await request('/api/admin/workforce/accounts',{headers:owner,body:{login:'worker',name:'Sınaq işçi',password}});eq(r.status,201);const a=(await r.json()).account;
 eq((await request('/api/employee/login',{body:{login:'worker',password}})).status,401);
 r=await request(`/api/admin/workforce/accounts/${a.id}/start`,{headers:owner,body:{}});eq(r.status,200);
 r=await request('/api/employee/login',{body:{login:'worker',password}});eq(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict/);checks++;
 const headers={Cookie:cookie.split(';')[0]};r=await request('/api/employee/session',{headers});eq(r.status,200);const session=await r.json();eq(session.role,'employee');headers['X-CSRF-Token']=session.csrfToken;
 for(const path of ['/api/admin/workforce/accounts','/api/admin/payment-methods','/api/admin/state','/api/publish','/admin.html','/admin/workforce'])eq((await request(path,{headers})).status,403);
 for(const [path,body] of [['/api/admin/workforce/accounts',{login:'evil',password}],['/api/admin/workforce/stock',{items:[]}],['/api/admin/payment-methods',{}],['/api/publish',{}],['/api/employee/orders/00000000-0000-4000-8000-000000000001/complete',{}],['/api/employee/accounts/'+a.id+'/salary',{}],['/api/employee/audit/delete',{}]]){const r=await request(path,{headers,body});eq(r.status,path.includes('/orders/')?404:403);}
 eq((await request('/api/employee/stock/units',{headers})).status,403);
 eq((await request('/api/employee/logout',{headers:{Cookie:headers.Cookie},body:{}})).status,403);
 const stats=await(await request('/api/employee/dashboard',{headers})).json();eq(stats.totalOrders,0);eq(stats.totalQuantity,0);eq(stats.orderBonusCents,0);
 const product=await(await request('/api/employee/products',{headers})).json();assert.ok(!JSON.stringify(product).includes('password'));checks++;
 r=await request('/api/admin/workforce/stock',{headers:owner,body:{productId:'capcut',planKey:'0',items:Array.from({length:10},(_,i)=>({email:`e${i}@test.invalid`,password:`secret-${i}`}))}});eq(r.status,201);eq((await r.json()).added,10);
 const units=await(await request('/api/admin/workforce/stock/units',{headers:owner})).json();assert.ok(!JSON.stringify(units).includes('secret-'));checks++;
 const plan=(await f.db.query('select id from employee_catalog_plans limit 1')).rows[0].id,order=crypto.randomUUID();
 await f.db.query(`insert into payment_orders(id,order_code,product_id,canonical_plan_id,quantity,customer_name,customer_phone,amount,payment_verified_at) values($1,'HTTP-ROLE','capcut',$2,1,'Fixture','994500000000',5,clock_timestamp())`,[order,plan]);
 eq((await request(`/api/employee/orders/${order}/complete`,{headers,body:{}})).status,403);
 eq((await request(`/api/employee/orders/${order}/verify`,{headers,body:{}})).status,403);
 eq((await request(`/api/employee/orders/${order}/accept`,{headers,body:{}})).status,200);
 eq((await request(`/api/employee/orders/${order}/accept`,{headers,body:{}})).status,409);
 eq((await request('/api/admin/workforce/template',{headers:owner,body:{productId:'capcut',planKey:'0',template:'Salam {{customerName}} — {{code}}'}})).status,200);
 eq((await(await request('/api/admin/workforce/template?productId=capcut&planKey=0',{headers:owner})).json()).template,'Salam {{customerName}} — {{code}}');
 eq((await request('/api/employee/template?productId=capcut&planKey=0',{headers})).status,403);
 const old=crypto.randomUUID();await f.db.query("insert into payment_orders(id,order_code,product_id,created_at) values($1,'OLD-MISSING','capcut','2024-01-01')",[old]);
 const ownerOrders=await(await request('/api/admin/workforce/orders?tab=all',{headers:owner})).json();
 eq(ownerOrders.orders.find(o=>o.id===old).can_fill_legacy,true);eq(ownerOrders.orders.find(o=>o.id===order).can_fill_legacy,false);
 r=await request('/api/admin/workforce/accounts/'+a.id+'/revoke',{headers:owner,body:{}});eq(r.status,200);eq((await request('/api/employee/session',{headers})).status,401);
 const prodServer=fs.readFileSync('mirpanel-admin/server.mjs','utf8');assert.ok(prodServer.includes('employeeSystem.blockAdmin(request,response)'));checks++;
 console.log(JSON.stringify({ok:true,checks,sessionless:401,employeeAdminAccess:403,csrfEnforced:true,sessionRevocation:true,realDataWrites:0},null,2));
}finally{await f.close();}
