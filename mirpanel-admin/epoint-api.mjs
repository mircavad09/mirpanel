import {createHash} from 'node:crypto';
export const EPOINT_API='https://epoint.az/api/1/';
const fail=(status,message)=>Object.assign(Error(message),{status});
export function signedEpoint(payload,env){
 const key=env.EPOINT_PRIVATE_KEY?.trim();
 if(!key||!env.EPOINT_PUBLIC_KEY?.trim())throw fail(503,'Epoint sazlanmayıb.');
 const data=Buffer.from(JSON.stringify({public_key:env.EPOINT_PUBLIC_KEY.trim(),...payload})).toString('base64');
 return new URLSearchParams({data,signature:createHash('sha1').update(key).update(data).update(key).digest('base64')});
}
export async function epointPost(route,payload,{env=process.env,send=fetch}={}){
 if(!['token/widget','wallet/status','wallet/payment','get-status','request'].includes(route))throw Error('Unsupported Epoint route');
 const r=await send(EPOINT_API+route,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
  body:signedEpoint(payload,env),redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw fail(503,'Epoint hazırda cavab vermir. Ödənişin vəziyyətini yoxlayın.');
 return r.json();
}
const cache=new Map();
export function walletMap(value){
 const map={};
 if(!value||Array.isArray(value)||typeof value!=='object')return map;
 for(const [id,name] of Object.entries(value)){
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id)||typeof name!=='string')continue;
  const normalized=name.trim().toLowerCase().replace(/[\s_-]/g,'');
  const method=normalized==='m10'?'m10':normalized==='birbank'?'birbank':null;
  if(method){if(map[method])throw fail(503,'Cüzdan uyğunluğu dəqiq deyil.');map[method]=id;}
 }
 return map;
}
export async function epointWallets({env=process.env,send=fetch,force=false}={}){
 const publicKey=env.EPOINT_PUBLIC_KEY?.trim();if(!publicKey)return {};
 const old=cache.get(publicKey);
 if(!force&&send===fetch&&old&&old.until>Date.now())return old.value;
 // The deployed Epoint API requires the standard signed envelope here too.
 // The plain public_key example in the PDF currently returns HTTP 400.
 const raw=await epointPost('wallet/status',{}, {env,send});
 if(raw?.status==='error')throw fail(503,'Epoint cüzdan siyahısını təsdiqləmədi.');
 const value=walletMap(raw);
 if(send===fetch)cache.set(publicKey,{value,until:Date.now()+60000});
 return value;
}
