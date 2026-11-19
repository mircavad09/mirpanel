import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {shopFixture} from './shop-test-fixture.mjs';
import {startEpointCheckout,readEpointCheckout,epointMethods} from '../mirpanel-admin/epoint-checkout.mjs';
import {acceptEpointResult,reconcileEpoint} from '../mirpanel-admin/epoint-reconcile.mjs';
import {verifyEpointResult} from '../mirpanel-admin/epoint-result.mjs';
import {walletMap} from '../mirpanel-admin/epoint-api.mjs';
const env={EPOINT_PUBLIC_KEY:'test-public',EPOINT_PRIVATE_KEY:'test-private',
 EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true',
 EPOINT_GOOGLE_PAY_ENABLED:'true',EPOINT_M10_ENABLED:'true',EPOINT_BIRBANK_ENABLED:'true'};
assert.deepEqual(walletMap({'8':'Portmanat','9':'M10','10':'BirBank'}),{m10:'9',birbank:'10'});
assert.equal(epointMethods({...env,EPOINT_APPLE_DOMAIN_VERIFIED:'false'})['apple-pay'],false);
const f=await shopFixture();
try{
 const pool=f.pool;
 await pool.query(await readFile(new URL('../mirpanel-admin/community/payment-history-number-migration.sql',import.meta.url),'utf8'));
 let balance=0;
 const actualBalance=async()=>Number((await pool.query("select cents from mirpanel_community.wallet_accounts where user_id='a'")).rows[0]?.cents||0);
 for(const method of ['apple-pay','google-pay','m10','birbank']){
  const id=randomUUID(),transaction='te_'+id,amount=199,widget=method.endsWith('-pay');
  let creates=0,checks=0,providerStatus='new',bad=null,drop=false;
  const send=async(url,options)=>{
   const encoded=options.body.get('data'),p=JSON.parse(Buffer.from(encoded,'base64'));
   assert.equal(options.method,'POST');
   assert.equal(options.body.get('signature'),createHash('sha1').update(env.EPOINT_PRIVATE_KEY+encoded+env.EPOINT_PRIVATE_KEY).digest('base64'));
   assert.equal(p.public_key,env.EPOINT_PUBLIC_KEY);
   if(url.endsWith('/wallet/status'))return Response.json({'9':'M10','10':'BirBank'});
   if(url.endsWith('/get-status')){
    checks++;assert.equal(p.transaction,transaction);
    if(drop)throw Error('Synthetic transport outage');
    return Response.json({status:providerStatus,code:bad==='code'?'100':'000',operation_code:'100',amount:bad==='amount'?2.99:1.99,
     currency:bad==='currency'?'USD':'AZN',order_id:bad==='order'?'wrong':'mp_ep_'+id,
     transaction:bad==='transaction'?'wrong':transaction});
   }
   creates++;assert.equal(p.order_id,'mp_ep_'+id);
   assert.equal(Number(p.amount),1.99);
   if(widget){
    assert.equal(url,'https://epoint.az/api/1/token/widget');
    return Response.json({status:'success',widget_url:'https://epoint.az/api/1/token/widget/test'});
   }
   assert.equal(url,'https://epoint.az/api/1/wallet/payment');
   assert.equal(p.currency,'AZN');assert.equal(p.wallet_id,method==='m10'?'9':'10');
   return Response.json({status:'success',transaction,redirect_url:'https://epoint.az/wallet/checkout/test'});
  };
  const opts={env,send},input={requestId:id,amount:'1.99',method};
  await startEpointCheckout(pool,'a',input,opts);
  await startEpointCheckout(pool,'a',input,opts);
  assert.equal(creates,1);
  await assert.rejects(startEpointCheckout(pool,'b',input,opts),{status:409});
  await assert.rejects(readEpointCheckout(pool,'b',id),{status:404});
  const callback=(status='success',extra={})=>{
   const data=Buffer.from(JSON.stringify({order_id:'mp_ep_'+id,transaction,status,operation_code:'100',currency:'AZN',amount:'1.99',...extra})).toString('base64');
   return verifyEpointResult(Buffer.from(JSON.stringify({data,signature:createHash('sha1').update(env.EPOINT_PRIVATE_KEY+data+env.EPOINT_PRIVATE_KEY).digest('base64')})),'application/json',env.EPOINT_PRIVATE_KEY);
  };
  assert.throws(()=>callback('success',{currency:'USD'}),{status:409});
  await assert.rejects(acceptEpointResult(pool,callback('success',{amount:'2.99'}),opts),{status:409});
  await acceptEpointResult(pool,callback(),opts);assert.equal(await actualBalance(),balance); // Browser/callback success cannot overrule "new".
  assert.equal((await readEpointCheckout(pool,'a',id)).status,'pending');
  providerStatus='success';
  for(bad of ['amount','currency','order','transaction','code'])await assert.rejects(acceptEpointResult(pool,callback(),opts),{status:409});
  bad=null;drop=true;await assert.rejects(acceptEpointResult(pool,callback(),opts));
  assert.equal(await actualBalance(),balance);
  assert((await pool.query('select check_failures from mirpanel_community.epoint_checkout_requests where id=$1',[id])).rows[0].check_failures>0);
  drop=false;
  await Promise.all(Array.from({length:8},()=>acceptEpointResult(pool,callback(),opts)));
  balance+=amount;assert.equal(await actualBalance(),balance);
  const status=await readEpointCheckout(pool,'a',id);
  assert.deepEqual(status,{status:'success',cents:199,balanceCents:balance});
  await acceptEpointResult(pool,callback(),opts);
  await reconcileEpoint(pool,id,{...opts,user:'a',force:true});
  assert.equal(await actualBalance(),balance);
  assert.equal(creates,1);assert(checks>=7);
  console.log('PASS '+method+': exact endpoint/signature, owner, pending, wrong values, outage recovery, 8 parallel callbacks and one credit');
 }
 const count=(await pool.query("select count(*)::int n from mirpanel_community.wallet_ledger where kind='topup_credit'")).rows[0].n;
 assert.equal(count,4);
 // A bound provider transaction can recover via status without a browser callback.
 const id=randomUUID(),transaction='te_recover_'+id;
 const send=async(url,o)=>{
  if(url.endsWith('wallet/status'))return Response.json({'9':'M10'});
  if(url.endsWith('wallet/payment'))return Response.json({status:'success',transaction,redirect_url:'https://epoint.az/checkout/recovery'});
  return Response.json({status:'failed',code:'180',transaction,amount:'1.00',operation_code:'100',currency:'AZN'});
 };
 await startEpointCheckout(pool,'a',{requestId:id,amount:'1',method:'m10'},{env,send});
 await reconcileEpoint(pool,id,{env,send,force:true});
 assert.equal((await readEpointCheckout(pool,'a',id)).status,'failed');
 assert.equal((await readEpointCheckout(pool,'a',id)).cancelled,true);assert.equal(await actualBalance(),balance);
 console.log('PASS provider failure does not credit; no real Epoint calls');
}finally{await f.close();}
