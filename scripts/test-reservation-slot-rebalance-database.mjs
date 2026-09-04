import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

if(process.env.MIRPANEL_REAL_TEST!=='1') throw new Error('REAL_POSTGRES_REQUIRED');
const db=await (await import('./test-postgres-adapter.mjs')).createTestDatabase();
const sql=name=>fs.readFileSync(`supabase/migrations/${name}.sql`,'utf8');
const q=async(text,params=[])=>(await db.query(text,params)).rows;
const ids=Array.from({length:12},(_,i)=>`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const snapshot=async()=>(await q('select payment_method_queue_snapshot() value'))[0].value;
const active=async()=>(await snapshot()).filter(row=>row.active).map(row=>ids.indexOf(row.id)+1);
const reserve=async(i,key=crypto.randomUUID(),checkout=crypto.randomUUID())=>{
  const value=(await q("select reserve_payment_method_v3($1,'fixture','0',5.99,'AZN',$2,$3) value",[ids[i-1],key,checkout]))[0].value;
  return {...value,key,checkout};
};

try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);');
  await db.exec(sql('202608070001_payment_system').replace('create extension if not exists pgcrypto;',''));
  for(const name of ['202608080001_payment_checkout_reservations','202608090001_order_history_and_expiry','202608090002_payment_costs_and_profit','202608090003_payment_method_capacity_and_admin','202608100001_calendar_reports_and_cost_backfill','202608150001_payment_usage_day_and_method_soft_delete','202609010001_payment_method_activation_policy','202609020001_disable_payment_method_restore','202609020004_numeric_payment_order_codes','202609030001_filtered_order_finance_methods','202609020006_four_active_payment_methods','202609020007_payment_method_bank_slot_policy','202609030002_payment_method_status_queue_regression']) await db.exec(sql(name));
  const providers=['M10','ABB','LeoBank','Kapital Bank','M10','ABB','LeoBank','Kapital Bank','Other 1','Other 2','Other 3','Other 4'];
  for(let i=0;i<ids.length;i++) await q("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit) values($1,$2,$3,$3,'bank_card',$4,'fixture-encrypted-placeholder',$5,1)",[ids[i],`fixture-${i}`,providers[i],String(i).padStart(4,'0'),i+1]);
  const methodsBefore=await q('select * from payment_methods order by id');
  const reservationsBefore=await q('select * from payment_reservations order by id');
  await db.exec(sql('202609050001_reservation_slot_rebalance'));
  check(await q('select * from payment_methods order by id'),methodsBefore,'migration must not rewrite cards');
  check(await q('select * from payment_reservations order by id'),reservationsBefore,'migration must not rewrite reservations');
  check(await db.connectionProof(),12,'twelve independent PostgreSQL backends');
  check(await active(),[1,2,3,4],'four primary cards');

  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),1) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[3]]);
  check(await active(),[1,2,3,8],'confirmed limit opens same-bank Kapital standby');
  let limitRows=await snapshot();
  check(limitRows.find(row=>row.id===ids[3]).queue_stats.confirmed,1,'limit-full primary remains in snapshot');
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[3]]);
  check(await active(),[1,2,3,4],'primary set is restored when synthetic limit is cleared');

  await q('update payment_methods set manual_disabled=true,active=false where id=$1',[ids[7]]);
  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),1) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[3]]);
  check(await active(),[1,2,3,5],'another-bank standby opens only when same-bank standby is unavailable');
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[3]]);
  await q('update payment_methods set manual_disabled=false where id=$1',[ids[7]]);
  check(await active(),[1,2,3,4],'cross-bank fallback does not stay active after recovery');

  const m10=await reserve(1);
  check(await active(),[2,3,4,5],'same-bank standby replaces reserved M10');
  let rows=await snapshot();
  check(rows.filter(row=>row.active).length,4,'exactly four selectable');
  check(rows.find(row=>row.id===ids[0]).queue_stats.activeReservations,1,'reserved primary retained');
  await q('select cancel_customer_payment_reservation($1,$2)',[m10.id,m10.checkout]);
  check(await active(),[1,2,3,4],'primary returns after cancellation');
  check((await snapshot()).find(row=>row.id===ids[4]).active,false,'unused standby returns to pending');

  const abb=await reserve(2);
  check(await active(),[1,3,4,6],'same-bank ABB standby opens');
  await q("update payment_reservations set expires_at=now()-interval '1 second' where id=$1",[abb.id]);
  check(await active(),[1,2,3,4],'expiry restores primary and demotes standby');
  check((await q('select status from payment_reservations where id=$1',[abb.id]))[0].status,'expired','expiry is persisted');

  const races=await Promise.allSettled(Array.from({length:20},()=>reserve(3)));
  check(races.filter(result=>result.status==='fulfilled').length,1,'one concurrent reservation wins the card');
  check(await active(),[1,2,4,7],'Leo standby replaces busy primary');
  check((await snapshot()).filter(row=>row.active).length,4,'parallel calls cannot exceed four selectable');
  const winner=races.find(result=>result.status==='fulfilled').value;
  const replay=await Promise.all(Array.from({length:12},()=>reserve(3,winner.key,winner.checkout)));
  check(new Set(replay.map(row=>row.id)).size,1,'idempotent retries reuse reservation');
  check((await q("select count(*)::int n from payment_reservations where method_id=$1 and status='reserved'",[ids[2]]))[0].n,1,'retry creates no extra row');
  await q('select cancel_customer_payment_reservation($1,$2)',[winner.id,winner.checkout]);
  check(await active(),[1,2,3,4],'queue rebalances after racing reservation cancellation');

  await q("update payment_methods set manual_disabled=true,active=false where id=any($1::uuid[])",[ids.slice(4)]);
  const limited=await reserve(4);
  check((await active()).length,3,'insufficient standby returns only real free cards');
  await q('select cancel_customer_payment_reservation($1,$2)',[limited.id,limited.checkout]);
  check(await active(),[1,2,3,4],'cancel restores four when possible');

  console.log(JSON.stringify({ok:true,checks,engine:'Supabase PostgreSQL',independentBackends:12,parallelAttempts:20,productionDataUsed:false,testSchema:db.schema}));
}finally{await db.close();}
