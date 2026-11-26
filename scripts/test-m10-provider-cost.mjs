import assert from 'node:assert/strict';import fs from 'node:fs';
import {shopFixture} from './shop-test-fixture.mjs';import {ensureEpointPurchases} from '../mirpanel-admin/epoint-purchase.mjs';
import {finance,summarize,tariffFee} from '../mirpanel-admin/admin-topup-report.mjs';
const f=await shopFixture();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await ensureEpointPurchases(f.pool);
 // Recreate exactly the historical Apple-only check, then migrate twice.
 await f.pool.query("alter table epoint_purchases drop constraint epoint_purchase_fee_method;alter table epoint_purchases add check(method='apple-pay' or fee_basis_points=0)");
 const old=(await f.pool.query("select pg_get_constraintdef(oid) d from pg_constraint where conrelid='epoint_purchases'::regclass and contype='c'")).rows;eq(old.some(x=>x.d==="CHECK (((method = 'apple-pay'::text) OR (fee_basis_points = 0)))"),true);
 const migration=fs.readFileSync('mirpanel-admin/community/epoint-purchase.sql','utf8');await f.pool.query(migration);await f.pool.query(migration);
 const after=(await f.pool.query("select conname,pg_get_constraintdef(oid) d from pg_constraint where conrelid='epoint_purchases'::regclass and contype='c'")).rows;
 eq(after.some(x=>x.d==="CHECK (((method = 'apple-pay'::text) OR (fee_basis_points = 0)))"),false);eq(after.filter(x=>x.conname==='epoint_purchase_fee_method').length,1);eq(after.some(x=>x.d.includes('fee_basis_points = ANY')),true);
 const tariffs=fs.readFileSync('mirpanel-admin/community/topup-finance.sql','utf8');await f.pool.query(tariffs);await f.pool.query(tariffs);
 const rate=(await f.pool.query("select method,basis_points,effective_at::text from topup_fee_tariffs where method='m10'")).rows;eq(rate.length,1);eq(rate[0].basis_points,300);
 eq((await f.pool.query("select count(*)::int n from topup_fee_tariffs where method='m10' and effective_at<='2026-11-26T20:00:00Z'")).rows[0].n,0);
 for(const purpose of ['topup','purchase'])for(const cents of [100,199,599,1000]){
  const row=finance({method:'m10',purpose,gross_cents:cents,credited_cents:purpose==='topup'?cents:0,payment_confirmed:true,settled_at:'2026-11-27T01:00:00Z',provider_transaction:'synthetic',basis_points:300,refund_cents:0,fee_refund_cents:0});
  eq(row.gross_cents,cents);eq(row.fee_cents,tariffFee(cents,300));eq(row.net_cents,cents-tariffFee(cents,300));eq(row.credited_cents,purpose==='topup'?cents:0);
  const actual=finance({...row,actual_fee_cents:2});eq(actual.fee_cents,2);eq(actual.fee_basis,'actual');
 }
 const rows=[100,199].map(cents=>finance({purpose:'topup',gross_cents:cents,credited_cents:cents,basis_points:300}));eq(summarize(rows).estimatedFeeCents,9);eq(summarize(rows).grossCents,299);
 console.log(JSON.stringify({checks,scope:'local isolated database and integral-cent reporting; no live money'}));
}finally{await f.close();}
