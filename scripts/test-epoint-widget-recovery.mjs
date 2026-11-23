import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {startEpointCheckout,readEpointCheckout} from '../mirpanel-admin/epoint-checkout.mjs';
import {acceptEpointResult,reconcileEpoint} from '../mirpanel-admin/epoint-reconcile.mjs';
const env={EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic',EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true'};
const f=await shopFixture();
try{
 const pool=f.pool,id=randomUUID(),transaction='te_synthetic_'+id;let creates=0,checks=0,bad=null,outcome='new';
 const send=async(url,options)=>{
  if(!url.endsWith('/get-status')){creates++;return Response.json({status:'success',widget_url:'https://epoint.az/widget/synthetic'});}
  checks++;const request=JSON.parse(Buffer.from(options.body.get('data'),'base64'));assert.ok(request.transaction===transaction||request.order_id==='mp_ep_'+id);return Response.json({transaction,status:outcome,code:'000',order_id:bad==='order'?'mp_ep_wrong':'mp_ep_'+id,amount:bad==='amount'?'5.90':'6.00',...(bad==='currency'?{currency:'USD'}:{currency:'AZN'})});
 };
 const opts={env,send},due=()=>pool.query("update mirpanel_community.epoint_checkout_requests set next_check_at=clock_timestamp()-interval '1 second' where id=$1",[id]);
 await startEpointCheckout(pool,'a',{requestId:id,amount:'6.00',method:'apple-pay'},opts);
 await reconcileEpoint(pool,id,{...opts,user:'b'});assert.equal(checks,0);
 for(bad of ['order','amount','currency']){await due();await assert.rejects(reconcileEpoint(pool,id,{...opts,user:'a'}),{status:409});assert.equal((await pool.query('select candidate_transaction from mirpanel_community.epoint_checkout_requests where id=$1',[id])).rows[0].candidate_transaction,null);}
 bad=null;await due();await reconcileEpoint(pool,id,{...opts,user:'a'});assert.equal((await readEpointCheckout(pool,'a',id)).status,'pending');
 outcome='success';await due();const before=checks;
 await Promise.all(Array.from({length:8},()=>reconcileEpoint(pool,id,{...opts,user:'a'})));assert.equal(checks,before+1);
 assert.deepEqual(await readEpointCheckout(pool,'a',id),{status:'success',cents:600,balanceCents:600});
 const callback={id,transaction,status:'success',cents:600,operationCode:'100'};
 await Promise.all(Array.from({length:8},()=>acceptEpointResult(pool,callback,opts)));
 const restarted=new pool.constructor({...pool.options,max:1});try{await reconcileEpoint(restarted,id,{...opts,force:true});await reconcileEpoint(restarted,id,{...opts,user:'a'});}finally{await restarted.end();}
 const ledger=await pool.query("select count(*)::int n,sum(cents)::int cents from mirpanel_community.wallet_ledger where request_id=$1 and kind='topup_credit'",[id]);assert.deepEqual(ledger.rows[0],{n:1,cents:600});assert.equal(creates,1);
 // Result screen reports today's wallet, not the historical top-up snapshot.
 await pool.query("update mirpanel_community.wallet_accounts set cents=51 where user_id='a'");assert.equal((await readEpointCheckout(pool,'a',id)).balanceCents,51);
 console.log('PASS: lost callback without browser hint, owner/order/amount/currency checks, 6 AZN gross, bounded parallel lookups, duplicate callbacks, restart, one ledger credit, current wallet');
}finally{await f.close();}
