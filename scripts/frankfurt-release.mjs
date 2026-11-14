// Explicit operator actions. No secret or business record is printed or copied.
import fs from'node:fs/promises';import{execFileSync}from'node:child_process';
const mode=process.argv[2]||'status',legacy='srv-d8ead74m0tmc73emhsvg',active='srv-dbse90u1egvs73djpp2g',oldUrl='https://mirpanel.onrender.com',newUrl='https://mirpanel-frankfurt.onrender.com';
const key=(await fs.readFile(process.env.USERPROFILE+'/.render/cli.yaml','utf8')).match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
async function api(path,method='GET',body){const r=await fetch('https://api.render.com/v1'+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('RENDER_'+r.status);const t=await r.text();return t?JSON.parse(t):null;}
const health=async url=>{try{const r=await fetch(url+'/__deployment/health',{signal:AbortSignal.timeout(15000)});return r.ok?await r.json():{ok:false,status:r.status};}catch{return{ok:false};}};
async function role(id,value){const path='/services/'+id+'/env-vars',before=(await api(path+'?limit=100')).map(x=>x.envVar);await api(path+'/MIRPANEL_RUNTIME_ROLE','PUT',{value});const after=new Map((await api(path+'?limit=100')).map(x=>[x.envVar.key,x.envVar.value]));if(before.some(x=>x.key!=='MIRPANEL_RUNTIME_ROLE'&&after.get(x.key)!==x.value)||after.get('MIRPANEL_RUNTIME_ROLE')!==value)throw Error('ENV_PARITY_FAILED');}
async function deploy(id){const commitId=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();const d=await api('/services/'+id+'/deploys','POST',{commitId,clearCache:'do_not_clear'});console.log(JSON.stringify({service:id,deploy:d.id,status:d.status,commit:commitId}));}
try{
 if(mode==='stage-legacy'){
  const ready=await health(newUrl),s=await api('/services/'+active);if(ready.role!=='web'||ready.workers!==false||s.serviceDetails.region!=='frankfurt'||s.serviceDetails.plan!=='0.5c-512mb')throw Error('FRANKFURT_WEB_REQUIRED');
  await role(legacy,'relay');await api('/services/'+legacy,'PATCH',{autoDeployTrigger:'off'});console.log(JSON.stringify({legacyStaged:true,legacyRunningRevisionUnchanged:true,workersStillInLegacyUntilDeploy:true}));
 }else if(mode==='deploy-legacy'){
  if((await health(newUrl)).role!=='web')throw Error('FRANKFURT_WEB_REQUIRED');await deploy(legacy);
 }else if(mode==='promote'){
  const old=await health(oldUrl),next=await health(newUrl);if(old.role!=='relay'||old.workers!==false||next.role!=='web')throw Error('LEGACY_RELAY_AND_FRANKFURT_WEB_REQUIRED');
  await role(active,'active');await api('/services/'+active,'PATCH',{branch:'main',autoDeployTrigger:'commit'});await deploy(active);
 }else if(mode==='status'){
  for(const [id,url]of[[legacy,oldUrl],[active,newUrl]]){const s=await api('/services/'+id),d=await api('/services/'+id+'/deploys?limit=1');console.log(JSON.stringify({id,region:s.serviceDetails.region,plan:s.serviceDetails.plan,branch:s.branch,autoDeploy:s.autoDeploy,deploy:d[0]?.deploy.status,commit:d[0]?.deploy.commit?.id,health:await health(url)}));}
 }else throw Error('UNKNOWN_RELEASE_MODE');
}catch(e){console.log(JSON.stringify({ok:false,error:/^[A-Z_\d]+$/.test(e.message)?e.message:'RELEASE_FAILED'}));process.exitCode=1;}
