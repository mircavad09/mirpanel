// Read-only production diagnostics: durations only, never account/message data.
import fs from 'node:fs';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {Repository} from '../mirpanel-admin/community/repository.mjs';
import {counts} from '../mirpanel-admin/community/public-service.mjs';
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const r=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars?limit=100',{headers:{Authorization:'Bearer '+key}});
if(!r.ok)throw Error('CONFIG_READ_'+r.status);
const env=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:5,options:'-c search_path=mirpanel_community,public -c default_transaction_read_only=on -c statement_timeout=15000'});
const samples=[];
const wrapped={query:async(...args)=>{const at=performance.now();try{return await pool.query(...args);}finally{samples.push(Math.round(performance.now()-at));}}};
try{const repo=new Repository(wrapped);for(let i=0;i<5;i++){samples.length=0;const at=performance.now();await repo.messages();console.log(JSON.stringify({scope:'Windows-to-production database read-only, not Render execution',operation:'snapshot',ms:Math.round(performance.now()-at),queryMs:samples.slice()}));const t=performance.now();await counts(pool);console.log(JSON.stringify({operation:'counts',ms:Math.round(performance.now()-t)}));}}finally{await pool.end();}
