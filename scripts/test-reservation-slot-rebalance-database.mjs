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
  for(let i=0;i<ids.length;i++) await q("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit) values($1,$2,$3,$3,'bank_card',$4,'fixture-encrypted-placeholder',$5,7)",[ids[i],`fixture-${i}`,providers[i],String(i).padStart(4,'0'),i+1]);
  const methodsBefore=await q('select * from payment_methods order by id');
  const reservationsBefore=await q('select * from payment_reservations order by id');
  await db.exec(sql('202609050001_reservation_slot_rebalance'));
  await db.exec(fs.readFileSync('scripts/capacity-reservation-release-backup.sql','utf8'));
  await db.exec(sql('202609060001_capacity_aware_payment_reservations'));
  check(await q('select * from payment_methods order by id'),methodsBefore,'migration must not rewrite cards');
  check(await q('select * from payment_reservations order by id'),reservationsBefore,'migration must not rewrite reservations');
  check(await db.connectionProof(),12,'twelve independent PostgreSQL backends');
  check(await active(),[1,2,3,4],'four primary cards');

  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),7) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[3]]);
  check(await active(),[1,2,3,8],'confirmed limit opens same-bank Kapital standby');
  let limitRows=await snapshot();
  check(limitRows.find(row=>row.id===ids[3]).queue_stats.confirmed,7,'limit-full primary remains in snapshot');
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[3]]);
  check(await active(),[1,2,3,4],'primary set is restored when synthetic limit is cleared');

  await q('update payment_methods set manual_disabled=true,active=false where id=$1',[ids[7]]);
  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),7) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[3]]);
  check(await active(),[1,2,3,5],'another-bank standby opens only when same-bank standby is unavailable');
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[3]]);
  await q('update payment_methods set manual_disabled=false where id=$1',[ids[7]]);
  check(await active(),[1,2,3,4],'cross-bank fallback does not stay active after recovery');

  // Limit 5: one reservation never closes a card with remaining capacity.
  await q('update payment_methods set daily_limit=5 where id=$1',[ids[0]]);
  const fiveOne=await reserve(1);
  check(await active(),[1,2,3,4],'limit 5: 0 completed + 1 reservation stays active');
  let rows=await snapshot();
  check(rows.find(row=>row.id===ids[0]).queue_stats.activeReservations,1,'limit 5 counts one reservation');
  await q('select cancel_customer_payment_reservation($1,$2)',[fiveOne.id,fiveOne.checkout]);

  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),2) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[0]]);
  const fiveReservations=[await reserve(1)];
  rows=await snapshot();
  check(rows.find(row=>row.id===ids[0]).active,true,'limit 5: 2 completed + 1 reservation stays active');
  check(5-rows.find(row=>row.id===ids[0]).queue_stats.confirmed-rows.find(row=>row.id===ids[0]).queue_stats.activeReservations,2,'limit 5 has two slots left');
  fiveReservations.push(await reserve(1),await reserve(1));
  check(await active(),[2,3,4,5],'limit 5: 2 completed + 3 reservations opens standby');
  rows=await snapshot();
  check(rows.find(row=>row.id===ids[0]).active,false,'capacity-full card is not selectable');
  check(rows.find(row=>row.id===ids[0]).queue_stats.activeReservations,3,'all three live reservations are counted once');
  await q('select cancel_customer_payment_reservation($1,$2)',[fiveReservations[0].id,fiveReservations[0].checkout]);
  check(await active(),[1,2,3,4],'one cancellation restores limit-5 card immediately');
  check((await snapshot()).find(row=>row.id===ids[4]).active,false,'unused standby returns to pending');
  for(const item of fiveReservations.slice(1)) await q('select cancel_customer_payment_reservation($1,$2)',[item.id,item.checkout]);
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[0]]);

  // Limit 7: reserve until the last available slot, then release one.
  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),2) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[1]]);
  const sevenReservations=[await reserve(2)];
  rows=await snapshot();
  check(rows.find(row=>row.id===ids[1]).active,true,'limit 7: 2 completed + 1 reservation stays active');
  check(7-rows.find(row=>row.id===ids[1]).queue_stats.confirmed-rows.find(row=>row.id===ids[1]).queue_stats.activeReservations,4,'limit 7 has four slots left');
  for(let i=0;i<4;i++) sevenReservations.push(await reserve(2));
  check(await active(),[1,3,4,6],'limit 7: 2 completed + 5 reservations opens ABB standby');
  await q('select cancel_customer_payment_reservation($1,$2)',[sevenReservations[0].id,sevenReservations[0].checkout]);
  check(await active(),[1,2,3,4],'one cancellation restores limit-7 ABB immediately');
  for(const item of sevenReservations.slice(1)) await q('select cancel_customer_payment_reservation($1,$2)',[item.id,item.checkout]);
  await q("update payment_method_daily_counters set confirmed_count=7 where method_id=$1 and counter_date=payment_baku_date()",[ids[1]]);
  check(await active(),[1,3,4,6],'limit 7: seven completed orders shows limit-full and standby');
  rows=await snapshot();
  check(rows.find(row=>row.id===ids[1]).queue_stats.confirmed,7,'seven completed orders are reported');
  check(rows.find(row=>row.id===ids[1]).queue_stats.activeReservations,0,'completed limit is not temporary reservation');
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[1]]);
  check(await active(),[1,2,3,4],'ABB primary returns after synthetic counter cleanup');

  const expiry=await reserve(2);
  check(await active(),[1,2,3,4],'single live reservation with capacity remains selectable');
  await q("update payment_reservations set expires_at=now()-interval '1 second' where id=$1",[expiry.id]);
  await snapshot();
  check((await q('select status from payment_reservations where id=$1',[expiry.id]))[0].status,'expired','expired reservation is excluded and persisted');
  check((await snapshot()).find(row=>row.id===ids[1]).queue_stats.activeReservations,0,'expired reservation consumes no slot');

  // With two completed slots, only three of twenty concurrent requests may win.
  await q('update payment_methods set daily_limit=5 where id=$1',[ids[2]]);
  await q("insert into payment_method_daily_counters(method_id,counter_date,confirmed_count) values($1,payment_baku_date(),2) on conflict(method_id,counter_date) do update set confirmed_count=excluded.confirmed_count",[ids[2]]);
  const races=await Promise.allSettled(Array.from({length:20},()=>reserve(3)));
  check(races.filter(result=>result.status==='fulfilled').length,3,'parallel requests fill exactly three remaining slots');
  check(await active(),[1,2,4,7],'Leo standby replaces only after capacity is full');
  check((await snapshot()).filter(row=>row.active).length,4,'parallel calls cannot exceed four selectable methods');
  const winners=races.filter(result=>result.status==='fulfilled').map(result=>result.value);
  const replay=await Promise.all(Array.from({length:12},()=>reserve(3,winners[0].key,winners[0].checkout)));
  check(new Set(replay.map(row=>row.id)).size,1,'idempotent retries reuse reservation');
  check((await q("select count(*)::int n from payment_reservations where method_id=$1 and status='reserved'",[ids[2]]))[0].n,3,'retry creates no extra row');
  for(const item of winners) await q('select cancel_customer_payment_reservation($1,$2)',[item.id,item.checkout]);
  await q('delete from payment_method_daily_counters where method_id=$1',[ids[2]]);
  check(await active(),[1,2,3,4],'queue rebalances after parallel reservation cancellation');

  const rollbackMethods=await q('select * from payment_methods order by id');
  const rollbackReservations=await q('select * from payment_reservations order by id');
  const rollbackCounters=await q('select * from payment_method_daily_counters order by method_id,counter_date');
  await db.exec(fs.readFileSync('scripts/capacity-reservation-release-rollback.sql','utf8'));
  check(await q('select * from payment_methods order by id'),rollbackMethods,'rollback changes no card data');
  check(await q('select * from payment_reservations order by id'),rollbackReservations,'rollback changes no reservation data');
  check(await q('select * from payment_method_daily_counters order by method_id,counter_date'),rollbackCounters,'rollback changes no counters');
  await db.exec(sql('202609060001_capacity_aware_payment_reservations'));

  console.log(JSON.stringify({ok:true,checks,engine:'Supabase PostgreSQL',independentBackends:12,parallelAttempts:20,productionDataUsed:false,testSchema:db.schema}));
}finally{await db.close();}
