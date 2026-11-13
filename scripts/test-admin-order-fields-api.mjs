import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';

const config={receiptsBucket:'synthetic',supabaseUrl:'https://fixture.invalid',supabaseSecretKey:'synthetic',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:[]};
const security=createPaymentSecurity(config);
const fields=[{key:'email',label:'E-poçt'},{key:'password',label:'Şifrə',type:'password'}];
const rows=[
 {id:crypto.randomUUID(),checkout_snapshot:{cartVersion:2,items:[{fields,detailsCipher:security.encryptSecret(JSON.stringify({email:'qa@example.test',password:'Synthetic-only'}))}]}},
 {id:crypto.randomUUID(),checkout_snapshot:{}},
 {id:crypto.randomUUID(),checkout_snapshot:{detailsCipher:'invalid-synthetic-cipher'}}
];
let detailReads=0;
const store={
 async listOrders(query,products,{onPageRows}){
  if(query.countsOnly==='true')return {counts:{pending:3,delivery:3}};
  onPageRows?.(rows);
  return {orders:rows.map(({id})=>({id,orderCode:id.slice(0,5)})),counts:{pending:3,delivery:3}};
 },
 async getOrder(){detailReads++;throw Error('Extra order query is forbidden in this test');}
};
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
const authorize=(req,res)=>{if(req.headers['x-role'])return true;json(res,401,{error:'Denied'});return false;};
const system=createPaymentSystem({config,store,json,readBody:async()=>({}),loadCatalog:async()=>({products:[]}),requireAuth:authorize,requireMutationAuth:authorize,readyStockAllowed:req=>req.headers['x-role']==='admin',mailer:{start(){}}});
const server=http.createServer(async(req,res)=>{if(!await system.handle(req,res)){res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const url='http://127.0.0.1:'+server.address().port+'/api/admin/payment-orders?tab=pending&pendingStage=delivery';
 assert.equal((await fetch(url)).status,401);
 const response=await fetch(url,{headers:{'x-role':'admin'}});
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),/no-store/);
 const result=await response.json();
 assert.equal(result.orders[0].fieldLines[0].fields[0].value,'qa@example.test');
 assert.equal(result.orders[0].fieldLines[0].fields[1].value,'Synthetic-only');
 assert.deepEqual(result.orders[1].fieldLines,[{index:0,fields:[]}]);
 assert.match(result.orders[2].fieldError,/açıla bilmədi/);
 assert.equal(detailReads,0);
 assert.ok(!JSON.stringify(result).includes('detailsCipher'));
 const staff=await fetch(url.replace('pendingStage=delivery','pendingStage=payment'),{headers:{'x-role':'staff'}});
 const limited=await staff.json();
 assert.equal(limited.permissions.fields,false);
 assert.ok(limited.orders.every(order=>!Object.hasOwn(order,'fieldLines')&&!Object.hasOwn(order,'fieldError')));
 assert.ok(!JSON.stringify(limited).includes('qa@example.test'));
 const counts=await(await fetch(url+'&countsOnly=true',{headers:{'x-role':'admin'}})).json();
 assert.deepEqual(counts,{counts:{pending:3,delivery:3}});
 console.log('PASS: first list response contains page fields; empty and corrupt snapshots; permissions; no extra order reads; no raw ciphertext');
}finally{await new Promise(resolve=>server.close(resolve));}
