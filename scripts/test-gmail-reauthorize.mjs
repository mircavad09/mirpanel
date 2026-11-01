import assert from 'node:assert/strict';
import {validSender,validState,authorizationUrl,saveEncryptedCredential} from './reauthorize-gmail.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
let count=0;const check=(actual,expected)=>{assert.equal(actual,expected);count++;};
check(validSender({email:'sender@example.test',email_verified:true,sub:'subject'},'sender@example.test'),true);
check(validSender({email:'other@example.test',email_verified:true,sub:'subject'},'sender@example.test'),false);
check(validSender({email:'sender@example.test',email_verified:false,sub:'subject'},'sender@example.test'),false);
check(validSender({email:'sender@example.test',email_verified:true},'sender@example.test'),false);
check(validState('correct-state','correct-state'),true);check(validState('wrong-state','correct-state'),false);check(validState(null,'correct-state'),false);check(validState('ş','a'),false);
const u=new URL(authorizationUrl('public-client','http://127.0.0.1:8765/oauth/callback','state','verifier','sender@example.test'));
check(u.origin,'https://accounts.google.com');check(u.searchParams.get('code_challenge_method'),'S256');check(u.searchParams.get('access_type'),'offline');check(u.searchParams.get('prompt'),'consent');check(u.searchParams.has('client_secret'),false);check(u.searchParams.get('redirect_uri'),'http://127.0.0.1:8765/oauth/callback');
if(process.platform==='win32'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mirpanel-gmail-storage-test-'));
 try{
  const payload={clientId:'synthetic-client',sender:'sender@example.test',refreshToken:'synthetic-not-a-real-token',authorizedAt:new Date().toISOString()};
  saveEncryptedCredential(payload,root);const file=path.join(root,'gmail-reauthorized.dpapi');const first=fs.readFileSync(file);
  check(first.includes(Buffer.from(payload.refreshToken)),false);
  const decrypted=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Security; $b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($env:MIRPANEL_TEST_FILE),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($b))'],{env:{...process.env,MIRPANEL_TEST_FILE:file},encoding:'utf8',windowsHide:true});
  check(JSON.parse(decrypted).refreshToken,payload.refreshToken);
  assert.throws(()=>saveEncryptedCredential({},root),/INVALID_CREDENTIAL_PAYLOAD/);count++;
  check(fs.readFileSync(file).equals(first),true);
  saveEncryptedCredential({...payload,refreshToken:'synthetic-new-token'},root);
  check(fs.readFileSync(file).equals(first),false);check(fs.readdirSync(root).length,2);check(fs.readFileSync(file+'.previous').equals(first),true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
console.log(JSON.stringify({assertions:count,failures:0,realEmailSent:false}));
