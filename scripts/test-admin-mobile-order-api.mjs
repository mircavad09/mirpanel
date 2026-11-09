import assert from 'node:assert/strict';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';

const id='12345678-1234-4234-8234-000000000001';
const calls=[];
let lookupFails=false;
const admin=req=>req.headers.role==='admin';
const json=(res,status,body)=>Object.assign(res,{status,body});
const authorize=(req,res)=>{if(req.headers.role)return true;json(res,401,{});return false;};
const system=createPaymentSystem({
 config:{supabaseUrl:'https://fixture.invalid',supabaseSecretKey:'fixture',receiptsBucket:'fixture',
  encryptionKey:Buffer.alloc(32,7).toString('base64'),tokenSecret:Buffer.alloc(32,9).toString('base64')},
 json,requireAuth:authorize,requireMutationAuth:authorize,readyStockAllowed:admin,loadCatalog:async()=>({products:[]}),
 actorName:'synthetic-admin',mailer:{},readBody:async req=>req.body,
 store:{
  listOrders:async()=>({orders:[{id,status:'completed',paymentSource:'wallet'}]}),
  getOrder:async()=>({id,duration_months:1}),
  approveOrder:async(...args)=>{calls.push(['approve',...args]);return {status:'approved'};}
 },
 pendingDeliveries:async()=>[id],
 orderCustomers:async ids=>{calls.push(['metadata',...ids]);if(lookupFails)throw Error('Synthetic lookup unavailable');return [{id,name:'Sintetik müştəri',memberNumber:1022}];},
 customerDelivery:async(_security,actor,orderId,body)=>{calls.push(['delivery',actor,orderId,body]);return {status:'completed'};}
});
const base='/api/admin/payment-orders';
async function request(url,role,method='GET',body){
 const res={setHeader(){}};
 assert.equal(await system.handle({url,headers:{role},method,body},res),true);
 return res;
}
const desktop=await request(base+'?tab=all','admin');
assert.equal(desktop.body.orders[0].customerName,undefined);
assert.equal(calls.length,0);
const mobile=await request(base+'?tab=all&includeCustomer=true','admin');
assert.equal(mobile.body.orders[0].customerNumber,1022);
assert.equal(mobile.body.orders[0].deliveryPending,true);
const pending=await request(base+'?tab=pending&pendingStage=payment','admin');
assert.equal(pending.body.orders[0].customerName,'Sintetik müştəri');
assert.equal((await request(base+'?tab=all&includeCustomer=true','operator')).body.orders[0].customerName,undefined);
assert.equal((await request(base+'?tab=all&includeCustomer=true')).status,401);
assert.deepEqual(calls,[['metadata',id],['metadata',id]]);
lookupFails=true;
assert.equal((await request(base+'?tab=all&includeCustomer=true','admin')).status,200);
assert.equal((await request(base+'/'+id+'/approve','admin','POST',{})).body.status,'completed');
const body={requestId:'22222222-2222-4222-8222-222222222222',line:1,quantity:1,message:'Sintetik'};
assert.equal((await request(base+'/'+id+'/delivery','operator','POST',body)).status,403);
assert.equal((await request(base+'/'+id+'/delivery','admin','POST',body)).body.status,'completed');
assert.deepEqual(calls.slice(-2),[['approve',id,1,'synthetic-admin'],['delivery','synthetic-admin',id,body]]);
console.log('PASS: admin-only mobile display metadata; desktop, approval and delivery contracts unchanged.');
