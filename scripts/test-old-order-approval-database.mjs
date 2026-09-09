import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { createTestDatabase } from "./test-postgres-adapter.mjs";

if (process.env.MIRPANEL_REAL_TEST !== "1") throw new Error("REAL_TEST_DATABASE_REQUIRED");
const db = await createTestDatabase();
const sql = (name) => fs.readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const q = async (text, values = []) => (await db.query(text, values)).rows;
const uid = () => crypto.randomUUID();
const migrations = [
  "202608070001_payment_system","202608080001_payment_checkout_reservations",
  "202608090001_order_history_and_expiry","202608090002_payment_costs_and_profit",
  "202608090003_payment_method_capacity_and_admin","202608100001_calendar_reports_and_cost_backfill",
  "202608150001_payment_usage_day_and_method_soft_delete","202609010001_payment_method_activation_policy",
  "202609020001_disable_payment_method_restore","202609020004_numeric_payment_order_codes",
  "202609030001_filtered_order_finance_methods","202609020006_four_active_payment_methods",
  "202609020007_payment_method_bank_slot_policy","202609030002_payment_method_status_queue_regression",
  "202609050001_reservation_slot_rebalance","202609060001_capacity_aware_payment_reservations",
  "202609090001_old_order_approval_limit_isolation"
];

const makeOrder = async ({ methodId, dayOffset, code }) => {
  const reservationId = uid();
  const orderId = uid();
  const idem = uid();
  await q(`insert into payment_reservations(id,method_id,product_id,plan_id,amount,idempotency_key,checkout_key,status,expires_at,created_at,usage_day)
    values($1,$2,'fixture','0',10,$3,$4,'reviewing',now()+interval '1 hour',
      ((payment_baku_date()+$5::integer)::timestamp+time '12:00') at time zone 'Asia/Baku',payment_baku_date()+$5::integer)`,
    [reservationId,methodId,idem,uid(),dayOffset]);
  await q(`insert into payment_orders(id,order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,
      receipt_bucket,receipt_path,receipt_mime,receipt_size,receipt_sha256,status,consent_accepted,created_at)
    values($1,$2,$3,$4,'fixture','Test məhsul','0','1 aylıq',10,'private',$5,'image/jpeg',4,$6,'reviewing',true,
      ((payment_baku_date()+$7::integer)::timestamp+time '12:01') at time zone 'Asia/Baku')`,
    [orderId,code,reservationId,methodId,`old-approval/${orderId}.jpg`,"a".repeat(64),dayOffset]);
  return { orderId, reservationId };
};

try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);");
  for (const name of migrations) await db.exec(sql(name));
  assert.equal(await db.connectionProof(),12);

  const methodId=uid();
  await q("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit,active) values($1,'old-day-test','Test Bank','Test Bank','bank_card','1234','fixture',1,2,true)",[methodId]);
  await q("insert into payment_plan_costs(product_id,plan_id,cost_amount) values('fixture','0',4)");
  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date()-2,2),($1,payment_baku_date(),2)",[methodId]);

  const old=await makeOrder({methodId,dayOffset:-2,code:'19001'});
  const oldResult=(await q("select approve_payment_order_v7($1,1,'test') value",[old.orderId]))[0].value;
  assert.equal(oldResult.limitCounted,false,"old order must bypass card capacity");
  const oldCounters=await q("select counter_date,confirmed_count from payment_method_daily_counters where method_id=$1 order by counter_date",[methodId]);
  assert.deepEqual(oldCounters.map(x=>Number(x.confirmed_count)),[2,2],"old approval must mutate neither old nor current counter");
  const oldRow=(await q("select status,payment_baku_date(completed_at)=payment_baku_date() completed_today,sale_price_snapshot,cost_price_snapshot,profit_snapshot from payment_orders where id=$1",[old.orderId]))[0];
  assert.equal(oldRow.status,'approved');
  assert.equal(oldRow.completed_today,true,"old order must appear in today's completed report");
  assert.equal(Number(oldRow.sale_price_snapshot),10);
  assert.equal(Number(oldRow.cost_price_snapshot),4);
  assert.equal(Number(oldRow.profit_snapshot),6);
  assert.equal((await q("select status from payment_reservations where id=$1",[old.reservationId]))[0].status,'completed');

  const midnight=await makeOrder({methodId,dayOffset:-1,code:'19002'});
  await q("update payment_reservations set created_at=((payment_baku_date()-1)::timestamp+time '23:59') at time zone 'Asia/Baku' where id=$1",[midnight.reservationId]);
  await q("update payment_orders set created_at=((payment_baku_date()-1)::timestamp+time '23:59') at time zone 'Asia/Baku' where id=$1",[midnight.orderId]);
  const midnightResult=(await q("select approve_payment_order_v7($1,1,'test') value",[midnight.orderId]))[0].value;
  assert.equal(midnightResult.limitCounted,false,"23:59 Baku order approved after midnight is an old order");

  await q("update payment_method_daily_counters set confirmed_count=1 where method_id=$1 and counter_date=payment_baku_date()",[methodId]);
  const current=await makeOrder({methodId,dayOffset:0,code:'19003'});
  const currentResult=(await q("select approve_payment_order_v7($1,1,'test') value",[current.orderId]))[0].value;
  assert.equal(currentResult.limitCounted,true,"same-day order must consume capacity");
  assert.equal(Number((await q("select confirmed_count from payment_method_daily_counters where method_id=$1 and counter_date=payment_baku_date()",[methodId]))[0].confirmed_count),2);

  const parallelMethod=uid();
  await q("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit,active) values($1,'parallel-test','Parallel Bank','Parallel Bank','bank_card','5678','fixture',2,20,true)",[parallelMethod]);
  const parallel=await makeOrder({methodId:parallelMethod,dayOffset:0,code:'19004'});
  const replies=await Promise.all(Array.from({length:12},()=>q("select approve_payment_order_v7($1,1,'parallel-test') value",[parallel.orderId])));
  const values=replies.map(rows=>rows[0].value);
  assert.equal(values.filter(v=>v.idempotent===false).length,1);
  assert.equal(values.filter(v=>v.idempotent===true).length,11);
  assert.equal(Number((await q("select confirmed_count from payment_method_daily_counters where method_id=$1 and counter_date=payment_baku_date()",[parallelMethod]))[0].confirmed_count),1);
  assert.equal(Number((await q("select count(*) count from payment_audit_log where entity_id=$1 and action='order.approved'",[parallel.orderId]))[0].count),1);

  console.log(JSON.stringify({ok:true,engine:'Supabase PostgreSQL',oldOrderLimitCounted:false,oldAndCurrentCountersUnchanged:true,
    completedToday:true,financeSnapshots:true,baku2359Boundary:true,sameDayLimitCounted:true,parallelAttempts:12,appliedOnce:1,idempotentReplays:11,auditRows:1,syntheticOnly:true}));
} finally { await db.close(); }
