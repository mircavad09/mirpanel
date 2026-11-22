// Isolated HTTP integration test: synthetic credentials, no production API calls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
assert.equal(fs.existsSync(new URL('mirpanel-admin/.env', root)), false, 'Test must not load real credentials');
const username = 'isolated-auth-test';
const password = crypto.randomBytes(24).toString('hex');
const port = 36913;
const code = `globalThis.fetch = async () => new Response(JSON.stringify({message:'Bad credentials'}), {status:401,headers:{'Content-Type':'application/json'}}); await import(${JSON.stringify(new URL('mirpanel-admin/server.mjs',root).href)});`;
const child = spawn(process.execPath, ['--input-type=module','-e',code], {
  cwd: root, env: {...process.env, PORT:String(port), ADMIN_USERNAME:username, ADMIN_PASSWORD:password,
    PAYMENT_ENCRYPTION_KEY_B64:crypto.randomBytes(32).toString('base64'),PAYMENT_TOKEN_SECRET_B64:crypto.randomBytes(32).toString('base64'),MIRPANEL_GITHUB_TOKEN:'isolated-fake-token', SUPABASE_URL:'', SUPABASE_SECRET_KEY:'', COOKIE_SECURE:'false'},
  stdio:['ignore','pipe','pipe']
});
let childError="";child.stderr.on("data",b=>childError+=b);
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Test server startup timeout')),10000);
    child.stdout.on('data',chunk=>{if(String(chunk).includes('Mirpanel admin:')){clearTimeout(timeout);resolve();}});
    child.once('exit',()=>{clearTimeout(timeout);reject(Error('Test server exited: '+childError));});
  });
  const base=`http://127.0.0.1:${port}`;
  for(const path of ['/api/admin/community/users/test/orders/00000000-0000-4000-8000-000000000001','/api/admin/users/test/orders/00000000-0000-4000-8000-000000000001','/admin-user-orders.js'])assert.equal((await fetch(base+path)).status,401);
  console.log('PASS production HTTP router denies anonymous customer-order detail and protected UI module');
}finally{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
