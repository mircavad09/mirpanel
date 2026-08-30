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
const port = 10237;
const code = `globalThis.fetch = async () => new Response(JSON.stringify({message:'Bad credentials'}), {status:401,headers:{'Content-Type':'application/json'}}); await import(${JSON.stringify(new URL('mirpanel-admin/server.mjs',root).href)});`;
const child = spawn(process.execPath, ['--input-type=module','-e',code], {
  cwd: root, env: {...process.env, PORT:String(port), ADMIN_USERNAME:username, ADMIN_PASSWORD:password,
    MIRPANEL_GITHUB_TOKEN:'isolated-fake-token', SUPABASE_URL:'', SUPABASE_SECRET_KEY:'', COOKIE_SECURE:'false'},
  stdio:['ignore','pipe','pipe']
});
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Test server startup timeout')),10000);
    child.stdout.on('data',chunk=>{if(String(chunk).includes('Mirpanel admin:')){clearTimeout(timeout);resolve();}});
    child.once('exit',()=>{clearTimeout(timeout);reject(Error('Test server exited'));});
  });
  const base=`http://127.0.0.1:${port}`;
  const denied=await fetch(base+'/api/session'); assert.equal(denied.status,401);
  const bad=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'wrong-test-value'})});
  assert.equal(bad.status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  assert.equal(login.status,200);
  const setCookie=login.headers.get('set-cookie');
  assert.match(setCookie,/HttpOnly/); assert.match(setCookie,/SameSite=Strict/); assert.match(setCookie,/Path=\//); assert.match(setCookie,/Max-Age=28800/); assert.doesNotMatch(setCookie,/Domain=/);
  const headers={Cookie:setCookie.split(';')[0]};
  const session=await fetch(base+'/api/session',{headers}); assert.equal(session.status,200);
  const admin=await fetch(base+'/admin.html',{headers,redirect:'manual'}); assert.equal(admin.status,200);
  const state=await fetch(base+'/api/admin/state',{headers});
  const stillAuthenticated=await fetch(base+'/api/session',{headers}); assert.equal(stillAuthenticated.status,200);
  const expected=process.argv.includes('--before')?401:502;
  assert.equal(state.status,expected);
  if (!process.argv.includes('--before')) {
    assert.equal((await state.json()).code,'GITHUB_ACCESS_FAILED');
    assert.equal((await denied.json()).code,'ADMIN_SESSION_REQUIRED');
  }
  const reload=await fetch(base+'/admin.html',{headers,redirect:'manual'}); assert.equal(reload.status,200);
  const noCookie=await fetch(base+'/admin.html',{redirect:'manual'}); assert.equal(noCookie.status,302);
  console.log(JSON.stringify({login:login.status,adminPage:admin.status,upstreamGithub:401,adminState:state.status,sessionAfterFailure:stillAuthenticated.status,cookieAttributes:{httpOnly:true,sameSite:'Strict',path:'/',maxAge:28800,hostOnly:true},realDataTouched:false}));
} finally {
  child.kill(); await once(child,'exit');
}

// Browser login uses only synthetic values. Never reads real browser credentials.
const loginSource=fs.readFileSync(new URL('mirpanel-admin/public/login.js',root),'utf8');
for(const mode of ['success','missing-cookie','lost-session','session-503','session-offline']) {
  let submit; const calls=[]; const attributes={};
  const elements={loginForm:{addEventListener(_,fn){submit=fn;}},loginBtn:{disabled:false},loginError:{setAttribute(k,v){attributes[k]=v;},removeAttribute(k){delete attributes[k];}},username:{value:'test'},password:{value:'test'}};
  const location={search:'',href:''};
  const context=vm.createContext({document:{getElementById:id=>elements[id]},location,URLSearchParams,AbortController,setTimeout,clearTimeout,
    fetch:async(path,options)=>{calls.push(path);assert.equal(options.credentials,'same-origin');
      if(path==='/api/login')return Response.json({ok:true});
      if(mode==='session-offline')throw new TypeError('offline');
      if(mode==='session-503')return Response.json({error:'unavailable'},{status:503});
      if(mode==='success')return Response.json({ok:true,csrfToken:'synthetic-only'});
      return Response.json({code:'ADMIN_SESSION_REQUIRED',reason:mode==='missing-cookie'?'cookie_not_received':'session_not_found'},{status:401});
    }});
  vm.runInContext(loginSource,context); await submit({preventDefault(){}});
  assert.deepEqual(calls,['/api/login','/api/session']);
  assert.equal(location.href,mode==='success'?'/admin.html':'');
  assert.equal(attributes['data-login-status'],'200');
  if(mode!=='success')assert.equal(elements.loginBtn.disabled,false);
  assert.equal(elements.password.value,'test');
}
const adminSource=fs.readFileSync(new URL('mirpanel-admin/public/admin.js',root),'utf8');
const loadStateSource=adminSource.slice(adminSource.indexOf('async function loadState()'),adminSource.indexOf('async function saveState()'));
for(const [status,code,redirect] of [[401,'ADMIN_SESSION_REQUIRED',true],[401,'GITHUB_ACCESS_FAILED',false],[403,undefined,false],[502,'GITHUB_ACCESS_FAILED',false],[503,undefined,false]]) {
  const location={href:''}; let message='';
  const context=vm.createContext({location,$:()=>({textContent:''}),setLoading(){},toast(value){message=value;},api:async()=>{throw Object.assign(Error('isolated failure'),{status,code});}});
  vm.runInContext(loadStateSource,context);await vm.runInContext('loadState()',context);
  assert.equal(Boolean(location.href),redirect);if(!redirect)assert.equal(message,'isolated failure');
}
console.log(JSON.stringify({browserSessionScenarios:5,adminRedirectScenarios:5,passed:true}));
