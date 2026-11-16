// Operational diagnostics only. No settings, business records or services are changed.
import fs from 'node:fs';
const out='outputs/system-incident';fs.mkdirSync(out,{recursive:true});
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const service='srv-dbse90u1egvs73djpp2g';
async function api(p){const r=await fetch('https://api.render.com/v1'+p,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(25000)});if(!r.ok)return{error:r.status};return r.json();}
const safe=s=>String(s).replace(/\x1b\[[0-9;]*m/g,'').replace(/https?:\/\/[^\s'"<>]+/g,'<url>').replace(/[\w.+-]+@[\w.-]+/g,'<email>').replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/ig,'<id>').replace(/\b[A-Za-z0-9_+\/-]{45,}\b/g,'<redacted>').replace(/\{.*$/,'[metadata omitted]').slice(0,260);
const mode=process.argv[2]||'matrix';
if(mode==='matrix'){
 const paths=['/','/login.html','/__deployment/health','/api/payments/health','/api/payments/inventory','/api/payments/storefront','/api/homepage-banners','/api/stories','/api/community/state','/api/auth/get-session','/api/session'];
 const results=[];
 for(const origin of ['https://mirpanel.com','https://mirpanel-frankfurt.onrender.com','https://mirpanel.onrender.com']){
  await Promise.all(paths.map(async p=>{const at=performance.now();try{const r=await fetch(origin+p,{signal:AbortSignal.timeout(32000),redirect:'manual'});const body=await r.text();let summary={};try{const j=JSON.parse(body);summary={code:j.code,ok:j.ok,products:j.products?.length,stories:j.stories?.length,banners:j.banners?.length,authenticated:!!j.profile};}catch{}results.push({origin,path:p,status:r.status,ms:Math.round(performance.now()-at),type:r.headers.get('content-type'),server:r.headers.get('server'),location:r.headers.get('location'),requestId:r.headers.get('rndr-id'),...summary});}catch(e){results.push({origin,path:p,error:e.name,ms:Math.round(performance.now()-at)});}}));
 }
 fs.writeFileSync(out+'/matrix.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}else if(mode==='logs'){
 const s=await api('/services/'+service);const owner=s.ownerId;
 console.log(JSON.stringify({service:s.id,owner,region:s.serviceDetails?.region,plan:s.serviceDetails?.plan,suspended:s.suspended,suspenders:s.suspenders,healthCheckPath:s.serviceDetails?.healthCheckPath,updatedAt:s.updatedAt}));
 const deployments=await api('/services/'+service+'/deploys?limit=10');console.log(JSON.stringify({deployments:Array.isArray(deployments)?deployments.map(x=>({id:x.deploy.id,status:x.deploy.status,createdAt:x.deploy.createdAt,finishedAt:x.deploy.finishedAt,commit:x.deploy.commit?.id})):deployments}));
 let query=new URLSearchParams({ownerId:owner,resource:service,limit:'100',startTime:new Date(Date.now()-12*3600000).toISOString(),direction:'backward'}),results=[];
 for(let i=0;i<8;i++){
  const data=await api('/logs?'+query);if(data.error){console.log(JSON.stringify(data));break;}
  const logs=data.logs||[];if(i===0)console.log(JSON.stringify({keys:Object.keys(data),logKeys:logs[0]?Object.keys(logs[0]):[]}));
  for(const l of logs){const msg=l.message||l.text||'';if(/memory|heap|SIGTERM|exited|error|timeout|ECONN|ETIMED|connection|live|port|OOM|502|503|health|pool|deploy|restart/i.test(msg))results.push({time:l.timestamp,message:safe(msg),labels:l.labels?.filter?.(x=>['level','type','instance','statusCode'].includes(x.name))});}
  if(!data.hasMore)break;query.set('startTime',data.nextStartTime);query.set('endTime',data.nextEndTime);
 }
 fs.writeFileSync(out+'/logs-sanitized.json',JSON.stringify(results,null,2));console.log(JSON.stringify({count:results.length,relevant:results.filter(x=>!x.message.startsWith('READY_STOCK_QUEUE_RESULT')).slice(0,50)}));
}else if(mode==='errors'){
 const s=await api('/services/'+service),results=[];
 for(const text of ['error','exited','memory','SIGTERM','connection','502','health','crash']){
  const query=new URLSearchParams({ownerId:s.ownerId,resource:service,limit:'100',startTime:new Date(Date.now()-24*3600000).toISOString(),direction:'backward',text});
  const data=await api('/logs?'+query);
  results.push({filter:text,error:data.error,hasMore:data.hasMore,logs:data.logs?.map(l=>({time:l.timestamp,message:safe(l.message),labels:l.labels?.filter(x=>['instance','type','level','statusCode'].includes(x.name))}))});
 }
 fs.writeFileSync(out+'/errors-sanitized.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}else if(mode==='database'){
 const env=Object.fromEntries((await api('/services/'+service+'/env-vars?limit=100')).map(x=>[x.envVar.key,x.envVar.value]));
 const {default:pg}=await import('../mirpanel-admin/node_modules/pg/esm/index.mjs');
 const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,max:1,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},options:'-c default_transaction_read_only=on -c statement_timeout=5000'});pool.on('error',()=>{});
 const values=[];
 try{for(let i=0;i<3;i++){const at=performance.now();await pool.query('select 1');values.push(Math.round(performance.now()-at));}
 const state=(await pool.query(`select current_setting('transaction_read_only') read_only,current_setting('max_connections') max_connections,(select count(*) from pg_stat_activity) connections,(select count(*) from pg_stat_activity where state='active') active,(select count(*) from pg_stat_activity where state='idle in transaction') idle_in_transaction,(select max(extract(epoch from now()-query_start)) from pg_stat_activity where state='active' and pid<>pg_backend_pid()) oldest_active_seconds`)).rows[0];console.log(JSON.stringify({kind:'native-postgres',queryMs:values,state}));
 }catch(e){console.log(JSON.stringify({kind:'native-postgres',error:e.code||e.name}));}finally{await pool.end();}
 for(let i=0;i<3;i++){const at=performance.now();try{const r=await fetch(env.SUPABASE_URL+'/rest/v1/payment_orders?select=id&limit=0',{headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+env.SUPABASE_SECRET_KEY},signal:AbortSignal.timeout(10000)});await r.arrayBuffer();console.log(JSON.stringify({kind:'supabase-rest-empty-read',status:r.status,ms:Math.round(performance.now()-at)}));}catch(e){console.log(JSON.stringify({kind:'supabase-rest-empty-read',error:e.name,ms:Math.round(performance.now()-at)}));}}
}else if(mode==='context'){
 const s=await api('/services/'+service),start=process.argv[3]||'2026-11-16T12:10:40Z',end=process.argv[4]||'2026-11-16T12:11:20Z';
 const q=new URLSearchParams({ownerId:s.ownerId,resource:service,limit:'100',startTime:start,endTime:end,direction:'forward'});
 const data=await api('/logs?'+q);
 console.log(JSON.stringify((data.logs||[]).map(l=>({time:l.timestamp,message:safe(l.message)}))));
}else if(mode==='metric-spec'){
 const spec=await(await fetch('https://api-docs.render.com/openapi/render-public-api-1.json')).json();
 console.log(JSON.stringify(Object.keys(spec.paths).filter(p=>p.startsWith('/metrics'))));
}else if(mode==='metrics'){
 const endTime=new Date().toISOString(),startTime=new Date(Date.now()-6*3600000).toISOString();
 for(const name of ['memory','memory-limit','cpu','cpu-limit','http-requests','http-latency']){
  const value=await api('/metrics/'+name+'?'+new URLSearchParams({resource:service,startTime,endTime,resolutionSeconds:'60'}));
  fs.writeFileSync(out+'/metrics-'+name+'.json',JSON.stringify(value,null,2));console.log(JSON.stringify({metric:name,error:value.error,shape:Array.isArray(value)?value.map(x=>({keys:Object.keys(x),labels:x.labels,first:x.values?.[0],last:x.values?.at(-1),count:x.values?.length})):Object.keys(value)}));
 }
}
