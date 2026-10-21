import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(path.resolve('payment-test-artifacts/runtime/package/dist/index.js')));
const db=new PGlite();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const body=f=>read(f).replace(/^begin;\s*$/gim,'').replace(/^commit;\s*$/gim,'').trim();
try {
 const bootstrap=read('scripts/test-employee-panel-db.mjs').match(/await db\.exec\(`([\s\S]+?)`\);/)[1];
 await db.exec(bootstrap);
 const release=read('supabase/employee-release.sql'),rollback=read('supabase/employee-release-rollback.sql');
 for(const f of ['supabase/employee-pre-release-backup.sql','supabase/migrations/202610210001_employee_reporting.sql','supabase/migrations/202610210002_employee_panel.sql'])eq(release.includes(body(f)),true);
 for(const f of ['supabase/rollback/202610210002_employee_panel.sql','supabase/rollback/202610210001_employee_reporting.sql'])eq(rollback.includes(body(f)),true);
 await db.exec("insert into payment_orders(order_code,product_id,amount,status) values('BEFORE-RELEASE','capcut',4.99,'approved')");
 const before=(await db.query('select to_jsonb(o) as v from payment_orders o')).rows[0].v;
 await db.exec(release);await db.exec(release);
 eq((await db.query('select count(*)::int as n from employee_pre_release_20261021.payment_orders')).rows[0].n,1);
 eq((await db.query('select to_jsonb(o) as v from employee_pre_release_20261021.payment_orders o')).rows[0].v,before);
 eq((await db.query('select count(*)::int as n from employee_accounts')).rows[0].n,0);
 eq((await db.query('select count(*)::int as n from employee_stock_units')).rows[0].n,0);
 eq((await db.query('select count(*)::int as n from employee_order_bonus_events')).rows[0].n,0);
 eq((await db.query("select has_schema_privilege('service_role','employee_pre_release_20261021','usage') as v")).rows[0].v,false);
 eq((await db.query('select employee_system_ready() as v')).rows[0].v,2);
 await db.exec(rollback);await db.exec(rollback);
 eq((await db.query('select count(*)::int as n from payment_orders')).rows[0].n,1);
 eq((await db.query("select has_function_privilege('service_role','employee_start_reporting(uuid,text)','execute') as v")).rows[0].v,false);
 console.log(JSON.stringify({ok:true,checks,releaseReplayed:2,rollbackReplayed:2,backupVerified:true,productionWrites:0},null,2));
} finally {await db.close();}
