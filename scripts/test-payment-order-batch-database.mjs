import assert from "node:assert/strict";
import fs from "node:fs";
import { createTestDatabase } from "./test-postgres-adapter.mjs";

if (process.env.MIRPANEL_REAL_TEST !== "1") throw new Error("REAL_TEST_DATABASE_REQUIRED");
const db = await createTestDatabase();
const sql = (name) => fs.readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const query = async (text, values = []) => (await db.query(text, values)).rows;
const methodId = "20000000-0000-4000-8000-000000000001";
const reservationId = "20000000-0000-4000-9000-000000000001";
const orderId = "20000000-0000-4000-a000-000000000001";

try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);");
  await db.exec(sql("202608070001_payment_system"));
  await db.exec(sql("202608090001_order_history_and_expiry"));
  await query("insert into payment_methods(id,stable_code,display_name,method_type,provider_name,last4,active) values($1,'batch-test','Test Bank','bank_card','Test Bank','1234',true)", [methodId]);
  await query("insert into payment_reservations(id,method_id,product_id,plan_id,amount,idempotency_key,status,expires_at) values($1,$2,'netflix','0',7.99,$3,'completed',now()+interval '1 hour')", [reservationId, methodId, "20000000-0000-4000-b000-000000000001"]);
  await query("insert into payment_orders(id,order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,receipt_bucket,receipt_path,receipt_mime,receipt_size,receipt_sha256,status,consent_accepted,approved_at,completed_at,duration_months,service_expires_on,expiry_notification_on) values($1,'MP-BA7C11',$2,$3,'netflix','Netflix Şəxsi','0','1 aylıq',7.99,'private','batch/test.jpg','image/jpeg',4,$4,'approved',true,now(),now(),1,current_date,current_date)", [orderId, reservationId, methodId, "a".repeat(64)]);
  const results = await Promise.all(Array.from({ length: 12 }, () => query("select mark_payment_order_contacted($1,'batch-test') as result", [orderId])));
  const values = results.map((rows) => rows[0].result);
  assert.equal(values.filter((value) => value.idempotent === false).length, 1);
  assert.equal(values.filter((value) => value.idempotent === true).length, 11);
  assert.equal(Number((await query("select count(*) as count from payment_audit_log where entity_type='order' and entity_id=$1 and action='order.customer_contacted'", [orderId]))[0].count), 1);
  assert.equal((await query("select status,contacted_at is not null as contacted from payment_orders where id=$1", [orderId]))[0].status, "approved");
  console.log(JSON.stringify({ ok: true, engine: "Supabase PostgreSQL", independentConnections: await db.connectionProof(), concurrentRetries: 12, appliedOnce: 1, idempotentReplays: 11, auditRows: 1, syntheticOnly: true }));
} finally {
  await db.close();
}
