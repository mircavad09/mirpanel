import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { rowMethod } from '../mirpanel-admin/payment-store.mjs';

// PostgreSQL/WASM only: no secrets, network, live orders, or live reservations.
const real=process.env.MIRPANEL_REAL_TEST==='1';
const db = real ? await (await import('./test-postgres-adapter.mjs')).createTestDatabase()
  : new (await import(pathToFileURL(path.resolve(process.env.MIRPANEL_PGLITE || 'payment-test-artifacts/runtime/package/dist/index.js')))).PGlite();
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const sql=name=>fs.readFileSync(`supabase/migrations/${name}.sql`,'utf8');
const migration=sql('202609020006_four_active_payment_methods');
const q=async(s,p=[]) => (await db.query(s,p)).rows;
const ids=Array.from({length:14},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const snapshot=async()=> (await q('select payment_method_queue_snapshot() as value'))[0].value;
const active=async()=> (await snapshot()).filter(m=>m.active).map(m=>ids.indexOf(m.id)+1);
const counter=async(i,n)=>db.query('insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),$2) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count',[ids[i-1],n]);
const reserve=async(i,key=crypto.randomUUID(),checkout=crypto.randomUUID()) => {
  const value=(await q("select reserve_payment_method_v3($1,'fixture','0',5.99,'AZN',$2,$3) as value",[ids[i-1],key,checkout]))[0].value;
  return {...value,key,checkout};
};
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);');
  await db.exec(sql('202608070001_payment_system').replace('create extension if not exists pgcrypto;',''));
  for(const name of ['202608080001_payment_checkout_reservations','202608090001_order_history_and_expiry','202608090002_payment_costs_and_profit','202608090003_payment_method_capacity_and_admin','202608100001_calendar_reports_and_cost_backfill','202608150001_payment_usage_day_and_method_soft_delete','202609010001_payment_method_activation_policy','202609020001_disable_payment_method_restore','202609020004_numeric_payment_order_codes']) await db.exec(sql(name));
  // Only synthetic records are added to this isolated engine.
  for(let i=0;i<ids.length;i++) await q("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order) values($1,$2,'Fixture','Same bank','bank_card',$3,'fixture-encrypted-placeholder',$4)",[ids[i],`fixture-${i}`,String(i).padStart(4,'0'),i+1]);
  const before=await q('select * from payment_methods order by id');
  if(real) await db.exec('begin; '+fs.readFileSync('scripts/four-card-release-backup.sql','utf8')+' commit;');
  await db.exec(migration); await db.exec(migration);
  check(await q('select * from payment_methods order by id'),before);
  check(await active(),[1,2,3,4]);
  if(real) {
    check(await db.connectionProof(),12);
    // 24 independent requests race for five slots; only five may commit.
    const attempts=await Promise.allSettled(Array.from({length:24},()=>reserve(1)));
    const wins=attempts.filter(r=>r.status==='fulfilled').map(r=>r.value);
    check(wins.length,5);
    check(attempts.filter(r=>r.status==='rejected').every(r=>/TEMPORARILY_BUSY/.test(r.reason.message)),true);
    check(await active(),[1,2,3,4]);
    await Promise.all(wins.map(r=>q('select cancel_customer_payment_reservation($1,$2)',[r.id,r.checkout])));
    const key=crypto.randomUUID(), checkout=crypto.randomUUID();
    const replays=await Promise.all(Array.from({length:12},()=>reserve(1,key,checkout)));
    check(new Set(replays.map(r=>r.id)).size,1);
    await q('select cancel_customer_payment_reservation($1,$2)',[replays[0].id,checkout]);
  }
  await counter(2,5); check(await active(),[1,3,4,5]);
  await counter(4,5); check(await active(),[1,3,5,6]);
  const visible=(await snapshot()).map(m=>rowMethod(m,m.queue_stats)).filter(m=>!m.manualDisabled && m.hasNumber && (m.active || (m.activatedToday && m.status==='limit_reached')));
  check(visible.length,6); check(visible.filter(m=>m.status==='limit_reached').length,2);
  check(visible.filter(m=>m.status==='limit_reached').every(m=>!m.available),true);
  check(visible.some(m=>m.id===ids[6]),false);
  await assert.rejects(reserve(2),/PAYMENT_METHOD_UNAVAILABLE/); checks++;
  // Temporary capacity does not advance the queue, even with no counter row.
  const holds=await Promise.all(Array.from({length:5},()=>reserve(1)));
  await assert.rejects(reserve(1),/TEMPORARILY_BUSY/); checks++;
  check(await active(),[1,3,5,6]);
  const busy=(await snapshot()).find(m=>m.id===ids[0]);
  check(rowMethod(busy,busy.queue_stats).status,'temporarily_busy');
  const again=await reserve(1,holds[0].key,holds[0].checkout); check(again.id,holds[0].id);
  check((await q("select count(*)::int as n from payment_reservations where method_id=$1 and status='reserved'",[ids[0]]))[0].n,5);
  await q('select cancel_customer_payment_reservation($1,$2)',[holds[0].id,holds[0].checkout]);
  await q('select cancel_customer_payment_reservation($1,$2)',[holds[0].id,holds[0].checkout]);
  check(await active(),[1,3,5,6]);
  await q("update payment_reservations set expires_at=now()-interval '1 minute' where id=$1",[holds[1].id]);
  await snapshot();
  check((await q('select status from payment_reservations where id=$1',[holds[1].id]))[0].status,'expired');
  check((await q('select count(*)::int as n from payment_method_daily_counters where method_id=$1',[ids[0]]))[0].n,0);
  // Actual submit + approve RPC: receipt linkage, snapshot and once-only counting.
  const order=async(r)=>(await q("select submit_payment_order_v2($1,$2,'fixture','0','Fixture product','1 month','private',$3,'image/jpeg',100,$4,1) as value",[r.id,r.checkout,`${r.id}.jpg`,'a'.repeat(64)]))[0].value;
  const approved=await order(holds[2]);
  await q('select approve_payment_order_v6($1,1)',[approved.id]);
  await q('select approve_payment_order_v6($1,1)',[approved.id]);
  check((await q('select confirmed_count from payment_method_daily_counters where method_id=$1 and counter_date=payment_baku_date()',[ids[0]]))[0].confirmed_count,1);
  const rejected=await order(holds[3]);
  await q("select reject_payment_order($1,'Fixture reject')",[rejected.id]);
  await q("select reject_payment_order($1,'Fixture reject')",[rejected.id]);
  check((await q('select confirmed_count from payment_method_daily_counters where method_id=$1 and counter_date=payment_baku_date()',[ids[0]]))[0].confirmed_count,1);
  // Concurrent queued calls are checked on the real SQL engine (single-session WASM).
  await counter(3,5);
  await Promise.all(Array.from({length:20},()=>snapshot()));
  check(await active(),[1,5,6,7]);
  check((await q('select count(*)::int as n from payment_method_daily_activations where method_id=$1 and usage_day=payment_baku_date()',[ids[6]]))[0].n,1);
  await q("select set_payment_method_active_admin($1,false)",[ids[4]]);
  check(await active(),[1,6,7,8]);
  await q("select delete_payment_method_safely($1)",[ids[5]]);
  check(await active(),[1,7,8,9]);
  await q("select set_payment_method_active_admin($1,true)",[ids[13]]);
  check(await active(),[1,7,8,9]);
  // Progress beyond ten cards; no bank-name or hard-coded-card dependency.
  for(const i of [1,7,8,9,10,11]) await counter(i,5);
  check(await active(),[12,13,14]);
  for(const i of [12,13,14]) await counter(i,5);
  check(await active(),[]);
  // Freeze only the isolated database's Baku day; real production clock stays unchanged.
  await db.exec("create table fixture_clock(day date); insert into fixture_clock values('2026-12-31'); create or replace function payment_baku_date(at_time timestamptz default now()) returns date language sql stable as $$ select case when at_time=now() then (select day from fixture_clock) else (at_time at time zone 'Asia/Baku')::date end $$;");
  check(await active(),[1,2,3,4]);
  const overnight=await reserve(1); const overnightOrder=await order(overnight);
  const preserved=await q('select id,method_id,usage_day,checkout_key,expires_at from payment_reservations where id=$1',[overnight.id]);
  await db.exec("update fixture_clock set day='2027-01-01'");
  check(await active(),[1,2,3,4]);
  check(await q('select id,method_id,usage_day,checkout_key,expires_at from payment_reservations where id=$1',[overnight.id]),preserved);
  check((await reserve(1,overnight.key,overnight.checkout)).id,overnight.id);
  await q('select approve_payment_order_v6($1,1)',[overnightOrder.id]);
  check((await q("select confirmed_count from payment_method_daily_counters where method_id=$1 and counter_date='2026-12-31'",[ids[0]]))[0].confirmed_count,1);
  check((await snapshot()).find(m=>m.id===ids[0]).queue_stats.confirmed,0);
  const newOrder=await order(await reserve(1)); await q('select approve_payment_order_v6($1,1)',[newOrder.id]);
  check((await snapshot()).find(m=>m.id===ids[0]).queue_stats.confirmed,1);
  await q("update payment_methods set limit_mode='unlimited' where id=$1",[ids[0]]); await counter(1,100);
  check((await snapshot()).find(m=>m.id===ids[0]).active,true);
  const ordersBefore=await q('select * from payment_orders order by id'); const reservationsBefore=await q('select * from payment_reservations order by id');
  await db.exec(migration);
  check(await q('select * from payment_orders order by id'),ordersBefore);
  check(await q('select * from payment_reservations order by id'),reservationsBefore);
  for(const role of ['anon','authenticated']) {
    check((await q("select has_function_privilege($1,'payment_method_queue_snapshot(boolean,boolean)','execute') as allowed",[role]))[0].allowed,false);
    check((await q("select has_table_privilege($1,'payment_method_daily_activations','select') as allowed",[role]))[0].allowed,false);
  }
  check((await q("select relrowsecurity from pg_class where relname='payment_method_daily_activations'"))[0].relrowsecurity,true);
  check((await q("select has_function_privilege('service_role','payment_method_queue_snapshot(boolean,boolean)','execute') as allowed"))[0].allowed,true);
  if(real) {
    const orderRows=await q('select * from payment_orders order by id');
    const counterRows=await q('select * from payment_method_daily_counters order by method_id,counter_date');
    await db.exec(fs.readFileSync('scripts/four-card-release-rollback.sql','utf8'));
    check(await q('select * from payment_orders order by id'),orderRows);
    check(await q('select * from payment_method_daily_counters order by method_id,counter_date'),counterRows);
    check((await q("select has_function_privilege('service_role','payment_method_queue_snapshot(boolean,boolean)','execute') as allowed"))[0].allowed,false);
    await db.exec(migration);
    check((await q("select has_function_privilege('service_role','payment_method_queue_snapshot(boolean,boolean)','execute') as allowed"))[0].allowed,true);
  }
  console.log(JSON.stringify({ok:true,checks,engine:real?'Supabase PostgreSQL':'PostgreSQL/PGlite',cards:14,realDataAccess:false,multiConnectionConcurrency:real?'12 independent backends; 24 racing reserves; 12 idempotent retries':'Not provided by single-session PGlite',overnightIdentityPreserved:true,testSchema:db.schema}));
} finally { await db.close(); }
