import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Isolated PostgreSQL/WASM engine; never connects to Supabase or reads secrets.
const runtime = process.env.MIRPANEL_PGLITE || "payment-test-artifacts/runtime/package/dist/index.js";
const { PGlite } = await import(pathToFileURL(path.resolve(runtime)));
const db = new PGlite();
const base = fs.readFileSync("supabase/migrations/202608070001_payment_system.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/202609020004_numeric_payment_order_codes.sql", "utf8");
const advanceMigration = fs.readFileSync("supabase/migrations/202609020005_advance_order_counter_10001.sql", "utf8");
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
try {
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const name of ["payment_methods", "payment_method_daily_counters", "payment_reservations", "payment_orders", "payment_audit_log"]) {
    const definition = base.match(new RegExp(`create table if not exists public\\.${name} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(definition, name);
    await db.exec(definition);
  }
  await db.exec("alter table payment_reservations add checkout_key uuid; alter table payment_orders add duration_months integer check(duration_months > 0);");
  const method = crypto.randomUUID();
  await db.query("insert into payment_methods(id,stable_code,display_name,method_type,provider_name,last4) values($1,'fixture','Fixture','bank_card','Fixture','0000')", [method]);
  async function reserve() {
    const id = crypto.randomUUID(), key = crypto.randomUUID();
    await db.query("insert into payment_reservations(id,method_id,product_id,plan_id,amount,idempotency_key,checkout_key,expires_at) values($1,$2,'fixture','0',5.99,$3,$4,now()+interval '10 minutes')", [id,method,crypto.randomUUID(),key]);
    return {id,key};
  }
  const legacy = await reserve();
  await db.query("insert into payment_orders(order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,receipt_bucket,receipt_path,receipt_mime,receipt_size,receipt_sha256,consent_accepted) values('MP-ABC123',$1,$2,'fixture','Old fixture','0','1 month',5.99,'private','old.jpg','image/jpeg',100,$3,true)", [legacy.id,method,"a".repeat(64)]);
  // Match the live rollout's 1,035 legacy orders: count is NOT the ID seed.
  await db.query(`insert into payment_reservations(method_id,product_id,plan_id,amount,idempotency_key,checkout_key,expires_at)
    select $1,'legacy-seed','0',5.99,gen_random_uuid(),gen_random_uuid(),now()+interval '10 minutes'
    from generate_series(1,1034)`, [method]);
  await db.exec(`insert into payment_orders(order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,receipt_bucket,receipt_path,receipt_mime,receipt_size,receipt_sha256,consent_accepted)
    select 'MP-'||upper(lpad(to_hex(row_number() over(order by id)::integer),6,'0')),id,method_id,product_id,'Legacy fixture',plan_id,'1 month',amount,'private',id::text||'.jpg','image/jpeg',100,repeat('a',64),true
    from payment_reservations where product_id='legacy-seed';`);
  const before = (await db.query("select * from payment_orders order by id")).rows;
  check(before.length, 1035);
  await db.exec(migration);
  check((await db.query("select * from payment_orders order by id")).rows, before);
  await db.exec(migration);
  check((await db.query("select * from payment_orders order by id")).rows, before);
  async function submit(r, duration = 1, key = r.key) {
    const result = await db.query("select submit_payment_order_v2($1,$2,'fixture','0','Fixture product','1 month','private',$3,'image/jpeg',100,$4,$5) as result", [r.id,key,`${r.id}.jpg`,"b".repeat(64),duration]);
    return result.rows[0].result;
  }
  const first = await reserve();
  const order = await submit(first);
  check(order.orderCode, "971");
  check((await submit(first)).id, order.id);
  check((await submit(first)).idempotent, true);
  check((await db.query("select count(*)::int as n from payment_audit_log")).rows[0].n, 1);
  check((await db.query("select confirmed_count from payment_method_daily_counters")).rows, []);
  const failed = await reserve();
  await assert.rejects(submit(failed, -1), /duration_months/); checks++;
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 971);
  check((await db.query("select status from payment_reservations where id=$1", [failed.id])).rows[0].status, "reserved");
  await assert.rejects(submit(failed, 1, crypto.randomUUID()), /CHECKOUT_MISMATCH/); checks++;
  check((await submit(failed)).orderCode, "972");
  const reservations = await Promise.all(Array.from({length:20}, () => reserve()));
  const orders = await Promise.all(reservations.flatMap(r => [submit(r),submit(r)]));
  check(new Set(orders.map(o => o.orderCode)).size, 20);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 992);
  await db.exec(migration);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 992);
  check((await db.query("select * from payment_orders where order_code like 'MP-%' order by id")).rows, before);
  check((await db.query("select count(*)::int-count(distinct order_code)::int as duplicates from payment_orders")).rows[0].duplicates, 0);
  const beforeAdvance = (await db.query("select * from payment_orders order by id")).rows;
  const reservationsBeforeAdvance = (await db.query("select * from payment_reservations order by id")).rows;
  check(advanceMigration.indexOf("lock table public.payment_order_number_counter") < advanceMigration.indexOf("lock table public.payment_orders"), true);
  await db.exec(advanceMigration);
  check((await db.query("select * from payment_orders order by id")).rows, beforeAdvance);
  check((await db.query("select * from payment_reservations order by id")).rows, reservationsBeforeAdvance);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 10000);
  check((await submit(first)).orderCode, "971");
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 10000);
  const next = await reserve();
  check((await submit(next)).orderCode, "10001");
  check((await submit(next)).orderCode, "10001");
  await db.exec(advanceMigration);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 10001);
  const advancedReservations = await Promise.all(Array.from({length:20}, () => reserve()));
  const advancedOrders = await Promise.all(advancedReservations.flatMap(r => [submit(r),submit(r)]));
  check(new Set(advancedOrders.map(o => o.orderCode)).size, 20);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 10021);
  // An imported higher numeric code must also be respected, without rewriting it.
  const imported = await reserve();
  await db.query("insert into payment_orders(order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,receipt_bucket,receipt_path,receipt_mime,receipt_size,receipt_sha256,consent_accepted) values('20000',$1,$2,'fixture','Imported fixture','0','1 month',5.99,'private','imported.jpg','image/jpeg',100,$3,true)", [imported.id,method,"c".repeat(64)]);
  await db.exec(advanceMigration);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 20000);
  check((await submit(await reserve())).orderCode, "20001");
  await db.exec(advanceMigration);
  check((await db.query("select last_number::int as n from payment_order_number_counter")).rows[0].n, 20001);
  check((await db.query("select * from payment_orders where order_code like 'MP-%' order by id")).rows, before);
  check((await db.query("select count(*)::int-count(distinct order_code)::int as duplicates from payment_orders")).rows[0].duplicates, 0);
  for (const role of ["anon","authenticated"]) {
    check((await db.query("select has_function_privilege($1,'public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer)','execute') as allowed",[role])).rows[0].allowed,false);
    check((await db.query("select has_table_privilege($1,'payment_order_number_counter','select') as allowed",[role])).rows[0].allowed,false);
  }
  check((await db.query("select has_function_privilege('service_role','public.submit_payment_order_v2(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer)','execute') as allowed")).rows[0].allowed,true);
  console.log(JSON.stringify({ok:true, checks, engine:"isolated PostgreSQL/WASM", legacyOrders:1035, originalFirstId:"971", advancedFirstId:"10001", higherExistingIdRespected:true, neverMovesBack:true, rollback:true, repeatedRequests:80, duplicateIds:0, legacyRowsUnchanged:true, migrationRerun:true, note:"Single-connection engine; not a live multi-connection load test"}));
} finally { await db.close(); }
