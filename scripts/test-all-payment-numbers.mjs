import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {ensureEpointCheckout} from '../mirpanel-admin/epoint-checkout.mjs';
import {balanceNumberPlan,ensureBalanceNumbers} from '../mirpanel-admin/balance-operation-numbers.mjs';
import {paymentHistory} from '../mirpanel-admin/community/account-panel.mjs';
import {adminTopupReport} from '../mirpanel-admin/admin-topup-report.mjs';
import {registerEpointWalletIntent,settleEpointResult} from '../mirpanel-admin/epoint-result.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';process.env.EPOINT_PRODUCT_PURCHASES_ENABLED='true';process.env.EPOINT_PRODUCT_CARD_ENABLED='true';process.env.EPOINT_PUBLIC_KEY='synthetic';process.env.EPOINT_PRIVATE_KEY='synthetic';
const f=await shopFixture({paymentConfig:{epointProductPaymentsEnabled:true,encryptionKey:randomBytes(32).toString('base64'),tokenSecret:randomBytes(32).toString('base64')}}),{pool,id}=f;let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await ensureEpointCheckout(pool);
 const a=id(),b=id(),c=id();
 for(const [ref,at,purpose]of [[a,'2026-11-01','topup'],[b,'2026-11-02','purchase'],[c,'2026-11-03','topup']])await pool.query("insert into epoint_checkout_requests(id,user_id,cents,method,purpose,created_at,state,redirect_url) values($1,'a',599,'google-pay',$2,$3,'ready','https://epoint.az/synthetic')",[ref,purpose,at]);
 // Existing production mapping has an older start; never renumber it.
 await pool.query(`create table balance_operation_numbers(source text,operation_id uuid,number bigint unique,primary key(source,operation_id));
 create table balance_operation_counter(id boolean primary key,next_number bigint);insert into balance_operation_counter values(true,8001);`);
 await pool.query("insert into balance_operation_numbers values('epoint',$1,599),('epoint',$2,8000)",[a,c]);
 const plan=await balanceNumberPlan(pool);eq(plan.map(r=>r.proposed_number),['599','8001','8000']);
 await Promise.all(Array.from({length:5},()=>ensureBalanceNumbers(pool)));
 const rows=async()=>(await pool.query('select operation_id,number::text from balance_operation_numbers order by number')).rows;
 eq((await rows()).map(r=>r.number),['599','8000','8001']);
 const before=await rows();await ensureBalanceNumbers(pool);eq(await rows(),before);
 const fresh=Array.from({length:20},()=>id());await Promise.all(fresh.map((ref,i)=>pool.query("insert into epoint_checkout_requests(id,user_id,cents,method,purpose) values($1,'a',599,$2,$3)",[ref,['card','apple-pay','google-pay','birbank','m10'][i%5],i%2?'topup':'purchase'])));
 const n=await rows();eq(n.length,23);eq(new Set(n.map(x=>x.number)).size,23);eq(n.at(-1).number,'8021');
 await registerEpointWalletIntent(pool,{orderId:'mp_ep_'+a,userId:'a',cents:599,transaction:'synthetic_tx'});
 await Promise.all(Array.from({length:6},()=>settleEpointResult(pool,{id:a,status:'success',transaction:'synthetic_tx',cents:599})));
 eq(await rows(),n);eq((await pool.query("select count(*)::int n from wallet_ledger where kind='topup_credit'")).rows[0].n,1);
 await pool.query("update epoint_checkout_requests set result_status='error',result_code='canceled' where id=$1",[fresh[0]]);eq(await rows(),n);
 const history=await paymentHistory(pool,'a',new URLSearchParams()),report=await adminTopupReport(pool,{});
 for(const ref of [a,c])eq(history.items.find(x=>x.id===ref).number,report.topups.find(x=>x.id===ref).display_number);
 eq(history.items.find(x=>x.id===b).number,'8001');
 eq((await paymentHistory(pool,'b',new URLSearchParams())).items,[]);
 const clone=new pool.constructor({...pool.options,max:1});try{await ensureBalanceNumbers(clone);eq(await rows(),n);}finally{await clone.end();}
 const backup=(await pool.query("select mapping from balance_number_migration_backup where id='all-attempts-v2'")).rows[0].mapping;eq(backup.length,3);
 // A deleted attempt's allocated number remains reserved forever.
 await pool.query('delete from epoint_checkout_requests where id=$1',[fresh[0]]);const newRef=id();await pool.query("insert into epoint_checkout_requests(id,user_id,cents,method) values($1,'a',599,'card')",[newRef]);eq((await rows()).at(-1).number,'8022');
 const reopened=execFileSync(process.execPath,['scripts/test-all-payment-numbers-restart.mjs'],{input:JSON.stringify(f.connection),encoding:'utf8'});eq(JSON.parse(reopened).maximum,'8022');
 const owner='a'.repeat(64),line={productId:'ordinary',planIndex:0,quantity:1};line.termsVersion=(await f.shop.quote({user:'a'},[line],owner)).items[0].termsVersion;
 const purchase=await f.shop.checkout({user:'a'},owner,{items:[line],mode:'epoint',epointMethod:'card',requestId:id(),expectedTotalCents:500,consentAccepted:true});
 const ph=(await paymentHistory(pool,'a',new URLSearchParams())).items.find(r=>r.id===purchase.id),pr=(await adminTopupReport(pool,{id:purchase.id})).topups[0];
 eq(ph.number,pr.display_number);eq(ph.number,'8023');assert.notEqual(ph.number,ph.orderCode);checks++;
 console.log(JSON.stringify({checks,existingNumbersPreserved:true,missingBackfilled:1,parallelInserts:20,realOperations:0}));
}finally{await f.close();}
