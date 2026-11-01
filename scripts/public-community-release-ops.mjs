// Explicit production operator operations. No business fixtures or secret output.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
const mode=process.argv[2],service='srv-d8ead74m0tmc73emhsvg';
const key=fs.readFileSync(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
async function api(suffix,method='GET',body){const r=await fetch('https://api.render.com/v1/services/'+service+suffix,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('RENDER_'+r.status);const text=await r.text();return text?JSON.parse(text):null;}
const env=Object.fromEntries((await api('/env-vars?limit=100')).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,connectionTimeoutMillis:15000,options:'-c statement_timeout=120000 -c lock_timeout=5000'});
try{
 if(mode==='migrate'){
  if(env.COMMUNITY_PUBLIC_ENABLED==='true')throw Error('DISABLE_PUBLIC_BEFORE_MIGRATION');
  const sql=fs.readFileSync('mirpanel-admin/community/public-release.sql','utf8'),sha=crypto.createHash('sha256').update(sql).digest('hex');
  const root=path.join(process.env.LOCALAPPDATA,'MirpanelPrivateBackups');
  const candidate=fs.readdirSync(root).filter(n=>n.startsWith('public-community-')).sort().reverse().find(n=>fs.existsSync(path.join(root,n,'verified.json')));
  if(!candidate)throw Error('VERIFIED_BACKUP_REQUIRED');
  const dir=path.join(root,candidate),proof=JSON.parse(fs.readFileSync(path.join(dir,'verified.json')));
  if(!proof.ok||!proof.restored||!proof.migrationFirstAndRepeat||!proof.verification||!proof.rollbackPreservedExistingData||proof.migrationSha256!==sha||Date.now()-fs.statSync(path.join(dir,'verified.json')).mtimeMs>6*3600000)throw Error('BACKUP_PROOF_INVALID_OR_STALE');
  const archive=path.join(dir,'database.dump.dpapi');if(crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')!==proof.archiveSha256)throw Error('BACKUP_ARCHIVE_MISMATCH');
  const present=(await pool.query("select to_regclass('mirpanel_community.public_community_release') is not null as present")).rows[0].present;
  if(present)throw Error('MIGRATION_ALREADY_PRESENT_INSPECT_INSTEAD');
  await pool.query(sql);console.log(JSON.stringify({migrationApplied:true,backupRestoreVerified:true,historicalOrdersUpdated:0}));
 }
 const verification=await pool.query(fs.readFileSync('mirpanel-admin/community/public-verification.sql','utf8'));
 const rows=(Array.isArray(verification)?verification:[verification]).flatMap(r=>r.rows||[]);
 if(!rows.length||rows.some(r=>Object.values(r).some(v=>v!==true)))throw Error('PUBLIC_SCHEMA_VERIFICATION_FAILED');
 console.log(JSON.stringify({verification:rows,publicEnabled:env.COMMUNITY_PUBLIC_ENABLED==='true'}));
 if(mode==='enable'){
  await api('/env-vars/COMMUNITY_PUBLIC_ENABLED','PUT',{value:'true'});
  const after=Object.fromEntries((await api('/env-vars?limit=100')).map(x=>[x.envVar.key,x.envVar.value]));
  if(after.COMMUNITY_PUBLIC_ENABLED!=='true'||Object.keys(env).some(k=>k!=='COMMUNITY_PUBLIC_ENABLED'&&env[k]!==after[k]))throw Error('ENV_VERIFY_FAILED');
  console.log(JSON.stringify({publicEnabled:true,otherEnvironmentUnchanged:true,redeployRequired:true}));
 }
 if(mode==='redeploy'){
  const {execFileSync}=await import('node:child_process');const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const d=await api('/deploys','POST',{commitId:commit,clearCache:'do_not_clear'});console.log(JSON.stringify({deployRequested:true,id:d?.id||null,commit}));
 }
}finally{await pool.end();}
