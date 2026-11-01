// Read-only schema/configuration checks. No secret values or customer rows emitted.
import fs from 'node:fs';import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const r=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars?limit=100',{headers:{Authorization:'Bearer '+key}});if(!r.ok)throw Error('RENDER_'+r.status);
const env=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,connectionTimeoutMillis:15000,options:'-c default_transaction_read_only=on -c statement_timeout=15000'});
try{const tables=['user','session','account','owner_identity','community_profiles','community_member_numbers','profile_media','community_order_owners','community_presence','community_bot_tags','community_bot_blocks','public_community_release'];const result=[];for(const name of tables){const v=(await pool.query('select to_regclass($1) is not null as present',['mirpanel_community.'+name])).rows[0];result.push({name,present:v.present});}
 console.log(JSON.stringify({productionReadOnly:true,publicFlagEnabled:env.COMMUNITY_PUBLIC_ENABLED==='true',schema:result,productionWrites:0}));
}finally{await pool.end();}
const token=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});const v=await token.json();console.log(JSON.stringify({mailAuthorizationStatus:token.status,error:v.error||null,realEmailSent:false}));
