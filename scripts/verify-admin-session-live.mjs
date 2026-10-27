// Login/read/logout only. Never edits catalogue, uploads files or creates orders.
import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import assert from'node:assert/strict';
const key=fs.readFileSync(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const r=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('ENV_READ_UNAVAILABLE');const config=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
const base='https://mirpanel.onrender.com',report={businessWrites:0,uploads:0,sessionWrites:'one login/activity/logout only'};
const request=(p,options={})=>fetch(base+p,{...options,signal:AbortSignal.timeout(30000),redirect:'manual'});
let cookie='',csrf='';
try{
 const login=await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:config.ADMIN_USERNAME,password:config.ADMIN_PASSWORD})});config.ADMIN_PASSWORD='';report.login=login.status;assert.equal(login.status,200);const set=login.headers.get('set-cookie')||'';assert.match(set,/HttpOnly/);assert.match(set,/Secure/);assert.match(set,/SameSite=Strict/);assert.match(set,/Max-Age=3600/);cookie=set.split(';')[0];
 const headers={Cookie:cookie};const session=await request('/api/session',{headers}),s=await session.json();csrf=s.csrfToken;assert.equal(session.status,200);assert.equal(s.idleSeconds,3600);report.idleSeconds=s.idleSeconds;report.cookieSecure=true;
 for(const p of ['/admin.html','/admin/users','/api/admin/state','/api/admin/users']){const q=await request(p,{headers});report[p]=q.status;assert.equal(q.status,200);if(p==='/admin.html'){const html=await q.text();assert.ok(html.includes('/admin-session.js?v=idle-20261027-1'));assert.ok(html.includes('admin.js?v=admin-idle-20261027-1'));}}
 const poll=await(await request('/api/session',{headers})).json();assert.equal(poll.expiresAt,s.expiresAt);report.pollDoesNotExtend=true;
 const activity=await request('/api/session/activity',{method:'POST',headers:{...headers,Origin:base,'X-CSRF-Token':csrf}});assert.equal(activity.status,200);report.activity=activity.status;assert.match(activity.headers.get('set-cookie'),/Max-Age=3600/);
 for(const name of ['admin.js','admin-session.js','admin-draft.js']){const q=await request('/'+name+'?v=admin-idle-20261027-1');assert.equal(q.status,200);assert.equal((await q.text()).replace(/\r\n/g,'\n'),fs.readFileSync('mirpanel-admin/public/'+name,'utf8').replace(/\r\n/g,'\n'));}report.assetBytesMatch=true;
 const health=await request('/api/payments/health');assert.equal(health.status,200);report.health=200;
 report.employeeGuest=(await request('/api/employee/session')).status;assert.equal(report.employeeGuest,401);
}finally{
 if(cookie&&csrf){const out=await request('/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:base,'X-CSRF-Token':csrf}});report.logout=out.status;assert.equal(out.status,200);const denied=await request('/api/session',{headers:{Cookie:cookie}});assert.equal(denied.status,401);report.revokedCookieReplay=401;}
}
console.log(JSON.stringify(report));fs.mkdirSync('payment-test-artifacts/admin-session',{recursive:true});fs.writeFileSync('payment-test-artifacts/admin-session/live-verification.json',JSON.stringify(report,null,2));
