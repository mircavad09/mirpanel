import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {localEmployeeDatabase,legacyEmployeeBootstrap} from './employee-local-postgres.mjs';
import {createStockCrypto,customerDetails} from '../mirpanel-admin/employee-security.mjs';
const db=await localEmployeeDatabase(),{sql}=db;let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},id=()=>crypto.randomUUID();
const scalar=async(text,args=[])=>(await sql.unsafe(text,args))[0].v;
const release=db.read('supabase/employee-release.sql'),rollback=db.read('supabase/employee-release-rollback.sql');
const connections=[];const connection=()=>{const c=db.connection();connections.push(c);return c;};
const rpc=async(c,name,args)=>(await c.unsafe(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as v`,args))[0].v;
const rejected=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const race=async(a,b,pattern)=>{const results=await Promise.allSettled([a(),b()]);eq(results.filter(r=>r.status==='fulfilled').length,1);const error=results.find(r=>r.status==='rejected').reason;assert.match(error.message,pattern);checks++;return results;};
try{
 const c1=connection(),c2=connection(),pid1=(await c1`select pg_backend_pid() as pid`)[0].pid,pid2=(await c2`select pg_backend_pid() as pid`)[0].pid;
 assert.notEqual(pid1,pid2);checks++;const version=(await sql`select version() as v`)[0].v;assert.match(version,/PostgreSQL/);checks++;
 // A truly empty DB fails the explicit legacy prerequisite without leaving DDL.
 await rejected(()=>db.exec(release),/EMPLOYEE_LEGACY_PAYMENT_PREREQUISITES_MISSING/);
 eq(await scalar("select to_regclass('employee_accounts') as v"),null);
 await legacyEmployeeBootstrap(db);
 const method=id();await sql.unsafe("insert into payment_methods(id,stable_code,display_name,provider_name,method_type,last4,encrypted_number,sort_order,daily_limit,limit_mode,active) values($1,'employee-test','Fixture','Fixture','bank_card','1234','isolated',99,1000,'unlimited',false)",[method]);
 let fixtureCode=20000;const makeOrder=async({created=null,quantity=1,plan=null}={})=>{const order=id(),reservation=id();await sql.unsafe(`insert into payment_reservations(id,method_id,product_id,plan_id,amount,idempotency_key,checkout_key,status,expires_at) values($1,$2,'capcut','0',$3,$4,$5,'reviewing',clock_timestamp()+interval '1 hour')`,[reservation,method,5*quantity,id(),id()]);
  await sql.unsafe(`insert into payment_orders(id,order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,receipt_bucket,receipt_path,receipt_mime,receipt_size,receipt_sha256,status,consent_accepted,created_at,duration_months) values($1,$2,$3,$4,'capcut','Fixture CapCut','0','1 aylıq',$5,'private-fixture',$6,'image/png',5,$7,'reviewing',true,coalesce($8::timestamptz,clock_timestamp()),1)`,[order,String(++fixtureCode),reservation,method,5*quantity,'fixture/'+order,'a'.repeat(64),created]);
  if(plan)await sql.unsafe("update payment_orders set canonical_plan_id=$2,quantity=$3,customer_name='Fixture',customer_phone='994500000000' where id=$1",[order,plan,quantity]);return order;};
 const old=await makeOrder({created:'2024-01-01T00:00:00Z'}),before=(await sql.unsafe('select to_jsonb(o) as v from payment_orders o where id=$1',[old]))[0].v;
 // Fail after all DDL but before COMMIT: backup and employee DDL must roll back together.
 const interrupted=release.replace(/\ncommit;/i,'\nselect 1/0;\ncommit;');await rejected(()=>db.exec(interrupted),/division by zero/);
 eq(await scalar("select to_regclass('employee_accounts') as v"),null);eq(await scalar("select to_regnamespace('employee_pre_release_20261021')::text as v"),null);
 eq((await sql.unsafe('select to_jsonb(o) as v from payment_orders o where id=$1',[old]))[0].v,before);
 await db.exec(release);const stable=(await sql.unsafe('select to_jsonb(o) as v from payment_orders o where id=$1',[old]))[0].v;
 await db.exec(release);eq((await sql.unsafe('select to_jsonb(o) as v from payment_orders o where id=$1',[old]))[0].v,stable);
 eq(await scalar('select count(*)::int as v from employee_accounts'),0);eq(await scalar('select count(*)::int as v from employee_stock_units'),0);
 eq((await sql`select to_jsonb(o) as v from employee_pre_release_20261021.payment_orders o`)[0].v,before);
 const employee=id();await sql.unsafe("insert into employee_accounts(id,login,display_name,password_hash) values($1,'isolated-worker','Fixture','fixture-not-a-login-hash')",[employee]);
 eq((await rpc(sql,'employee_reporting_snapshot',[employee])).totalOrders,0);await rpc(sql,'employee_start_reporting',[employee,'fixture-admin']);
 const plan=await rpc(sql,'employee_plan_resolve',['capcut','0','fixture-signature','1 aylıq']);
 const crypt=createStockCrypto(crypto.randomBytes(32).toString('base64'));
 const add=async(n=1)=>{const key=id(),items=Array.from({length:n},()=>{const unit=id(),secret={email:id()+'@test.invalid',password:crypto.randomBytes(12).toString('hex')};return{id:unit,cipher:crypt.encrypt(secret,`${unit}:capcut:${plan}`),fingerprint:crypt.fingerprint(secret),requestFingerprint:crypt.fingerprint(secret)};});await rpc(sql,'employee_add_stock',['capcut',plan,items,'fixture-admin',key]);return items;};
 const action=(c,order,op,{key=id(),role='employee',quantity=1}={})=>rpc(c,'employee_order_action',[order,op,role,role==='admin'?'fixture-admin':employee,role==='admin'?null:employee,key,quantity]);
 await sql.unsafe("update payment_orders set canonical_plan_id=$2,quantity=1,customer_name='Old fixture',customer_phone='994500000000' where id=$1",[old,plan]);
 await action(sql,old,'verify',{role:'admin'});await rejected(()=>action(sql,old,'accept'),/ORDER_NOT_READY/);eq((await rpc(sql,'employee_reporting_snapshot',[employee])).totalOrders,0);
 await add(1);const order=await makeOrder({plan});await action(sql,order,'verify',{role:'admin'});
 eq((await rpc(sql,'employee_reporting_snapshot',[employee])).orderBonusCents,0);
 const acceptKeys=[id(),id()],accepted=await race(()=>action(c1,order,'accept',{key:acceptKeys[0]}),()=>action(c2,order,'accept',{key:acceptKeys[1]}),/ORDER_ALREADY_ASSIGNED|ORDER_NOT_READY/);
 eq(await action(c1,order,'accept',{key:acceptKeys[accepted.findIndex(r=>r.status==='fulfilled')]}),accepted.find(r=>r.status==='fulfilled').value);
 eq(await scalar('select count(*)::int as v from employee_order_assignments where order_id=$1',[order]),1);
 const reserveKey=id();const replays=await Promise.all([action(c1,order,'reserve',{key:reserveKey}),action(c2,order,'reserve',{key:reserveKey})]);eq(replays[0],replays[1]);
 eq(await scalar("select count(*)::int as v from employee_stock_units where reserved_order_id=$1 and state='RESERVED'",[order]),1);
 await rejected(()=>db.exec(rollback),/ROLLBACK_BLOCKED_OPEN_EMPLOYEE_ORDERS/);
 eq(await scalar('select employee_system_ready() as v'),2);
 await rejected(()=>action(c2,order,'reserve'),/INVALID_QUANTITY/);
 await action(sql,order,'preview');await action(sql,order,'sent');await action(sql,order,'submit');eq((await rpc(sql,'employee_reporting_snapshot',[employee])).orderBonusCents,0);
 const completionKeys=[id(),id()],completed=await race(()=>action(c1,order,'complete',{role:'admin',key:completionKeys[0]}),()=>action(c2,order,'complete',{role:'admin',key:completionKeys[1]}),/ORDER_FINALIZED/);
 eq(await action(c2,order,'complete',{role:'admin',key:completionKeys[completed.findIndex(r=>r.status==='fulfilled')]}),completed.find(r=>r.status==='fulfilled').value);
 eq(await scalar("select count(*)::int as v from employee_stock_units where delivered_order_id=$1 and state='DELIVERED'",[order]),1);
 eq(await scalar('select count(*)::int as v from employee_order_bonus_events where order_id=$1',[order]),1);
 // Isolated ledger fixture: exercise the actual unique constraint with two backend connections.
 const event=(await sql.unsafe('select * from employee_order_bonus_events where order_id=$1',[order]))[0];await sql.unsafe('delete from employee_order_bonus_events where order_id=$1',[order]);
 const insertBonus=c=>c.unsafe('insert into employee_order_bonus_events(order_id,employee_id,period_id,amount_cents,approved_by) values($1,$2,$3,35,$4)',[order,employee,event.period_id,'fixture-admin']);
 await race(()=>insertBonus(c1),()=>insertBonus(c2),/duplicate key/);eq(await scalar('select count(*)::int as v from employee_order_bonus_events where order_id=$1',[order]),1);
 // Two different accepted orders race for the last unit; neither can take the other's stock.
 await add(2);const one=await makeOrder({plan}),two=await makeOrder({plan});for(const o of [one,two]){await action(sql,o,'verify',{role:'admin'});await action(sql,o,'accept');}
 await sql.unsafe("update employee_stock_units set state='DISABLED' where id=(select id from employee_stock_units where state='AVAILABLE' limit 1)");
 await race(()=>action(c1,one,'reserve'),()=>action(c2,two,'reserve'),/STOCK_EMPTY/);
 eq(await scalar("select count(*)::int as v from employee_stock_units where state='RESERVED'"),1);
 eq(await scalar("select count(*)::int as v from employee_order_assignments where order_id=any($1::uuid[]) and state='EMPLOYEE_ACCEPTED'",[[one,two]]),1);
 eq(await scalar("select count(*)::int as v from employee_order_assignments where order_id=any($1::uuid[]) and state='STOCK_RESERVED'",[[one,two]]),1);
 for(const o of [one,two])await action(sql,o,'cancel',{role:'admin'});
 // A transaction that returns success internally but rolls back must release its unit and request key.
 const rollbackOrder=await makeOrder({plan});await action(sql,rollbackOrder,'verify',{role:'admin'});await action(sql,rollbackOrder,'accept');const rolledKey=id();
 await c1.unsafe('begin');await action(c1,rollbackOrder,'reserve',{key:rolledKey});await c1.unsafe('rollback');
 eq(await scalar('select state as v from employee_order_assignments where order_id=$1',[rollbackOrder]),'EMPLOYEE_ACCEPTED');
 eq(await scalar('select count(*)::int as v from employee_requests where request_key=$1',[rolledKey]),0);
 await action(c2,rollbackOrder,'reserve',{key:rolledKey});await action(sql,rollbackOrder,'cancel',{role:'admin'});
 // Abruptly terminating a backend while its transaction is open also rolls back stock + idempotency.
 const stopped=connection(),pid=(await stopped`select pg_backend_pid() as pid`)[0].pid,stoppedOrder=await makeOrder({plan});await action(sql,stoppedOrder,'verify',{role:'admin'});await action(sql,stoppedOrder,'accept');const stoppedKey=id();
 await stopped.unsafe('begin');await action(stopped,stoppedOrder,'reserve',{key:stoppedKey});
 eq((await c2.unsafe('select pg_terminate_backend($1) as v',[pid]))[0].v,true);await stopped.end({timeout:1});
 eq(await scalar('select count(*)::int as v from employee_requests where request_key=$1',[stoppedKey]),0);
 eq(await scalar('select state as v from employee_order_assignments where order_id=$1',[stoppedOrder]),'EMPLOYEE_ACCEPTED');
 await action(c2,stoppedOrder,'reserve',{key:stoppedKey});await action(sql,stoppedOrder,'cancel',{role:'admin'});
 // Genuine legacy reservation + submit RPCs with new checkout metadata; no mocked payment SQL.
 const reservation=id(),checkout=id();await sql.unsafe("insert into payment_reservations(id,method_id,product_id,plan_id,amount,idempotency_key,checkout_key,status,expires_at) values($1,$2,'capcut','0',15,$3,$4,'reserved',clock_timestamp()+interval '1 hour')",[reservation,method,id(),checkout]);
 const details={...customerDetails({name:'Fixture Müştəri',phone:'+994 (50) 000-00-00',quantity:3}),unitPrice:5,signature:'fixture-signature'},args={p_reservation_id:reservation,p_checkout_key:checkout,p_product_id:'capcut',p_plan_id:'0',p_product_title:'Fixture CapCut',p_plan_name:'1 aylıq',p_receipt_bucket:'private-fixture',p_receipt_path:'fixture/'+id(),p_receipt_mime:'image/png',p_receipt_size:5,p_receipt_sha256:'b'.repeat(64),p_duration_months:1};
 const submitted=await rpc(sql,'employee_submit_checkout',[args,details]),again=await rpc(sql,'employee_submit_checkout',[args,details]);eq(submitted.id,again.id);
 const saved=(await sql.unsafe('select * from payment_orders where id=$1',[submitted.id]))[0];eq(saved.customer_name,details.name);eq(saved.customer_phone,'994500000000');eq(saved.quantity,3);eq(saved.canonical_plan_id,plan);eq(saved.checkout_snapshot.amount,15);
 eq(await scalar("select count(*)::int as v from employee_stock_units where state='AVAILABLE' and reserved_order_id is not null"),0);
 eq(await scalar("select count(*)::int as v from employee_order_assignments where state='COMPLETED' and admin_completed_at is null"),0);
 const counts=await rpc(sql,'employee_inventory_counts',[]);eq(counts.every(p=>Number(p.available)>=0&&Number(p.reserved)>=0&&Number(p.pending)>=0),true);
 eq(await scalar('select count(*)::int as v from employee_order_bonus_events'),1);
 const count=await scalar('select count(*)::int as v from payment_orders'),stockCount=await scalar('select count(*)::int as v from employee_stock_units');
 await db.exec(rollback);eq(await scalar('select count(*)::int as v from payment_orders'),count);eq(await scalar('select count(*)::int as v from employee_stock_units'),stockCount);
 eq(await scalar('select count(*)::int as v from employee_order_bonus_events'),1);
 eq(await scalar("select has_function_privilege('service_role','employee_order_action(uuid,text,text,text,uuid,uuid,integer)','execute') as v"),false);
 // Old system still approves via its original RPC after employee rollback.
 const legacyResult=await rpc(sql,'approve_payment_order_v7',[old,1,'fixture-admin']);eq(legacyResult.status,'approved');
 eq(await scalar("select has_function_privilege('service_role','approve_payment_order_v7(uuid,integer,text)','execute') as v"),true);
 console.log(JSON.stringify({ok:true,checks,version,distinctBackendPids:[pid1,pid2],emptyDbPrerequisiteFailsSafely:true,legacyPaymentSql:'original migrations, no payment RPC mocks',migrationFirstAndSecond:true,failedMigrationAtomic:true,rollbackPreservesData:true,legacyApprovalAfterRollback:true,duplicateStock:0,duplicateDelivery:0,duplicateBonus:0,partialStates:0,terminatedConnectionRolledBack:true,productionWrites:0},null,2));
}finally{for(const c of connections)await c.end({timeout:2}).catch(()=>{});await db.close();}
