// Migration-scoped production backup: public schema/data/ACLs, private local restore.
// No application is attached to the restore database. Secrets enter only via stdin.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn} from 'node:child_process';
import postgres from '../payment-test-artifacts/postgres-driver/package/src/index.js';
let input='';for await(const c of process.stdin)input+=c;const credential=JSON.parse(input);input='';
const root=path.join(process.env.LOCALAPPDATA,'MirpanelPrivateBackups');
const adminSessions=process.argv.includes('--admin-sessions');
const run=path.join(root,(adminSessions?'admin-sessions-':'browser-orders-')+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(run);
const bin=path.resolve(process.env.MIRPANEL_PG_TOOLS||'payment-test-artifacts/pg17-tools/pgsql/bin');
const caResponse=await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt');if(!caResponse.ok)throw Error('CA_DOWNLOAD_FAILED');
const ca=await caResponse.text(),caPath=path.join(run,'supabase-ca.crt');fs.writeFileSync(caPath,ca);
const options={host:'aws-0-eu-central-1.pooler.supabase.com',port:5432,database:'postgres',username:credential.username,password:credential.password,ssl:{rejectUnauthorized:true,ca},prepare:false,max:1,connect_timeout:15,onnotice:()=>{},connection:{application_name:'mirpanel-browser-orders-backup',default_transaction_read_only:'on',statement_timeout:120000}};
const prod=postgres(options);const archive=path.join(run,'public.dump');let local,controlStarted=false;
function tool(name,args,env={}){return new Promise((resolve,reject)=>{const child=spawn(path.join(bin,name+'.exe'),args,{windowsHide:true,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',()=>reject(Error(name+'_LAUNCH_FAILED')));child.on(name==='pg_ctl'?'exit':'close',code=>{if(name==='pg_ctl'){child.stdout.destroy();child.stderr.destroy();}fs.appendFileSync(path.join(run,'tools.log'),`\n${name} exit=${code}\n${log}`);code===0?resolve():reject(Error(name+'_FAILED_SEE_PRIVATE_LOG'));});});}
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function inventory(sql){await sql.unsafe("set timezone='UTC'");const tables=await sql`select tablename from pg_tables where schemaname='public' order by tablename`;const rows=[];
for(const {tablename}of tables){if(!/^[a-zA-Z0-9_]+$/.test(tablename))throw Error('UNEXPECTED_IDENTIFIER');const r=await sql.unsafe(`select count(*)::text as count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public."${tablename}" t`);rows.push({table:tablename,...r[0]});}
const functions=await sql`select p.proname,pg_get_function_identity_arguments(p.oid) as args,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') order by p.proname,args`;
const constraints=await sql`select c.conname,t.relname,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' order by t.relname,c.conname`;
const indexes=await sql`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
const policies=await sql`select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname`;
const rls=await sql`select relname,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by relname`;
return{rows,tableCount:tables.length,functionCount:functions.length,functionsHash:hash(functions),constraintsHash:hash(constraints),indexesHash:hash(indexes),policiesHash:hash(policies),rlsHash:hash(rls)};}
try{
console.log('Production read-only snapshot starting');let expected,roles;
await prod.begin('isolation level repeatable read read only',async tx=>{const snap=(await tx`select pg_export_snapshot() as snapshot`)[0].snapshot;
roles=await tx`select rolname from pg_roles where rolname not like 'pg_%' order by rolname`;
expected=await inventory(tx);fs.writeFileSync(path.join(run,'source-manifest.json'),JSON.stringify(expected,null,2));
await tool('pg_dump',['--host',options.host,'--port','5432','--username',options.username,'--dbname','postgres','--format=custom','--schema=public','--snapshot='+snap,'--file',archive,'--no-password'],{PGPASSWORD:credential.password,PGSSLMODE:'verify-full',PGSSLROOTCERT:caPath,PGOPTIONS:'-c default_transaction_read_only=on'});
});await prod.end();credential.password='';console.log('Backup captured; starting isolated loopback-only restore');
const localPassword=crypto.randomBytes(32).toString('base64url'),pwfile=path.join(run,'restore-password.tmp'),cluster=path.join(run,'restore-cluster');fs.writeFileSync(pwfile,localPassword);
await tool('initdb',['-D',cluster,'-U','backup_restore_owner','--pwfile',pwfile,'--auth=scram-sha-256','--encoding=UTF8','--no-locale']);fs.unlinkSync(pwfile);
await tool('pg_ctl',['start','-D',cluster,'-o','-h 127.0.0.1 -p 55448','-l',path.join(run,'postgres.log'),'-w']);controlStarted=true;
const lo={host:'127.0.0.1',port:55448,username:'backup_restore_owner',password:localPassword,database:'postgres',prepare:false,max:1,onnotice:()=>{},connection:{statement_timeout:120000}};local=postgres(lo);
for(const{rolname}of roles){if(rolname==='backup_restore_owner')continue;await local.unsafe('create role "'+rolname.replaceAll('"','""')+'" nologin');}
await local.unsafe('create schema extensions;create extension pgcrypto with schema extensions;create extension "uuid-ossp" with schema extensions;drop schema public');
await tool('pg_restore',['--host','127.0.0.1','--port','55448','--username','backup_restore_owner','--dbname','postgres','--no-owner','--exit-on-error',archive],{PGPASSWORD:localPassword,PGSSLMODE:'disable'});
const actual=await inventory(local);if(JSON.stringify(actual)!==JSON.stringify(expected)){fs.writeFileSync(path.join(run,'restore-manifest.json'),JSON.stringify(actual,null,2));throw Error('RESTORE_MANIFEST_MISMATCH');}
console.log('Restored table data, functions, constraints, indexes, RLS and policies match');
if(!adminSessions)await local.unsafe(fs.readFileSync('supabase/browser-orders-preflight.sql','utf8')).simple();
const migration=adminSessions?'202610270003_admin_sessions':'202610250002_browser_orders';
const migrationText=fs.readFileSync('supabase/migrations/'+migration+'.sql','utf8');
fs.writeFileSync(path.join(run,'migration.sql'),migrationText);
await local.unsafe(fs.readFileSync('supabase/migrations/'+migration+'.sql','utf8')).simple();
await local.unsafe(fs.readFileSync('supabase/migrations/'+migration+'.sql','utf8')).simple();
if(adminSessions)await local.unsafe(fs.readFileSync('supabase/admin-sessions-verify.sql','utf8')).simple();
else {const ready=(await local`select browser_orders_ready() as n`)[0].n;if(ready!==1)throw Error('RESTORE_MIGRATION_READINESS_FAILED');}
await local.unsafe(fs.readFileSync('supabase/rollback/'+migration+'.sql','utf8')).simple();
const after=await inventory(local);const originalRows=after.rows.filter(r=>expected.rows.some(x=>x.table===r.table));if(JSON.stringify(originalRows)!==JSON.stringify(expected.rows))throw Error('ROLLBACK_BUSINESS_DATA_MISMATCH');
await local.end();local=null;await tool('pg_ctl',['stop','-D',cluster,'-m','fast','-w']);controlStarted=false;
const report={ok:true,migration,migrationSha256:crypto.createHash('sha256').update(migrationText).digest('hex'),scope:'public schema: all business tables, functions, indexes, constraints, RLS/policies/ACL archive; excludes storage file bodies and other schemas',tableCount:expected.tableCount,functionCount:expected.functionCount,restoreDataMatch:true,restoreDefinitionsMatch:true,localMigrationFirstAndRepeat:true,rollbackBusinessDataPreserved:true,productionBusinessWrites:0,archiveSha256:crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),backupDirectory:run};
fs.writeFileSync(path.join(run,'verified.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.log(JSON.stringify({ok:false,error:e.code||e.message,privateDirectory:run}));process.exitCode=1;}finally{await prod.end({timeout:2}).catch(()=>{});if(local)await local.end({timeout:2}).catch(()=>{});if(controlStarted)await tool('pg_ctl',['stop','-D',path.join(run,'restore-cluster'),'-m','fast','-w']).catch(()=>{});}
