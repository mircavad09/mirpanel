import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
const temporary=net.createServer();await new Promise(r=>temporary.listen(0,'127.0.0.1',r));
const port=temporary.address().port;await new Promise(r=>temporary.close(r));
const child=spawn(process.execPath,['mirpanel-admin/server.mjs'],{env:{...process.env,PORT:String(port),SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',ADMIN_USERNAME:'',ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
let started='';child.stdout.on('data',b=>started+=b);let stderr='';child.stderr.on('data',b=>stderr+=b);
try{
 const origin=`http://127.0.0.1:${port}`;
 let ready=false;
 for(let i=0;i<100;i++){try{await fetch(origin+'/product-plan-utils.mjs');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.ok(ready,'isolated server starts');
 const module=await fetch(origin+'/product-plan-utils.mjs');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
 for(const method of ['GET','PATCH']){
  const res=await fetch(origin+'/api/admin/product-sales',{method,...(method==='PATCH'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});assert.equal(res.status,401);
 }
 assert.equal((await fetch(origin+'/api/admin/product-sales/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"confirm":true}'})).status,401);
 const options=await fetch(origin+'/api/product-sales?productId=capcut',{method:'OPTIONS',headers:{Origin:'https://mirpanel.com'}});assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),'https://mirpanel.com');
 const absent=await fetch(origin+'/api/product-sales?productId=capcut',{headers:{Origin:'https://mirpanel.com'}});assert.equal(absent.status,503);assert.equal(absent.headers.get('cache-control'),'no-store');
 assert.equal(absent.headers.get('access-control-allow-origin'),'https://mirpanel.com');
 console.log(JSON.stringify({unauthenticatedRead:401,unauthenticatedEdit:401,unauthenticatedInitialization:401,publicCors:204,missingDatabase:503,noFakeStatistics:true,moduleMime:'JavaScript',productionWrites:0}));
}finally{child.kill();await new Promise(r=>child.once('exit',r));}
