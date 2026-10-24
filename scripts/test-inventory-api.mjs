import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {createPaymentStore} from '../mirpanel-admin/payment-store.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
const config={supabaseUrl:'https://inventory.invalid',supabaseSecretKey:'isolated-fixture',receiptsBucket:'fixture',inventoryEnabled:true,encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:['https://fixture.invalid']};
let checks=0,rows=[],writes=0,reserveArgs;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const products=[{id:'chatgpt',title:'Fixture',stockEnabled:true,stock:999,plans:[{price:5,label:'1 aylıq'}]},{id:'ordinary',plans:[{price:5,label:'1 aylıq'}]},{id:'planstock',plans:[{price:5,label:'1 aylıq'}]}];
const security=createPaymentSecurity(config);
const reservationCache=new Map();const store={rateLimit:async()=>({allowed:true}),inventorySnapshot:async()=>rows,setInventory:async(...args)=>{writes++;return {ok:true,args};},reserve:async args=>{if(reservationCache.has(args.idempotencyKey))return reservationCache.get(args.idempotencyKey);const product=products.find(p=>p.id===args.productId),raw=rows.find(p=>p.productId===args.productId),plan=inventoryAvailability(product,raw).plans.find(p=>p.planKey===args.planId);if(plan.tracked&&plan.available===0)throw Object.assign(Error('Stokda yoxdur'),{status:409});reserveArgs=args;const result={id:crypto.randomUUID(),expiresAt:new Date(Date.now()+600000).toISOString()};if(plan.tracked){if(raw.scope==='product')raw.available--;else raw.plans.find(p=>p.planKey===args.planId).available--;}reservationCache.set(args.idempotencyKey,result);return result;},rawMethod:async()=>({id:crypto.randomUUID(),provider_name:'ABB',method_type:'bank_card',last4:'4655',encrypted_number:security.encryptNumber('4169000000004655')})};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const auth=(req,res)=>{if(req.headers['x-fixture-role']==='admin')return true;json(res,req.headers['x-fixture-role']?403:401,{error:'Denied'});return false;};
const readBody=async req=>{let s='';for await(const c of req)s+=c;return JSON.parse(s||'{}');};
const api=createPaymentSystem({config,store,json,readBody,requireAuth:auth,requireMutationAuth:auth,loadCatalog:async()=>({products}),actorName:'isolated-admin',mailer:{start(){}}});
const server=http.createServer(async(req,res)=>{if(!await api.handle(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;config.allowedOrigins.push(base);
const request=(path,role,body,key=crypto.randomUUID())=>fetch(base+path,{method:body?'POST':'GET',headers:{...(role?{'x-fixture-role':role}:{}),'Content-Type':'application/json','X-Idempotency-Key':key,Origin:'https://fixture.invalid'},...(body?{body:JSON.stringify(body)}:{})});
try{
 let r=await request('/api/payments/inventory');eq(r.status,200);let data=await r.json();eq(data.products,products.map(p=>inventoryAvailability(p)));eq(data.products[0].canOrder,false);eq(data.products[1].canOrder,true);
 rows=[{productId:'chatgpt',scope:'product',available:1,version:3,plans:[]},{productId:'planstock',scope:'plan',available:null,version:0,plans:[{planKey:'0',tracked:true,available:2}]}];data=await(await request('/api/payments/inventory')).json();eq(data.products[0].available,1);eq(data.products.find(p=>p.productId==='planstock').available,null);eq(JSON.stringify(data).includes('secret'),false);
 for(const role of [undefined,'employee']){eq((await request('/api/admin/payment-inventory',role)).status,role?403:401);eq((await request('/api/admin/payment-inventory',role,{productId:'chatgpt',available:1,expectedVersion:3,confirm:true})).status,role?403:401);}eq(writes,0);
 eq((await request('/api/admin/payment-inventory','admin')).status,200);
 for(const body of [{productId:'chatgpt',available:-1,expectedVersion:3,confirm:true},{productId:'missing',available:1,expectedVersion:3,confirm:true},{productId:'chatgpt',available:1,expectedVersion:3}])eq((await request('/api/admin/payment-inventory','admin',body)).status,400);
 r=await request('/api/admin/payment-inventory','admin',{productId:'chatgpt',available:1,expectedVersion:3,confirm:true});eq(r.status,200);eq(writes,1);eq((await r.json()).args.slice(0,3),['chatgpt',1,'isolated-admin']);
 for(const productId of ['chatgpt','ordinary']){eq((await request('/api/payments/reservations',undefined,{methodId:crypto.randomUUID(),checkoutKey:crypto.randomUUID(),productId,planIndex:0,quantity:99})).status,200);eq(reserveArgs.requireStock,productId==='chatgpt');eq(reserveArgs.amount,5);}
 const reserveProduct=(productId,planIndex=0)=>request('/api/payments/reservations',undefined,{methodId:crypto.randomUUID(),checkoutKey:crypto.randomUUID(),productId,planIndex});
 rows[0].available=0;reserveArgs=null;eq((await reserveProduct('chatgpt')).status,409);eq(reserveArgs,null);
 products[2].plans.push({price:9,label:'3 aylıq'},{price:10,active:false});rows[1].plans=[{planKey:'0',tracked:true,available:0},{planKey:'1',tracked:true,available:1}];eq((await reserveProduct('planstock',0)).status,409);eq((await reserveProduct('planstock',1)).status,200);eq(reserveArgs.planId,'1');eq((await reserveProduct('planstock',2)).status,409);rows[1].plans[1].available=0;eq((await reserveProduct('planstock',1)).status,409);
 products.push({id:'future',stockEnabled:true,plans:[{price:3}]});rows.push({productId:'future',scope:'product',available:0});eq((await reserveProduct('future')).status,409);rows[2].available=1;eq((await reserveProduct('future')).status,200);eq(reserveArgs.productId,'future');
 const again=await request('/api/payments/reservations',undefined,{methodId:reserveArgs.methodId,checkoutKey:reserveArgs.checkoutKey,productId:'future',planIndex:0},reserveArgs.idempotencyKey);eq(again.status,200);eq((await again.json()).reservationId,reservationCache.get(reserveArgs.idempotencyKey).id);
 const savedFetch=globalThis.fetch;try{globalThis.fetch=async(url,init)=>{eq(new URL(url).pathname,'/rest/v1/rpc/inventory_reserve_payment');eq(JSON.parse(init.body).p_require_stock,true);return Response.json({id:crypto.randomUUID()});};await createPaymentStore(config).reserve({...reserveArgs,requireStock:true});}finally{globalThis.fetch=savedFetch;}
 config.inventoryEnabled=false;eq((await request('/api/payments/inventory')).status,503);eq((await request('/api/admin/payment-inventory','admin')).status,503);await assert.rejects(()=>createPaymentStore(config).reserve({...reserveArgs,requireStock:true}),e=>e.status===503);checks++;
 console.log(JSON.stringify({ok:true,checks,unauthenticated:401,employee:403,noCmsCounterFallback:true,productionWrites:0}));
}finally{await new Promise(r=>server.close(r));}
