import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {eligibleEmployeeOrder,calculateMonthlyPayrollPreview,exhaustedStockProducts} from '../mirpanel-admin/employee-reporting.mjs';
const {PGlite}=await import(pathToFileURL(path.resolve(process.env.MIRPANEL_PGLITE||'payment-test-artifacts/runtime/package/dist/index.js')));
const db=new PGlite();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const read=p=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/202610210001_employee_reporting.sql');
const rollback=read('supabase/rollback/202610210001_employee_reporting.sql');
const account='10000000-0000-4000-8000-000000000001',old='20000000-0000-4000-8000-000000000001',fresh='20000000-0000-4000-8000-000000000002';
const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0].value;
const snapshot=()=>scalar('select employee_reporting_snapshot($1) as value',[account]);
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table public.payment_orders(id uuid primary key,created_at timestamptz not null,status text not null,product_id text not null);
 insert into payment_orders values('${old}','2024-01-01T00:00:00Z','approved','capcut');`);
 const legacyBefore=await db.query('select * from payment_orders');
 await db.exec(migration);await db.exec(migration);
 eq(await scalar('select count(*)::integer as value from employee_accounts'),0);
 eq(await scalar('select count(*)::integer as value from employee_order_bonus_events'),0);
 await db.query("insert into employee_accounts(id,login,display_name,password_hash) values($1,'fixture-only','Fixture','test-placeholder-not-a-real-password-hash')",[account]);
 const zero=await snapshot();for(const [key,value] of Object.entries(zero))if(key!=='employeeStartedAt')eq(value,0);
 eq(zero.employeeStartedAt,null);
 const before=Date.now();const started=await scalar("select employee_start_reporting($1,'isolated-admin') as value",[account]);
 eq(started.idempotent,false);assert.ok(Date.parse(started.employeeStartedAt)>=before-1000&&Date.parse(started.employeeStartedAt)<=Date.now()+1000);checks++;
 const retry=await scalar("select employee_start_reporting($1,'isolated-admin') as value",[account]);
 eq(retry.periodId,started.periodId);eq(retry.employeeStartedAt,started.employeeStartedAt);eq(retry.idempotent,true);
 eq(await scalar('select count(*)::integer as value from employee_reporting_audit'),1);
 const period=started.periodId;
 // An old order completed/assigned AFTER employee start is still excluded by its creation timestamp.
 await db.query(`insert into employee_order_assignments(order_id,employee_id,period_id,quantity,state,payment_verified_at,assigned_at,accepted_at,admin_completed_at)
 values($1,$2,$3,99,'COMPLETED',clock_timestamp(),clock_timestamp(),clock_timestamp(),clock_timestamp())`,[old,account,period]);
 eq((await snapshot()).totalOrders,0);eq((await snapshot()).totalQuantity,0);
 await assert.rejects(db.query(`insert into employee_order_bonus_events(order_id,employee_id,period_id,amount_cents,approved_by) values($1,$2,$3,35,'fixture')`,[old,account,period]),/EMPLOYEE_BONUS_NOT_ELIGIBLE/);checks++;
 await db.query("insert into payment_orders values($1,clock_timestamp(),'reviewing','capcut')",[fresh]);
 await db.query(`insert into employee_order_assignments(order_id,employee_id,period_id,quantity,payment_verified_at,assigned_at)
 values($1,$2,$3,3,clock_timestamp(),clock_timestamp())`,[fresh,account,period]);
 eq((await snapshot()).newOrders,1);eq((await snapshot()).totalOrders,0);
 await db.query("update employee_order_assignments set state='EMPLOYEE_ACCEPTED',accepted_at=clock_timestamp() where order_id=$1",[fresh]);
 let s=await snapshot();eq(s.newOrders,0);eq(s.totalOrders,1);eq(s.totalQuantity,3);eq(s.approvedOrders,0);eq(s.calculatedEarningsCents,0);
 await db.query("update employee_order_assignments set state='DELIVERED_PENDING_ADMIN',submitted_at=clock_timestamp() where order_id=$1",[fresh]);
 eq((await snapshot()).pendingAdmin,1);
 await assert.rejects(db.query(`insert into employee_order_bonus_events(order_id,employee_id,period_id,amount_cents,approved_by) values($1,$2,$3,35,'fixture')`,[fresh,account,period]),/EMPLOYEE_BONUS_NOT_ELIGIBLE/);checks++;
 // Completion fixtures only. No actual checkout, stock or WhatsApp adapter is called.
 await db.query("update employee_order_assignments set state='COMPLETED',admin_completed_at=clock_timestamp() where order_id=$1",[fresh]);
 eq((await snapshot()).approvedOrders,0); // payment still reviewing
 await db.query("update payment_orders set status='approved' where id=$1",[fresh]);
 const credit=()=>db.query(`insert into employee_order_bonus_events(order_id,employee_id,period_id,amount_cents,approved_by) values($1,$2,$3,35,'fixture') on conflict(order_id) do nothing`,[fresh,account,period]);
 await credit();await credit();s=await snapshot();eq(s.totalOrders,1);eq(s.totalQuantity,3);eq(s.approvedOrders,1);eq(s.completedToday,1);eq(s.orderBonusCents,35);eq(s.calculatedEarningsCents,35);
 for(const status of ['reviewing','rejected','cancelled','expired']){await db.query('update payment_orders set status=$1 where id=$2',[status,fresh]);eq((await snapshot()).orderBonusCents,0);eq((await snapshot()).approvedOrders,0);}
 await db.query("update payment_orders set status='approved' where id=$1",[fresh]);
 const employee=(await db.query('select * from employee_accounts where id=$1',[account])).rows[0];
 const assignment=(await db.query('select * from employee_order_assignments where order_id=$1',[fresh])).rows[0];
 // PGlite returns Date instances for timestamptz; application DTOs are JSON/ISO strings.
 const dto=v=>JSON.parse(JSON.stringify(v));
 eq(eligibleEmployeeOrder(dto(employee),dto(assignment),{id:fresh,created_at:new Date().toISOString()}),true);
 eq(eligibleEmployeeOrder(dto(employee),dto(assignment),{id:fresh,created_at:'2024-01-01T00:00:00Z'}),false);
 eq(eligibleEmployeeOrder({...dto(employee),employee_started_at:null},dto(assignment),{id:fresh,created_at:new Date().toISOString()}),false);
 eq(eligibleEmployeeOrder(dto(employee),{...dto(assignment),employee_id:'different'}, {id:fresh,created_at:new Date().toISOString()}),false);
 eq(calculateMonthlyPayrollPreview({started:false,approvedOrders:1200}).totalCents,0);
 eq(calculateMonthlyPayrollPreview({started:true,approvedOrders:1200}),{salaryCents:50000,orderBonusCents:42000,qualityCents:0,totalCents:92000});
 eq(calculateMonthlyPayrollPreview({started:true,approvedOrders:1200,qualityEligible:true}).totalCents,97000);
 const products=[{id:'capcut',inventoryTracked:true,plans:[{id:'0'}]},{id:'disabled',active:false,inventoryTracked:true,plans:[{id:'0'}]},{id:'untracked',plans:[{id:'0'}]}];
 eq(exhaustedStockProducts(products,[]),['capcut']);
 eq(exhaustedStockProducts([...products,products[0]],[{product_id:'capcut',plan_id:'0',status:'AVAILABLE'}]),[]);
 eq(exhaustedStockProducts(products,[{product_id:'capcut',plan_id:'0',status:'RESERVED'}]),['capcut']);
 const snapshotBefore=await snapshot();await db.exec(migration);eq(await snapshot(),snapshotBefore);
 eq((await db.query('select * from payment_orders where id=$1',[old])).rows,legacyBefore.rows);
 eq(await scalar("select has_function_privilege('anon','employee_start_reporting(uuid,text)','execute') as value"),false);
 eq(await scalar("select has_function_privilege('authenticated','employee_reporting_snapshot(uuid)','execute') as value"),false);
 eq(await scalar("select has_table_privilege('authenticated','employee_order_bonus_events','select') as value"),false);
 eq(await scalar("select has_table_privilege('service_role','employee_reporting_audit','delete') as value"),false);
 await db.exec(rollback);eq(await scalar('select count(*)::integer as value from employee_order_bonus_events'),1);
 eq(await scalar("select has_function_privilege('service_role','employee_start_reporting(uuid,text)','execute') as value"),false);
 console.log(JSON.stringify({ok:true,checks,engine:'isolated PostgreSQL/PGlite',productionWrites:0,liveOrders:0,liveStock:0,liveReservations:0,whatsappMessages:0,historicalSalesUnchanged:true,legacyOrderUnchanged:true,scope:'foundation; HTTP/browser suites run separately',multiConnectionConcurrency:'NOT TESTED'},null,2));
} finally {await db.close();}
