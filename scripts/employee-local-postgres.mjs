// Disposable local-only PostgreSQL. Never accepts a connection URL or production host.
import postgres from '../payment-test-artifacts/postgres-driver/package/src/index.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
export async function localEmployeeDatabase(){
 const port=Number(process.env.MIRPANEL_LOCAL_PG_PORT||55439);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('LOCAL_TEST_PORT_REQUIRED');
 const options={host:'127.0.0.1',port,username:'employee_test_owner',max:16,prepare:false,onnotice:()=>{},connect_timeout:5,connection:{application_name:'mirpanel-employee-isolated-test',statement_timeout:15000}};
 const admin=postgres({...options,database:'postgres'}),name='mirpanel_employee_test_'+crypto.randomBytes(8).toString('hex');
 await admin.unsafe(`create database ${name}`);
 const sql=postgres({...options,database:name});
 for(const role of ['anon','authenticated','service_role'])await admin.unsafe(`do $$begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role}${role==='service_role'?' bypassrls':''};end if;end$$`);
 const exec=async(text,connection=sql)=>{const c=connection===sql?await sql.reserve():connection;try{return await c.unsafe(text).simple();}catch(e){await c.unsafe('rollback').catch(()=>{});throw e;}finally{if(connection===sql)c.release();}};
 return {sql,admin,name,options,exec,read:f=>fs.readFileSync(f,'utf8'),
  connection:()=>postgres({...options,database:name,max:1}),
  async close(){await sql.end({timeout:3});if(!/^mirpanel_employee_test_[a-f0-9]{16}$/.test(name))throw Error('UNSAFE_TEST_DATABASE_NAME');await admin.unsafe(`drop database ${name} with(force)`);await admin.end({timeout:3});}};
}
export const legacyEmployeeMigrations=[
 '202608070001_payment_system','202608080001_payment_checkout_reservations','202608090001_order_history_and_expiry',
 '202608090002_payment_costs_and_profit','202608090003_payment_method_capacity_and_admin','202608100001_calendar_reports_and_cost_backfill',
 '202608150001_payment_usage_day_and_method_soft_delete','202609010001_payment_method_activation_policy','202609020001_disable_payment_method_restore',
 '202609020004_numeric_payment_order_codes','202609030001_filtered_order_finance_methods','202609020006_four_active_payment_methods',
 '202609020007_payment_method_bank_slot_policy','202609030002_payment_method_status_queue_regression','202609050001_reservation_slot_rebalance',
 '202609060001_capacity_aware_payment_reservations','202609090001_old_order_approval_limit_isolation'];
export async function legacyEmployeeBootstrap(db){
 await db.exec('create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
 for(const name of legacyEmployeeMigrations)await db.exec(db.read('supabase/migrations/'+name+'.sql'));
}
