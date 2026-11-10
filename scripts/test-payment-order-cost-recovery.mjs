import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery,adminDeliveryCompletions} from '../mirpanel-admin/community/order-delivery.mjs';
import {reportOrderFinance} from '../mirpanel-admin/payment-order-report.mjs';
import {durationStatistics} from '../mirpanel-admin/payment-order-duration.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const paymentConfig={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig});
const {pool,shop,id}=f;
const buyer={user:'a'},owner='a'.repeat(64);
const security=createPaymentSecurity(paymentConfig);
const checkout=async items=>{
  const quote=await shop.quote(buyer,items,owner);
  return (await shop.checkout(buyer,owner,{items:items.map((item,i)=>({...item,termsVersion:quote.items[i].termsVersion})),
    mode:'wallet',requestId:id(),consentAccepted:true})).orderId;
};
const get=async orderId=>(await pool.query('select * from payment_orders where id=$1',[orderId])).rows[0];
const deliver=(orderId,line,quantity)=>adminDelivery(pool,security,'test',orderId,{requestId:id(),line,quantity,message:'Synthetic'});
const item=(productId,quantity=1)=>({productId,planIndex:0,quantity});
try{
  await pool.query("insert into wallet_accounts(user_id,cents) values('a',10000)");
  const historical=await checkout([item('ordinary',2)]);
  const estimated=await checkout([item('unlimited')]);
  const missing=await checkout([item('ordinary')]);
  for(const [order,quantity] of [[historical,2],[estimated,1],[missing,1]])await deliver(order,0,quantity);
  await pool.query("update payment_orders set created_at='2026-10-05 19:50:00+00' where id=any($1)",[[historical,estimated]]);
  await pool.query("update customer_order_deliveries set delivered_at='2026-10-05 20:05:00+00' where order_id=any($1)",[[historical,estimated]]);
  await pool.query("update payment_orders set checkout_snapshot=jsonb_set(checkout_snapshot,'{items,0,sourcePlanKey}',to_jsonb('removed-plan'::text)) where id=$1",[missing]);
  await pool.query("insert into payment_plan_costs(product_id,plan_id,cost_amount,updated_at) values ('ordinary','0',1.25,'2026-10-01'),('unlimited','0',0,'2026-10-07')");
  await f.db.exec(f.db.read('supabase/migrations/202611100010_payment_order_cost_recovery.sql'));
  const ledger=async()=> (await pool.query('select count(*) as n, sum(cents) as total from wallet_ledger')).rows[0];
  const before=await ledger();
  const backfill=async()=>{
    const preview=await f.rpc('payment_cost_backfill_preview');
    return f.rpc('backfill_payment_order_cost_snapshots',[preview.matchedCount,preview.digest,'test']);
  };
  assert.deepEqual(await backfill(),{updatedCount:2,historicalCount:1,estimatedCount:1,partialCount:0,missingCount:1});
  assert.equal((await backfill()).updatedCount,0);
  assert.deepEqual(await ledger(),before);
  assert.equal((await get(historical)).cost_price_snapshot,'2.50');
  assert.equal((await get(historical)).cost_source,'backfilled_historical_cost');
  assert.equal((await get(estimated)).cost_price_snapshot,'0.00');
  assert.equal((await get(estimated)).cost_source,'backfilled_current_cost');
  assert.equal((await get(missing)).cost_price_snapshot,null);

  const cart=await checkout([item('ordinary',2),item('unlimited')]);
  await f.rpc('save_payment_plan_costs',[JSON.stringify([{productId:'ordinary',planId:'0',cost:4.75}]),'test']);
  assert.equal((await get(cart)).cost_price_snapshot,'2.50');
  await deliver(cart,0,2);
  await deliver(cart,1,1);
  const current=reportOrderFinance(await get(cart));
  assert.equal(current.profit_snapshot,'13.50');
  assert.equal(current.estimated_cost,false);
  const partial=reportOrderFinance({...await get(cart),fulfillment_cancellation:{lines:[{index:0,quantity:1}]}},500);
  assert.equal(partial.sale_price_snapshot,'11.00');
  assert.equal(partial.cost_price_snapshot,'1.25');
  assert.equal(partial.profit_snapshot,'9.75');

  const dates=new Map((await adminDeliveryCompletions(pool,{ids:[historical,estimated,missing,cart]})).map(row=>[row.id,row.completedAt]));
  assert.equal(dates.get(historical),'2026-10-05T20:05:00.000Z');
  const rows=await Promise.all([historical,estimated,missing,cart].map(async id=>reportOrderFinance({...await get(id),status:'completed',completed_at:dates.get(id)})));
  const report=durationStatistics(rows,{completeCosts:true,includeMethods:true});
  assert.equal(report.count,4);
  assert.equal(report.revenue,'37.00');
  assert.equal(report.cost,'5.00');
  assert.equal(report.profit,null);
  assert.equal(report.missingCostCount,1);
  assert.equal(report.estimatedCostCount,1);
  assert.equal(report.days.find(day=>day.date==='2026-10-06').profit,'13.50');
  assert.equal(report.paymentMethods[0].label,'MirPanel balansı');
  console.log('PASS: wallet completion, multi-item quantities, immutable checkout cost, Baku completion date, historical/estimated/zero/missing, refunds and idempotent backfill without wallet writes');
}finally{await f.close();}
