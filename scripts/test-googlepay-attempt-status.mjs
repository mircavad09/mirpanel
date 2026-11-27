// Loopback-only database fixture; all provider responses are synthetic.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {shopFixture} from './shop-test-fixture.mjs';
import {startEpointCheckout,leaveEpointPayment,readEpointPayment} from '../mirpanel-admin/epoint-checkout.mjs';
import {reconcileEpoint,acceptEpointResult} from '../mirpanel-admin/epoint-reconcile.mjs';
import {paymentHistory} from '../mirpanel-admin/community/account-panel.mjs';
import {ensureTopupFinance,adminTopupReport} from '../mirpanel-admin/admin-topup-report.mjs';
import {paymentStatus} from '../mirpanel-admin/payment-status.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const env={EPOINT_CHECKOUT_ENABLED:'true',EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic',EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_GOOGLE_PAY_ENABLED:'true',EPOINT_BIRBANK_ENABLED:'true'};
const f=await shopFixture(),{pool,id}=f,states=new Map();let checks=0,creates=0,network=false;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const send=async(url,options)=>{
 if(network)throw Error('Synthetic network failure');
 const p=JSON.parse(Buffer.from(options.body.get('data'),'base64')),ref=p.order_id?.slice(6)||p.transaction?.slice(3);
 if(url.endsWith('wallet/status'))return Response.json({'10':'Birbank'});
 if(url.endsWith('get-status')){const state=states.get(ref)||'new';if(state==='not-found')return Response.json({status:'server_error',message:'record not found'});return Response.json({transaction:'tx_'+ref,order_id:'mp_ep_'+ref,status:state,code:state==='success'?'000':state==='failed'?'005':null,amount:5,currency:'AZN'});}
 creates++;if(url.endsWith('token/payment')){eq(p.currency,'AZN');eq(p.language,'az');return Response.json({status:'success',payment:{merchant_order_id:p.order_id,total:5,transaction:'tx_'+ref,widget_url:'https://epoint.az/synthetic'}});}return Response.json({status:'success',widget_url:'https://epoint.az/synthetic',redirect_url:'https://epoint.az/synthetic',...(url.endsWith('token/widget')?{}:{transaction:'tx_'+ref})});
};
const make=async(method='google-pay',previous)=>{const ref=id();await startEpointCheckout(pool,'a',{requestId:ref,amount:'5.00',method,...(previous?{previousPayment:previous}:{})},{env,send});return ref;};
const history=async ref=>(await paymentHistory(pool,'a',new URLSearchParams())).items.find(r=>r.id===ref);
const bank=async ref=>(await pool.query('select result_status,abandoned_at from epoint_checkout_requests where id=$1',[ref])).rows[0];
const callback=ref=>acceptEpointResult(pool,{id:ref,status:'success',transaction:'tx_'+ref,cents:500,operationCode:'100'},{env,send});
try{
 for(const status of ['server_error','new'])eq(paymentStatus({status}), 'pending');
 eq(paymentStatus({status:'new',abandoned:true}),'failed');eq(paymentStatus({paid:true,abandoned:true}),'success');
 const bound=await make();eq((await pool.query('select candidate_transaction from epoint_checkout_requests where id=$1',[bound])).rows[0].candidate_transaction,'tx_'+bound);
 // A URL-only response is no longer accepted as a newly created Google payment.
 const malformed=id();await assert.rejects(startEpointCheckout(pool,'a',{requestId:malformed,amount:'5.00',method:'google-pay'},{env,send:async()=>Response.json({status:'success',widget_url:'https://epoint.az/synthetic'})}),e=>e.status===503);checks++;
 eq((await bank(malformed)).result_status,'new');states.set(malformed,'not-found');await leaveEpointPayment(pool,'a',malformed,{env,send});eq((await history(malformed)).status,'failed');
 const pending=id();await pool.query("insert into epoint_checkout_requests(id,user_id,cents,state,redirect_url,method) values($1,'a',500,'ready','https://epoint.az/synthetic','google-pay')",[pending]);states.set(pending,'not-found');
 for(let n=0;n<11;n++)await assert.rejects(reconcileEpoint(pool,pending,{env,send,user:'a',force:true}));
 eq((await history(pending)).status,'pending');eq((await bank(pending)).abandoned_at,null);
 // Exceeding the fast polling budget keeps a durable low-frequency check.
 await pool.query("update epoint_checkout_requests set next_check_at=now()-interval '1 second' where id=$1",[pending]);
 await assert.rejects(reconcileEpoint(pool,pending,{env,send}));eq((await bank(pending)).result_status,'new');
 await assert.rejects(leaveEpointPayment(pool,'b',pending,{env,send}),e=>e.status===404);checks++;
 const left=await leaveEpointPayment(pool,'a',pending,{env,send});eq(left.attemptAbandoned,true);eq(left.providerLinkRevoked,false);
 eq(left.status,'pending');eq((await history(pending)).status,'failed');eq((await history(pending)).retryUrl,'/balans?paymentReturn='+pending);
 eq((await readEpointPayment(pool,'a',pending,{env})).widget,undefined);eq((await bank(pending)).result_status,'new');
 // Retry a different method, then the same method. Unique successor serializes two tabs.
 const next=await make('apple-pay',pending);await leaveEpointPayment(pool,'a',next,{env,send});
 const before=creates,again=id(),other=id();
 const attempts=await Promise.allSettled([startEpointCheckout(pool,'a',{requestId:again,amount:'5.00',method:'apple-pay',previousPayment:next},{env,send}),startEpointCheckout(pool,'a',{requestId:other,amount:'5.00',method:'apple-pay',previousPayment:next},{env,send})]);
 eq(attempts.filter(r=>r.status==='fulfilled').length,1);eq(creates,before+1);
 const newest=attempts[0].status==='fulfilled'?again:other;
 eq((await pool.query('select attempt_family from epoint_checkout_requests where id=$1',[newest])).rows[0].attempt_family,pending);
 // Two separate real successes in one retry family: one credit, one review.
 states.set(pending,'success');states.set(newest,'success');
 await Promise.all([callback(pending),callback(newest),callback(pending)]);await callback(newest);
 eq((await pool.query("select count(*)::int n from wallet_ledger where kind='topup_credit'")).rows[0].n,1);
 eq((await pool.query('select count(*)::int n from epoint_checkout_requests where excess_paid_at is not null')).rows[0].n,1);
 eq((await history(pending)).status,'success');eq((await history(newest)).status,'success');
 await assert.rejects(make('google-pay',pending),e=>e.code==='PAYMENT_ALREADY_PAID');checks++;
 const restart=execFileSync(process.execPath,['scripts/test-googlepay-attempt-restart.mjs'],{input:JSON.stringify({connection:f.connection,ids:[pending,newest]}),encoding:'utf8'});eq(JSON.parse(restart).credits,1);
 for(const state of ['failed','canceled','expired']){const ref=await make();states.set(ref,state);await reconcileEpoint(pool,ref,{env,send,force:true});eq((await history(ref)).status,state==='canceled'?'cancelled':'failed');}
 const outage=await make();network=true;await assert.rejects(reconcileEpoint(pool,outage,{env,send,force:true}));network=false;eq((await history(outage)).status,'pending');await leaveEpointPayment(pool,'a',outage,{env,send});eq((await history(outage)).status,'failed');
 // Server-side attempts and finance filters use the same projection.
 await ensureTopupFinance(pool);
 const report=await adminTopupReport(pool,{method:'google-pay',period:'all'});
 eq(report.topups.find(r=>r.id===outage).status,'failed');
 eq(report.topups.find(r=>r.id===pending).status,'completed');
 eq((await paymentHistory(pool,'a',new URLSearchParams({status:'failed',purpose:'topup'}))).items.some(r=>r.id===outage),true);
 eq((await pool.query("select to_regclass('mirpanel_community.epoint_purchases') present")).rows[0].present,null);
 const all=await adminTopupReport(pool,{period:'all'});eq(all.report.completedCount,2);eq(all.report.creditedCents,500);eq(all.report.grossCents,1000);
 console.log(JSON.stringify({checks,syntheticProviderCreates:creates,realPayments:0,realProviderCalls:0,duplicateCredits:0,restart:true}));
}finally{await f.close();}
