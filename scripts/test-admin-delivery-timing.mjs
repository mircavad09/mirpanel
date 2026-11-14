import assert from 'node:assert/strict';import crypto from 'node:crypto';import http from 'node:http';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
let allowed=true,mutations=0;
const api=createPaymentSystem({config:{supabaseUrl:'https://synthetic.invalid',supabaseSecretKey:'synthetic-only',receiptsBucket:'synthetic',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},store:{},mailer:{},
 json:(r,s,b,h={})=>{r.writeHead(s,{'Content-Type':'application/json',...h});r.end(JSON.stringify(b));},readBody:async r=>{let body='';for await(const part of r)body+=part;return JSON.parse(body);},
 requireAuth:()=>true,requireMutationAuth:()=>true,readyStockAllowed:()=>allowed,actorName:'synthetic-admin',
 customerDelivery:async(security,actor,id,input,{onTiming})=>{if(input)mutations++;onTiming({connection:1,lock:2,snapshot:3,validation:4,persist:5,commit:6,total:21,queries:6});return {status:'completed',lines:[{index:0,remaining:0}]};}});
const server=http.createServer((req,res)=>void api.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const url='http://127.0.0.1:'+server.address().port+'/api/admin/payment-orders/'+crypto.randomUUID()+'/delivery';
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);const t=r.headers.get('server-timing');for(const s of ['connection','lock','snapshot','validation','persist','commit','total'])assert(t.includes('delivery_'+s+';dur='));assert(!t.includes('queries'));assert.equal((await r.json()).status,'completed');
 allowed=false;assert.equal((await fetch(url,{method:'POST',body:'{}'})).status,403);assert.equal(mutations,1);
 console.log('PASS delivery HTTP: owner permission retained; stage timing returned after server confirmation, no credentials in metrics.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
