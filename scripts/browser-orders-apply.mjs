// Explicit release gate. Never runs without a verified, encrypted external backup.
import fs from 'node:fs';import path from 'node:path';
import postgres from '../payment-test-artifacts/postgres-driver/package/src/index.js';
if(process.env.MIRPANEL_APPLY_PROJECT!=='sidgtcgyqkdplgfabmmp')throw Error('EXPLICIT_PROJECT_REQUIRED');
const root=path.join(process.env.LOCALAPPDATA,'MirpanelPrivateBackups');
const verified=fs.readdirSync(root).filter(x=>x.startsWith('browser-orders-')).sort().reverse().map(x=>path.join(root,x)).find(p=>fs.existsSync(path.join(p,'verified.json'))&&fs.existsSync(path.join(p,'public.dump.dpapi')));
if(!verified)throw Error('VERIFIED_ENCRYPTED_BACKUP_REQUIRED');
const proof=JSON.parse(fs.readFileSync(path.join(verified,'verified.json'),'utf8'));if(!proof.ok||!proof.restoreDataMatch||!proof.restoreDefinitionsMatch||!proof.localMigrationFirstAndRepeat||!proof.rollbackBusinessDataPreserved)throw Error('BACKUP_PROOF_INCOMPLETE');
let input='';for await(const c of process.stdin)input+=c;const credential=JSON.parse(input);input='';
const ca=fs.readFileSync(path.join(verified,'supabase-ca.crt'),'utf8');
const sql=postgres({host:'aws-0-eu-central-1.pooler.supabase.com',port:5432,username:credential.username,password:credential.password,database:'postgres',ssl:{ca,rejectUnauthorized:true},prepare:false,max:1,onnotice:()=>{},connect_timeout:15,connection:{application_name:'mirpanel-browser-orders-release',statement_timeout:30000}});credential.password='';
try{await sql.unsafe(fs.readFileSync('supabase/browser-orders-preflight.sql','utf8')).simple();console.log('BROWSER_ORDERS_PREFLIGHT_OK');
if((await sql`select to_regprocedure('public.browser_orders_ready()') is not null as exists`)[0].exists)throw Error('MIGRATION_ALREADY_PRESENT_VERIFY_BEFORE_REPEAT');
await sql.unsafe(fs.readFileSync('supabase/migrations/202610250002_browser_orders.sql','utf8')).simple();
await sql.unsafe(fs.readFileSync('supabase/browser-orders-verify.sql','utf8')).simple();
const r=(await sql`select public.browser_orders_ready() as ready,(select count(*)::int from browser_orders_release_20261025.manifest) as manifest_entries,(select relrowsecurity from pg_class where oid='public.browser_order_owners'::regclass) as rls,has_table_privilege('anon','public.browser_order_owners','SELECT') as anon_read,has_function_privilege('anon','public.browser_orders_page(text,timestamptz,uuid,integer)','EXECUTE') as anon_rpc,has_function_privilege('service_role','public.submit_payment_order_browser(uuid,uuid,text,text,text,text,text,text,text,integer,text,integer,text)','EXECUTE') as service_rpc,(select count(*)::int from public.browser_order_owners b left join public.payment_orders o on o.id=b.order_id where o.id is null) as orphan_links,public.employee_system_ready() as employee_schema`)[0];
if(r.ready!==1||r.manifest_entries!==2||!r.rls||r.anon_read||r.anon_rpc||!r.service_rpc||r.orphan_links!==0||r.employee_schema!==6)throw Error('VERIFICATION_FAILED');
fs.writeFileSync(path.join(verified,'production-verification.json'),JSON.stringify({at:new Date().toISOString(),...r},null,2));console.log(JSON.stringify({migrationApplied:true,...r}));
}catch(e){await sql.unsafe('rollback').catch(()=>{});console.log(JSON.stringify({ok:false,error:e.code||e.message}));process.exitCode=1;}finally{await sql.end({timeout:2});}
