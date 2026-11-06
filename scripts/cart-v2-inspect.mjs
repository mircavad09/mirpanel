// Read-only schema diagnostic. Never outputs configuration, accounts or orders.
import fs from 'node:fs';import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const r=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars?limit=100',{headers:{Authorization:'Bearer '+key}});if(!r.ok)throw Error('CONFIG_READ_FAILED');const env=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,options:'-c default_transaction_read_only=on'});
try{const f=await pool.query("select pg_get_functiondef('public.product_sales_snapshot()'::regprocedure) definition");console.log(f.rows[0].definition);}finally{await pool.end();}
