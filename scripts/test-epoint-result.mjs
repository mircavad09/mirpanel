import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {newEpointOrderId,verifyEpointResult,registerEpointWalletIntent,settleEpointResult} from '../mirpanel-admin/epoint-result.mjs';
import {onRequest as returnPage} from '../functions/odenis/epoint/[[path]].js';
import {onRequest as callbackProxy} from '../functions/api/payments/epoint/result.js';

const key='isolated-test-key',form='application/x-www-form-urlencoded';
const order_id=newEpointOrderId(),transaction='te_isolated_1';
const value={order_id,transaction,amount:'4.99',status:'success',operation_code:'100'};
function signed(payload,secret=key){
 const data=Buffer.from(JSON.stringify(payload)).toString('base64');
 const signature=createHash('sha1').update(secret+data+secret).digest('base64');
 return Buffer.from(new URLSearchParams({data,signature}).toString());
}
const parse=payload=>verifyEpointResult(signed(payload),form,key);
assert.throws(()=>verifyEpointResult(signed(value,'wrong'),form,key),{status:401});
assert.throws(()=>verifyEpointResult(signed(value),form,''),{status:503});
assert.throws(()=>verifyEpointResult(Buffer.concat([signed(value),Buffer.from('&data=duplicate')]),form,key),{status:400});
assert.throws(()=>parse({...value,operation_code:'001'}),{status:422});
assert.throws(()=>parse({...value,currency:'USD'}),{status:409});
assert.throws(()=>parse({...value,amount:'4.999'}),{status:400});
assert.throws(()=>parse({...value,order_id:'mp_ep_'+'-'.repeat(36)}),{status:404});
for(const state of ['ugurlu','ugursuz']){
 const r=returnPage({request:new Request('https://mirpanel.com/odenis/epoint/'+state+'?status=success&amount=9999&x=<script>')});
 assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/no-store/);
 assert.doesNotMatch(await r.text(),/9999|<script>/);
}
assert.equal((await callbackProxy({request:new Request('https://mirpanel.com/api/payments/epoint/result')})).status,405);

const f=await shopFixture();
try{
 const {pool}=f;
 await assert.rejects(settleEpointResult(pool,parse(value)),{status:404});
 const input={orderId:order_id,userId:'a',cents:499,transaction};
 await registerEpointWalletIntent(pool,input);
 await registerEpointWalletIntent(pool,input);
 await assert.rejects(registerEpointWalletIntent(pool,{...input,userId:'b'}),{status:409});
 await assert.rejects(registerEpointWalletIntent(pool,{...input,orderId:newEpointOrderId()}),{code:'23505'});
 await settleEpointResult(pool,parse({...value,status:'failed'}));
 const balance=async()=>Number((await pool.query("select cents from mirpanel_community.wallet_accounts where user_id='a'")).rows[0]?.cents||0);
 assert.equal(await balance(),0);
 await assert.rejects(settleEpointResult(pool,parse({...value,amount:'5.00'})),{status:409});
 await assert.rejects(settleEpointResult(pool,parse({...value,transaction:'te_wrong'})),{status:409});
 await Promise.all(Array.from({length:8},()=>settleEpointResult(pool,parse(value))));
 await settleEpointResult(pool,parse({...value,status:'failed'}));
 await settleEpointResult(pool,parse({...value,status:'returned'}));
 assert.equal(await balance(),499);
 const {rows:[row]}=await pool.query("select count(*)::int n from mirpanel_community.wallet_ledger where user_id='a' and kind='topup_credit'");
 assert.equal(row.n,1);
 assert.equal((await pool.query('select status from mirpanel_community.epoint_wallet_intents')).rows[0].status,'success');
 console.log('PASS: exact signed payload, rejected mismatch, return pages, 8 concurrent deliveries, one wallet credit, no live Epoint calls.');
}finally{await f.close();}
