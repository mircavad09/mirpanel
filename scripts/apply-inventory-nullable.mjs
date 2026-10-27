// Schema-only release after a verified external backup/isolated restore.
// Credentials via stdin only; never logged. Does not change stock/order data.
import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import postgres from'../payment-test-artifacts/postgres-driver/package/src/index.js';
const root=path.join(process.env.LOCALAPPDATA,'MirpanelPrivateBackups'),migration=fs.readFileSync('supabase/migrations/202610280001_inventory_nullable.sql','utf8'),hash=crypto.createHash('sha256').update(migration).digest('hex');
const backups=fs.readdirSync(root).filter(x=>/^inventory-nullable-/.test(x)).sort().reverse();let proof;
for(const name of backups){const dir=path.join(root,name),file=path.join(dir,'verified.json');if(!fs.existsSync(file))continue;const p=JSON.parse(fs.readFileSync(file));if(p.ok&&p.migrationSha256===hash&&p.restoreDataMatch&&p.restoreDefinitionsMatch&&p.localMigrationFirstAndRepeat&&p.rollbackBusinessDataPreserved&&fs.existsSync(path.join(dir,'public.dump.dpapi'))){proof=p;break;}}
if(!proof)throw Error('VERIFIED_ENCRYPTED_BACKUP_REQUIRED');
let input='';for await(const part of process.stdin)input+=part;const credential=JSON.parse(input);input='';
const ca=await(await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt')).text(),sql=postgres({host:'aws-0-eu-central-1.pooler.supabase.com',port:5432,database:'postgres',username:credential.username,password:credential.password,ssl:{rejectUnauthorized:true,ca},prepare:false,max:1,onnotice:()=>{},connection:{application_name:'mirpanel-inventory-nullable-release',statement_timeout:120000}});
try{
 const before=(await sql`select employee_system_ready() as version`)[0].version;if(![5,6].includes(before))throw Error('INCOMPATIBLE_SCHEMA');
 const already=(await sql`select to_regprocedure('inventory_nullable_ready()') is not null as present`)[0].present;if(already&&(await sql`select inventory_nullable_ready() as ready`)[0].ready)throw Error('ALREADY_APPLIED_VERIFY_INSTEAD');
 await sql.unsafe(migration).simple();await sql.unsafe(fs.readFileSync('supabase/inventory-nullable-verify.sql','utf8')).simple();
 const after=(await sql`select employee_system_ready() as version,inventory_nullable_ready() as ready`)[0];if(after.version!==before||!after.ready)throw Error('POST_MIGRATION_VERIFICATION_FAILED');
 // Unchanged original columns, not counts alone. Snapshot was captured inside
 // the migration transaction, immediately before the additive DDL.
 for(const table of['product_inventory_policies','employee_catalog_plans','employee_stock_units']){const remove=table==='product_inventory_policies'?"-'unlimited'":'';const result=await sql.unsafe(`select not exists((select to_jsonb(t)${remove} from public.${table} t except all select to_jsonb(t) from inventory_nullable_backup.${table} t) union all (select to_jsonb(t) from inventory_nullable_backup.${table} t except all select to_jsonb(t)${remove} from public.${table} t)) as same`);if(!result[0].same)throw Error('INVENTORY_DATA_CHANGED_VERIFY_CONCURRENT_ACTIVITY');}
 const report={ok:true,schemaVersion:after.version,nullableReady:true,verification:'INVENTORY_NULLABLE_OK',backupRestoreVerified:true,existingInventoryRowsUnchanged:true,productionBusinessWrites:0,migrationSha256:hash};fs.mkdirSync('payment-test-artifacts/inventory-nullable',{recursive:true});fs.writeFileSync('payment-test-artifacts/inventory-nullable/migration-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.log(JSON.stringify({ok:false,error:/^[A-Z0-9_]+$/.test(e.message)?e.message:e.code||'MIGRATION_FAILED'}));process.exitCode=1;}finally{credential.password='';await sql.end({timeout:3});}
