// Password is supplied only through stdin by the current user's DPAPI store.
import postgres from '../payment-test-artifacts/postgres-driver/package/src/index.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const credential=JSON.parse(input);input='';
const caResponse=await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt');
if(!caResponse.ok)throw Error('OFFICIAL_CA_UNAVAILABLE');
const ca=await caResponse.text();
const sql=postgres({host:'aws-0-eu-central-1.pooler.supabase.com',port:5432,database:'postgres',username:credential.username,password:credential.password,ssl:{rejectUnauthorized:true,ca},prepare:false,max:1,connect_timeout:15,connection:{application_name:'mirpanel-backup-preflight',default_transaction_read_only:'on',statement_timeout:15000},onnotice:()=>{}});
credential.password='';
try{const r=await sql`select current_setting('server_version') as version, public.employee_system_ready() as schema`;
console.log(JSON.stringify({connected:true,version:r[0].version,schema:r[0].schema,readOnly:true}));
console.log(JSON.stringify({extensions:await sql`select e.extname,n.nspname as schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace`,publicTables:(await sql`select count(*)::int as n from pg_tables where schemaname='public'`)[0].n,externalForeignKeys:await sql`select distinct n.nspname as target_schema from pg_constraint c join pg_class s on s.oid=c.conrelid join pg_namespace sn on sn.oid=s.relnamespace join pg_class t on t.oid=c.confrelid join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and sn.nspname='public' and n.nspname<>'public'`}));
}catch(e){console.log(JSON.stringify({connected:false,code:e.code||'CONNECTION_FAILED',readOnly:true}));process.exitCode=1;}finally{await sql.end({timeout:2});}
