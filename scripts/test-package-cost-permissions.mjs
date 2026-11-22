import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
const auth=(req,res)=>{if(req.headers['x-role'])return true;json(res,401,{error:'Denied'});return false;};
let reads=0;
const system=createPaymentSystem({config:{receiptsBucket:'test',supabaseUrl:'https://fixture.invalid',supabaseSecretKey:'test',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},json,readBody:async()=>({items:[]}),requireAuth:auth,requireMutationAuth:(req,res)=>{if(!auth(req,res))return false;if(req.headers['x-csrf-token']==='test')return true;json(res,403,{error:'CSRF'});return false;},readyStockAllowed:req=>req.headers['x-role']==='admin',store:{async planCosts(){reads++;return [{productId:'synthetic',planId:'stable',costAmount:'1.25'}];}},loadCatalog:async()=>({products:[]}),mailer:{}});
const server=http.createServer(async(req,res)=>{if(!await system.handle(req,res))json(res,404,{});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 const url='http://127.0.0.1:'+server.address().port+'/api/admin/payment-costs';
 for(const method of ['GET','POST']){
  assert.equal((await fetch(url,{method})).status,401);
  assert.equal((await fetch(url,{method,headers:{'x-role':'staff','x-csrf-token':'test'}})).status,403);
 }
 assert.equal(reads,0);
 assert.equal((await fetch(url,{method:'POST',headers:{'x-role':'admin'}})).status,403);
 const res=await fetch(url,{headers:{'x-role':'admin'}});assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/private.*no-store/);assert.equal((await res.json()).rows[0].costAmount,'1.25');assert.equal(reads,1);
 assert.equal((await fetch(url.replace('/admin/','/payments/'))).status,404);
 console.log('PASS cost API: anonymous denied; staff GET/POST denied; CSRF required; admin private/no-store; no public route');
}finally{await new Promise(r=>server.close(r));}
