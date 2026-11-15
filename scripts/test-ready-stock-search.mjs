import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {searchReadyStock} from '../mirpanel-admin/community/ready-stock-search.mjs';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
const f=await shopFixture(),security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
try {
 for(const name of ['ready-stock-migration.sql','netflix-room-stock.sql'])await f.db.exec(f.db.read('mirpanel-admin/community/'+name));
 const group=f.id();await f.pool.query("insert into netflix_room_groups(id,fingerprint,account_key,account_cipher,starts_on,ends_on,created_by) values($1,'synthetic','synthetic',$2,'2026-01-01','2027-01-01','test')",[group,security.encryptSecret(JSON.stringify({id:group,email:'room@example.test',password:'Synthetic-secret'}))]);
 const rows=Array.from({length:2205},(_,i)=>{const id=f.id();return{id,name:'Otaq '+i,key:String(i),cipher:security.encryptSecret(JSON.stringify({id,pin:i===2204?'0408':'9999'}))};});
 await f.pool.query("insert into netflix_room_units(id,group_id,account_key,room_name,room_key,pin_cipher) select x.id::uuid,$1,'synthetic',x.name,x.key,x.cipher from jsonb_to_recordset($2::jsonb) x(id text,name text,key text,cipher text)",[group,JSON.stringify(rows)]);
 const snapshot=async()=>(await f.pool.query("select md5(jsonb_agg(to_jsonb(r) order by id)::text) hash from netflix_room_units r")).rows[0].hash,before=await snapshot();
 for(const q of ['0408','Otaq 2204'])assert.deepEqual(await searchReadyStock(f.pool,security,{productId:'netflix',q}),{matches:[{kind:'room',id:rows.at(-1).id}]});
 assert.equal((await searchReadyStock(f.pool,security,{productId:'netflix',q:'Synthetic-secret'})).matches.length,2205);
 assert.equal((await searchReadyStock(f.pool,security,{productId:'netflix',q:'not-found-synthetic'})).matches.length,0);
 assert.equal(await snapshot(),before);await assert.rejects(searchReadyStock(f.pool,security,{productId:'netflix',q:'x'.repeat(513)}),{status:400});
}finally{await f.close();}
let invoked=0;const logs=[],oldLog=console.error;console.error=(...args)=>logs.push(args.join(' '));
try{
 const config={supabaseUrl:'https://example.test',supabaseSecretKey:'synthetic',receiptsBucket:'synthetic',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:[]};
 const api=createPaymentSystem({config,store:{},mailer:{},json:(r,status,body)=>Object.assign(r,{status,body}),readBody:async r=>{if(r.broken)throw Error('JSON Synthetic-secret');return r.body;},requireAuth:r=>r.auth,requireMutationAuth:r=>r.auth&&r.csrf,readyStockAllowed:r=>r.admin,readyStockOwnerAllowed:r=>r.owner,loadCatalog:async()=>({products:[{id:'netflix'}]}),searchReadyStock:async()=>{invoked++;return{matches:[]};}});
 const run=async changes=>{const req={url:'/api/admin/payment-ready-stock/search',method:'POST',headers:{},auth:true,csrf:true,admin:true,owner:true,body:{productId:'netflix',q:'Synthetic-secret'},...changes},res={setHeader(){}};await api.handle(req,res);return res;};
 await run({auth:false});await run({csrf:false});assert.equal(invoked,0);
 assert.equal((await run({admin:false})).status,403);assert.equal((await run({owner:false})).status,403);assert.equal((await run({method:'GET'})).status,405);assert.equal((await run({broken:true})).status,400);assert.equal((await run({body:null})).status,400);assert.equal(invoked,0);
 assert.equal((await run({})).status,200);assert.equal(invoked,1);assert.ok(!logs.join('').includes('Synthetic-secret'));
}finally{console.error=oldLog;}
console.log(JSON.stringify({all2205Rows:true,readOnly:true,pinZeros:true,passwordIdsOnly:true,authCsrfOwnerGate:true,noSearchTextLogged:true,passed:true}));
