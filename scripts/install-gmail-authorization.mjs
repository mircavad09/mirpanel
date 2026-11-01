// Authorized operator tool. Secret material stays in process memory/DPAPI only.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {validSender} from './reauthorize-gmail.mjs';
async function main(){
 const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Security; $p=Join-Path $env:LOCALAPPDATA "MirpanelPrivateCredentials/gmail-reauthorized.dpapi"; $b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($p),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($b))'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true});
 const credential=JSON.parse(raw);
 const key=fs.readFileSync(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
 const base='https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars';
 const headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function getEnv(){const r=await fetch(base+'?limit=100',{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('RENDER_READ_FAILED');return Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));}
 const before=await getEnv();
 if(credential.clientId!==before.GMAIL_CLIENT_ID||credential.sender!==before.GMAIL_SENDER_EMAIL||!credential.refreshToken)throw Error('CREDENTIAL_CONFIG_MISMATCH');
 const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:before.GMAIL_CLIENT_ID,client_secret:before.GMAIL_CLIENT_SECRET,refresh_token:credential.refreshToken,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
 const token=await t.json();if(!t.ok||!token.access_token)throw Error('NEW_TOKEN_REFRESH_FAILED');
 const who=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
 if(!who.ok||!validSender(await who.json(),before.GMAIL_SENDER_EMAIL))throw Error('NEW_TOKEN_IDENTITY_FAILED');
 console.log(JSON.stringify({refreshSucceeded:true,senderIdentityVerified:true,secretEmitted:false}));
 if(process.argv[2]!=='--install-and-send')return;
 const update=await fetch(base+'/GMAIL_REFRESH_TOKEN',{method:'PUT',headers,body:JSON.stringify({value:credential.refreshToken}),signal:AbortSignal.timeout(20000)});
 if(!update.ok)throw Error('RENDER_TOKEN_UPDATE_FAILED');
 const after=await getEnv();if(after.GMAIL_REFRESH_TOKEN!==credential.refreshToken)throw Error('RENDER_TOKEN_VERIFY_FAILED');
 if(Object.keys(before).some(k=>k!=='GMAIL_REFRESH_TOKEN'&&before[k]!==after[k])||Object.keys(after).some(k=>!(k in before)))throw Error('UNRELATED_ENV_CHANGED');
 console.log(JSON.stringify({gmailTokenInstalled:true,otherEnvironmentUnchanged:true}));
 const subject=Buffer.from('MirPanel — e-poçt bağlantısı sınağı').toString('base64');
 const body=Buffer.from('Bu, icazəli MirPanel e-poçt bağlantısı sınağıdır. Heç bir sifariş, ödəniş və ya qeydiyyat yaradılmayıb.').toString('base64');
 const mime=['From: MirPanel <'+before.GMAIL_SENDER_EMAIL+'>','To: mircavad09@gmail.com','Subject: =?UTF-8?B?'+subject+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',body].join('\r\n');
 const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(mime).toString('base64url')}),signal:AbortSignal.timeout(15000)});
 if(!sent.ok)throw Error('REAL_MAIL_SEND_FAILED_'+sent.status);
 console.log(JSON.stringify({realMailAcceptedByGmail:true,inboxReceiptVerified:false,verificationAndResetEndToEndVerified:false,productionBusinessWrites:0}));
}
main().catch(e=>{console.error(/^[A-Z_]+(?:_\d+)?$/.test(e.message)?e.message:'GMAIL_INSTALL_FAILED');process.exitCode=1;});
