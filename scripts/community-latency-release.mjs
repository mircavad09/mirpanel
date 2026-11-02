import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const mode=process.argv[2],commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
try{
 if(mode==='cloudflare-status'){
 const token=fs.readFileSync(process.env.APPDATA+'/xdg.config/.wrangler/config/default.toml','utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)[1];
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/b4f44ce8fa1d4ebe4731bb4c529e4b8b/pages/projects/mirpanel',{headers:{Authorization:'Bearer '+token}});const v=await r.json();console.log(JSON.stringify({status:r.status,success:v.success,stage:v.result?.latest_deployment?.latest_stage?.status,commit:v.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash}));
 }else{
 const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
 const base='https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/deploys';
 const r=await fetch(base+(mode==='render-deploy'?'':'?limit=5'),{method:mode==='render-deploy'?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(mode==='render-deploy'?{body:JSON.stringify({commitId:commit,clearCache:'do_not_clear'})}:{})});
 if(!r.ok)throw Error('RENDER_'+r.status);const v=await r.json();console.log(JSON.stringify((Array.isArray(v)?v.map(x=>x.deploy):[v]).map(d=>({id:d.id,status:d.status,commit:d.commit?.id}))));
 }
}catch(e){console.log(JSON.stringify({error:/^RENDER_\d+$/.test(e.message)?e.message:'RELEASE_ACCESS_FAILED'}));process.exitCode=1;}
