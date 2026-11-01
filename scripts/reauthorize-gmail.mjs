// Local-only consent handoff. Never emits authorization codes, tokens or secrets.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function validSender(info, sender){return info?.email_verified===true && String(info.email).toLowerCase()===sender.toLowerCase() && typeof info.sub==='string' && info.sub.length>0;}
export function authorizationUrl(clientId, redirect, state, verifier, sender){
 const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 u.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:'openid email https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',login_hint:sender,state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});return u.href;
}
export function validState(actual,expected){return typeof actual==='string'&&Buffer.byteLength(actual)===Buffer.byteLength(expected)&&crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected));}

async function main(){
 const key=fs.readFileSync(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
 const r=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars?limit=100',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('RENDER_CONFIGURATION_UNAVAILABLE');
 const env=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
 for(const name of ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_SENDER_EMAIL'])if(!env[name])throw Error('GMAIL_CONFIGURATION_MISSING');
 const redirect='http://127.0.0.1:8765/oauth/callback',state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
 const auth=authorizationUrl(env.GMAIL_CLIENT_ID,redirect,state,verifier,env.GMAIL_SENDER_EMAIL);
 let busy=false,done=false;
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>MirPanel Gmail icazəsi</title><main style="font:18px system-ui;max-width:640px;margin:60px auto;padding:24px">'+body+'</main>');};
  if(req.headers.host!=='127.0.0.1:8765')return reply(403,'Giriş qadağandır.');
  const u=new URL(req.url,redirect);
  if(req.method!=='GET')return reply(405,'İcazə verilmir.');
  if(u.pathname==='/')return reply(200,done?'Google icazəsi təhlükəsiz saxlanılıb. Bu pəncərəni bağlaya bilərsiniz.':'<h1>MirPanel e-poçt icazəsi</h1><p>Yalnız mövcud göndərən hesabı ilə davam edin. Google icazəsindən sonra bu lokal səhifəyə qayıdacaqsınız.</p><p><a href="/start">Google ilə icazəni yenilə</a></p>');
  if(u.pathname==='/start'&&!done){res.writeHead(302,{Location:auth});return res.end();}
  if(u.pathname!=='/oauth/callback')return reply(404,'Tapılmadı.');
  if(!validState(u.searchParams.get('state'),state)||done||busy)return reply(409,'Bu cəhd etibarlı deyil. Lokal başlanğıc səhifəsinə qayıdın.');
  if(u.searchParams.has('error')||!u.searchParams.get('code'))return reply(400,'Google icazəsi tamamlanmadı. Yenidən cəhd edin.');
  busy=true;
  try{
   const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,code:u.searchParams.get('code'),redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
   const token=await t.json();if(!t.ok||!token.refresh_token||!token.access_token)throw Error('TOKEN_EXCHANGE_FAILED');
   const identity=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
   if(!identity.ok||!validSender(await identity.json(),env.GMAIL_SENDER_EMAIL))throw Error('SENDER_ACCOUNT_MISMATCH');
   if(!String(token.scope||'').split(' ').includes('https://www.googleapis.com/auth/gmail.send'))throw Error('MAIL_PERMISSION_MISSING');
   // Current-user DPAPI and protected DACL, no SACL/admin privilege needed.
   execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',[
    '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.Security;',
    '$dir=Join-Path $env:LOCALAPPDATA "MirpanelPrivateCredentials"; [void][IO.Directory]::CreateDirectory($dir);',
    '$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;',
    '& icacls.exe $dir /inheritance:r /grant:r "${sid}:(OI)(CI)F" | Out-Null; if($LASTEXITCODE -ne 0){throw "ACL_FAILED"};',
    '$raw=[Console]::In.ReadToEnd(); $bytes=[Text.Encoding]::UTF8.GetBytes($raw);',
    '$enc=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);',
    '$file=Join-Path $dir "gmail-reauthorized.dpapi"; [IO.File]::WriteAllBytes($file,$enc);',
    '$check=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);',
    'if([Convert]::ToBase64String($check) -ne [Convert]::ToBase64String($bytes)){throw "ENCRYPTION_CHECK_FAILED"};'
   ].join(' ')],{input:JSON.stringify({clientId:env.GMAIL_CLIENT_ID,sender:env.GMAIL_SENDER_EMAIL,refreshToken:token.refresh_token,authorizedAt:new Date().toISOString()}),stdio:['pipe','ignore','ignore'],windowsHide:true});
   done=true;console.log('GMAIL_CONSENT_SAVED_ENCRYPTED');reply(200,'<h1>İcazə təhlükəsiz saxlanıldı</h1><p>Bu pəncərəni bağlayın və Codex-də “Təsdiqlədim” yazın. Hələ məktub göndərilməyib və production konfiqurasiyası dəyişməyib.</p>');
  }catch(e){console.log(['TOKEN_EXCHANGE_FAILED','SENDER_ACCOUNT_MISMATCH','MAIL_PERMISSION_MISSING'].includes(e.message)?e.message:'LOCAL_AUTHORIZATION_FAILED');reply(502,'İcazəni təhlükəsiz tamamlamaq mümkün olmadı. Göndərən hesabı yoxlayın və lokal başlanğıc səhifəsindən yenidən cəhd edin.');}finally{busy=false;}
 });
 server.listen(8765,'127.0.0.1',()=>console.log('LOCAL_GMAIL_CONSENT_READY http://127.0.0.1:8765/'));
 setTimeout(()=>server.close(()=>process.exit(0)),30*60*1000).unref();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('LOCAL_GMAIL_SETUP_FAILED');process.exitCode=1;});
