// Owner-authorized sales reconciliation. Credentials arrive only on stdin.
// --apply changes only sales projection/functions/triggers, never commerce rows.
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import fs from 'node:fs';import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
let raw='';for await(const chunk of process.stdin)raw+=chunk;const access=JSON.parse(raw);raw='';
const ca=await(await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt')).text();
const apply=process.argv.includes('--apply');
const pool=new pg.Pool({host:'aws-0-eu-central-1.pooler.supabase.com',port:5432,database:'postgres',user:access.username,password:access.password,ssl:{rejectUnauthorized:true,ca},max:1,connectionTimeoutMillis:15000,options:'-c application_name=mirpanel-paid-sales-audit -c statement_timeout=60000'+(apply?'':' -c default_transaction_read_only=on')});access.password='';
fs.mkdirSync('outputs',{recursive:true});
try{
 const before=(await pool.query('select product_sales_snapshot() v')).rows[0].v;
 const backup={at:new Date().toISOString(),snapshot:before,baselines:(await pool.query('select * from product_sales_baselines order by product_id')).rows,settings:(await pool.query('select * from product_sales_settings')).rows,functions:(await pool.query("select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'product_sales_%'")).rows};
 fs.writeFileSync('outputs/paid-sales-backup-'+Date.now()+'.json',JSON.stringify(backup,null,2));
 if(apply)await pool.query(fs.readFileSync('mirpanel-admin/community/product-sales-paid.sql','utf8'));
 const after=(await pool.query('select product_sales_snapshot() v')).rows[0].v;
 if(JSON.stringify(before.baselines)!==JSON.stringify(after.baselines))throw Error('BASELINES_CHANGED');
 if(apply){await pool.query(fs.readFileSync('mirpanel-admin/community/product-sales-paid.sql','utf8'));const replay=(await pool.query('select product_sales_snapshot() v')).rows[0].v;if(JSON.stringify(after.real)!==JSON.stringify(replay.real))throw Error('REPLAY_OR_LIVE_SALE_CHANGED_RECHECK');}
 const unresolved=(await pool.query(`select count(*)::int orders from public.payment_orders o join mirpanel_community.community_refunds r on r.order_id=o.id where r.cents>0 and o.payment_confirmed and jsonb_typeof(o.fulfillment_cancellation->'lines') is distinct from 'array'`)).rows[0];
 const baseline=new Map(after.baselines.map(x=>[x.product_id,Number(x.count)])),old=new Map(before.real.map(x=>[x.product_id,Number(x.count)])),now=new Map(after.real.map(x=>[x.product_id,Number(x.count)]));
 const names=new Map(extractAdminState(fs.readFileSync('app.js','utf8')).products.map(p=>[p.id,p.title]));
 const products=[...new Set([...names.keys(),...baseline.keys(),...old.keys(),...now.keys()])].sort().map(id=>({productId:id,title:names.get(id)||id,baseline:baseline.get(id)||0,before:(baseline.get(id)||0)+(old.get(id)||0),real:now.get(id)||0,after:(baseline.get(id)||0)+(now.get(id)||0),delta:(now.get(id)||0)-(old.get(id)||0)}));
 const report={at:new Date().toISOString(),apply,rule:after.countingRule,baselineTotal:after.distributed,realTotal:after.realTotal,verifiedPaid:after.verifiedPaidUnits,legacy:after.legacyInferredUnits,unresolvedRefunds:unresolved.orders,products};
 fs.writeFileSync('outputs/paid-sales-'+(apply?'applied':'verified')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await pool.end()}
