import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
import {shopFixture} from './shop-test-fixture.mjs';
import {ensureEpointPurchases} from '../mirpanel-admin/epoint-purchase.mjs';
import {startEpointCheckout} from '../mirpanel-admin/epoint-checkout.mjs';
import {registerEpointWalletIntent,settleEpointResult} from '../mirpanel-admin/epoint-result.mjs';
import {adminTopupReport,topupFilter} from '../mirpanel-admin/admin-topup-report.mjs';
import {reportBrowserTests} from './electronic-report-browser.mjs';
import {recordPaymentReportObservation} from '../mirpanel-admin/electronic-payment-report.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const env={EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic',EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_GOOGLE_PAY_ENABLED:'true',EPOINT_BIRBANK_ENABLED:'true',EPOINT_M10_ENABLED:'true',EPOINT_PRODUCT_PURCHASES_ENABLED:'true'};Object.assign(process.env,env);
const config={epointProductPaymentsEnabled:true,encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig:config}),{pool,shop,id}=f,owner='a'.repeat(64),req={user:'a'},date='2026-11-23T10:00:00Z';let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await ensureEpointPurchases(pool);await pool.query("insert into wallet_accounts(user_id,cents) values('a',5000)");
 const quote=await shop.quote(req,[{productId:'ordinary',planIndex:0,quantity:1}],owner),line={productId:'ordinary',planIndex:0,quantity:1,termsVersion:quote.items[0].termsVersion};
 async function purchase(method,quantity=1,paid=true,when=date){
  const p=await shop.checkout(req,owner,{items:[{...line,quantity}],mode:'epoint',epointMethod:method,requestId:id(),consentAccepted:true,expectedTotalCents:quantity*500});
  const tx='synthetic_'+p.id;
  const send=async url=>Response.json(url.endsWith('/wallet/status')?{'9':'M10','10':'BirBank'}:method.endsWith('-pay')?{status:'success',widget_url:'https://epoint.az/synthetic'}:{transaction:tx,redirect_url:'https://epoint.az/synthetic'});
  await startEpointCheckout(pool,'a',{method,requestId:p.id},{env,send,purchaseId:p.id});
  if(paid)await pool.query('update epoint_checkout_requests set candidate_transaction=$2 where id=$1',[p.id,tx]);
  if(paid)await Promise.all(Array.from({length:8},()=>settleEpointResult(pool,{id:p.id,status:'success',transaction:tx,cents:quantity*500})));
  await pool.query('update epoint_purchases set created_at=$2,paid_at=case when paid_at is null then null else $2::timestamptz end where id=$1',[p.id,when]);return {...p,tx};
 }
 async function topup(method,cents,when=date){const key=id(),tx='topup_'+key;await pool.query("insert into epoint_checkout_requests(id,user_id,cents,state,redirect_url,method,created_at) values($1,'a',$2,'ready','https://epoint.az/synthetic',$3,$4)",[key,cents,method,when]);await registerEpointWalletIntent(pool,{orderId:'mp_ep_'+key,userId:'a',cents,transaction:tx});await Promise.all(Array.from({length:8},()=>settleEpointResult(pool,{id:key,status:'success',transaction:tx,cents})));await pool.query('update epoint_wallet_intents set credited_at=$2 where id=$1',[key,when]);return key;}
 const appleTopup=await topup('apple-pay',1039);const a=await purchase('apple-pay',3),b=await purchase('apple-pay'),pending=await purchase('apple-pay',1,false),google=await purchase('google-pay'),birbank=await purchase('birbank'),m10=await purchase('m10');
 // A subsequent wallet-funded purchase is not a second external payment.
 await shop.checkout(req,owner,{items:[line],mode:'wallet',requestId:id(),consentAccepted:true});
 const apple=await adminTopupReport(pool,{method:'apple-pay'});eq(apple.report.completedCount,3);eq(apple.report.topupCents,1039);eq(apple.report.purchaseCents,2000);eq(apple.report.grossCents,3039);eq(apple.report.calculatedFeeCents,91);eq(apple.report.calculatedNetCents,2948);eq(apple.topups.find(x=>x.id===a.id).payment_success,true);eq(apple.topups.find(x=>x.id===a.id).fulfillment_status,'reviewing');eq(apple.topups.find(x=>x.id===a.id).credited_cents,0);eq(apple.topups.find(x=>x.id===a.id).display_number,null);assert.ok(Number(apple.topups.find(x=>x.id===appleTopup).display_number)>=599);checks++;
 eq((await adminTopupReport(pool,{method:'apple-pay',purpose:'topup'})).report.grossCents,1039);eq((await adminTopupReport(pool,{method:'apple-pay',purpose:'purchase'})).report.grossCents,2000);eq((await adminTopupReport(pool,{method:'apple-pay',purpose:'purchase'})).total,3);
 for(const method of ['google-pay','birbank']){const r=await adminTopupReport(pool,{method});eq(r.report.calculatedFeeCents,15);eq(r.report.purchaseCents,500);}
 eq((await adminTopupReport(pool,{method:'m10'})).report.uncalculatedCount,1);eq((await adminTopupReport(pool,{method:'m10'})).report.calculatedFeeCents,0);
 const pre=await purchase('apple-pay',1,true,'2026-11-22T19:59:59.999Z'),boundary=await purchase('apple-pay',1,true,'2026-11-23T20:00:00Z');
 const day=await adminTopupReport(pool,{method:'apple-pay',period:'range',from:'2026-11-23',to:'2026-11-23'});eq(day.report.grossCents,3039);eq(day.topups.some(x=>x.id===pre.id||x.id===boundary.id),false);eq((await adminTopupReport(pool,{id:pre.id})).report.uncalculatedCount,1);
 // Bank refunds and fee reversals are evidence facts, wallet compensation is a separate ledger credit.
 await pool.query("insert into topup_finance_facts(source,operation_id,event_id,kind,cents,occurred_at,evidence) values('epoint',$1,'actual-fee','fee',40,$2,'Synthetic bank statement'),('epoint',$1,'bank-refund','refund',200,$2,'Synthetic bank refund'),('epoint',$1,'bank-fee-refund','fee_refund',3,$2,'Synthetic bank fee reversal')",[a.id,date]);
 await pool.query("insert into wallet_ledger(actor_id,user_id,request_id,cents,before_cents,after_cents,reason,kind) values('a','a',$1,100,0,100,'Synthetic compensation','purchase_refund')",[a.orderId]);
 const refunded=await adminTopupReport(pool,{id:a.id});eq(refunded.report.refundCents,200);eq(refunded.report.walletCompensationCents,100);eq(refunded.report.feeRefundCents,3);eq(refunded.report.actualFeeCents,40);eq(refunded.report.calculatedFeeCents,45);eq(refunded.report.knownNetCents,1263);eq(refunded.report.calculatedNetCents,1255);eq(refunded.report.completedCount,1);
 const before=(await pool.query('select count(*)::int n,sum(cents)::text cents from wallet_ledger')).rows;await adminTopupReport(pool,{});await adminTopupReport(pool,{});eq((await pool.query('select count(*)::int n,sum(cents)::text cents from wallet_ledger')).rows,before);eq((await pool.query('select fee_cents from epoint_purchases where id=$1',[google.id])).rows[0].fee_cents,0);eq((await pool.query('select count(*)::int n from balance_operation_numbers where operation_id=any($1::uuid[])',[[a.id,b.id,google.id,birbank.id,m10.id]])).rows[0].n,0);
 const evidence={id:appleTopup,transaction:'topup_'+appleTopup,cents:1039,status:'returned',trace:'synthetic-report',observedAt:new Date().toISOString()};await recordPaymentReportObservation(pool,evidence);await recordPaymentReportObservation(pool,evidence);const observed=await adminTopupReport(pool,{id:appleTopup});eq(observed.report.unquantifiedReturnCount,1);eq(observed.report.refundCents,0);eq(observed.report.feeRefundCents,0);eq(observed.report.grossCents,1039);eq((await pool.query('select count(*)::int n,sum(cents)::text cents from wallet_ledger')).rows,before);eq((await pool.query("select count(*)::int n from public.payment_audit_log where action='report.provider_status_observed' and entity_id=$1",[appleTopup])).rows[0].n,1);
 await assert.rejects(f.shop.admin(pool,{id:'a'},{action:'topups',purpose:'purchase'}),{status:403});checks++;assert.throws(()=>topupFilter({purpose:'invalid'}),{status:400});checks++;
 // Duplicate external references are collapsed; separate transactions remain separate.
 const dup=await purchase('apple-pay',3,false);await pool.query('update epoint_checkout_requests set candidate_transaction=$2 where id=$1',[dup.id,a.tx]);const dedup=await adminTopupReport(pool,{id:a.id});eq(dedup.report.completedCount,1);eq(dedup.report.duplicateReferences,1);
 const multiQuote=await shop.quote(req,[line,{productId:'unlimited',planIndex:0,quantity:1}],owner),multiLines=multiQuote.items.map(x=>({productId:x.productId,planIndex:0,quantity:1,termsVersion:x.termsVersion}));
 const multi=await shop.checkout(req,owner,{items:multiLines,mode:'epoint',epointMethod:'apple-pay',requestId:id(),consentAccepted:true,expectedTotalCents:1100}),multiTx='multi_'+multi.id;
 await startEpointCheckout(pool,'a',{method:'apple-pay',requestId:multi.id},{env,purchaseId:multi.id,send:async()=>Response.json({status:'success',widget_url:'https://epoint.az/synthetic'})});await pool.query('update epoint_checkout_requests set candidate_transaction=$2 where id=$1',[multi.id,multiTx]);await settleEpointResult(pool,{id:multi.id,status:'success',transaction:multiTx,cents:1100});const multiReport=await adminTopupReport(pool,{id:multi.id});eq(multiReport.report.grossCents,1100);eq(multiReport.report.completedCount,1);eq(multiReport.report.calculatedFeeCents,33);eq(multiReport.topups[0].credited_cents,0);
 // Totals cover the whole result, not only the current 100-row page.
 await pool.query("insert into epoint_checkout_requests(id,user_id,cents,method) select gen_random_uuid(),'a',100,'m10' from generate_series(1,105)");const first=await adminTopupReport(pool,{}),next=await adminTopupReport(pool,{offset:100});eq(first.topups.length,100);eq(first.report,next.report);eq(first.total,next.total);
 fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync('outputs/electronic-report-fixture.json',JSON.stringify({...day,synthetic:true},null,2));
 console.log(JSON.stringify({checks,realPayments:0,realProviderCalls:0,financialReportWrites:0}));
 if(process.argv.includes('--browser'))await reportBrowserTests(pool);
}finally{await f.close();}
