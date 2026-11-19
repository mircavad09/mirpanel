import fs from 'node:fs';
import {signedEpoint} from '../mirpanel-admin/epoint-api.mjs';
import {epointPost,walletMap} from '../mirpanel-admin/epoint-api.mjs';
import {randomUUID} from 'node:crypto';
try{
 const token=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
 const config={};
 for(const name of ['EPOINT_PUBLIC_KEY','EPOINT_PRIVATE_KEY']){
  const r=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars/'+name,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
  const value=r.ok?await r.json():null;config[name]=(value?.value??value?.envVar?.value)?.trim();
  console.log(name,config[name]?'present':'absent');
 }
 if(!config.EPOINT_PUBLIC_KEY)process.exit(1);
 const r=await fetch('https://epoint.az/api/1/wallet/status',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:signedEpoint({},config),redirect:'error',signal:AbortSignal.timeout(15000)});
 const body=await r.json().catch(()=>null);
 console.log('wallet/status HTTP',r.status,'response shape',body&&typeof body==='object'?Object.keys(body):typeof body);
 if(body&&typeof body==='object')console.log('Recognized wallets',JSON.stringify(walletMap(body)));
 if(process.argv.includes('--open-unpaid')){
  const wallets=walletMap(body);
  const results=[];
  for(const method of ['apple-pay','google-pay','m10','birbank']){
   const widget=method.endsWith('-pay'),payload={order_id:'mp_probe_'+randomUUID(),amount:1.00,description:'MirPanel integration check - unpaid'};
   if(!widget){if(!wallets[method]){console.log(method,'not in wallet list');continue;}Object.assign(payload,{wallet_id:wallets[method],currency:'AZN',language:'az'});}
   try{
    const response=await fetch('https://epoint.az/api/1/'+(widget?'token/widget':'wallet/payment'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:signedEpoint(payload,config),redirect:'error',signal:AbortSignal.timeout(15000)});
    const out=await response.json();
    let host=null;try{host=new URL(out.widget_url||out.redirect_url).hostname;}catch{}
    const result={method,http:response.status,status:out.status,urlHost:host,url:out.widget_url||out.redirect_url||null,
      message:typeof out.message==='string'?out.message.split(config.EPOINT_PUBLIC_KEY).join('[redacted]').split(config.EPOINT_PRIVATE_KEY).join('[redacted]'):null};
    results.push(result);
    console.log(method,JSON.stringify({status:out.status,http:response.status,urlHost:host,hasTransaction:typeof out.transaction==='string',message:result.message}));
    if(out.status==='success'&&typeof out.transaction==='string'){
     const check=await epointPost('get-status',{transaction:out.transaction},{env:config});
     console.log(method,'get-status',JSON.stringify({status:check.status,amount:check.amount,currency:check.currency??'not-returned',operation:check.operation_code,transactionMatches:check.transaction===out.transaction}));
    }
   }catch(e){results.push({method,status:'unknown',message:'Sorğunun cavabı alınmadı. Təkrar yaratma aparılmadı.'});console.log(method,'provider request not accepted',e.status||503);}
  }
  if(process.argv.includes('--json-private-links'))console.log('PRIVATE_LINK_RESULTS='+JSON.stringify(results));
 }
}catch{console.log('Read-only Epoint probe did not complete.');process.exitCode=1;}
