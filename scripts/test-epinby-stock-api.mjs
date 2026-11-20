import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
const config={supabaseUrl:'https://test.invalid',supabaseSecretKey:'synthetic',receiptsBucket:'synthetic',inventoryEnabled:true,encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:[]};
const security=createPaymentSecurity(config),product={id:'pubg_mobile',plans:[{id:'epinby_3436',price:1.65,supplier:{provider:'epinby',productId:3436,type:'TOPUP',gameId:4,categoryId:223,fields:[{key:'player_id',required:true}]}}]};
let api,mode='missing',reads=0,writes=0;
const store={inventorySnapshot:async()=>[],rateLimit:async()=>({allowed:true})};
const server=http.createServer(async(req,res)=>{if(!await api.handle(req,res)){res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const scenario of ['missing','zero','available','network']){
  mode=scenario;reads=0;
  api=createPaymentSystem({config,store,loadCatalog:async()=>({products:[product]}),mailer:{start(){}},
   json:(res,status,data,headers)=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));},
   supplierPool:async()=>({query:async sql=>{if(!sql.startsWith('select ')){writes++;throw Error('Unexpected DB write');}return {rows:[{api_key_cipher:security.encryptSecret('private-synthetic'),last_status:'confirmed',credential_version:1}]};}}),
   epinbyTransport:async input=>{assert.equal(input.key,'private-synthetic');assert.equal(input.path,'/api/v1/products');reads++;if(mode==='network')throw Error('NETWORK');return {success:true,data:mode==='missing'?[]:[{id:3436,game_id:4,category_id:223,stock_status:mode==='zero'?'FINITE':'INFINITE',stock_count:mode==='zero'?0:null}],meta:{current_page:1,last_page:1,total:mode==='missing'?0:1}};}
  });
  await api.supplierStock.refresh();assert.equal(reads,1,'boot sync works without an admin or customer request');
  const r=await fetch(origin+'/api/payments/inventory');assert.equal(r.status,200);const data=await r.json(),p=data.products[0].plans[0];assert.equal(reads,1,'public reads do not poll supplier again');
  assert.equal(p.supplierStock.intervalMs,60000);assert.equal(p.supplierStock.status,mode==='network'?'unknown':mode==='available'?'available':'out');assert.equal(p.canOrder,mode==='available');assert(!JSON.stringify(data).includes('private-synthetic'));api.supplierStock.stop();
 }
 assert.equal(writes,0);console.log('PASS public inventory boot sync, no admin dependency, shared 60s projection, out/zero/available/network, no API key exposure, no DB writes');
}finally{api?.supplierStock?.stop();server.close();}
