import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
export const BANKS={kapital:'Birbank / Kapital Bank',m10:'m10',abb:'ABB',leo:'Leobank'};
export const DECORATIONS={...BANKS,'wallet-card':'Böyük balans kartı'};
const failure=(status,message)=>Object.assign(new Error(message),{status});
export function bankKey(method){
 const theme=method.resolvedTheme||method.theme;
 if(Object.hasOwn(BANKS,theme))return theme;
 const p=String(method.providerName||method.provider_name||'').toLowerCase();
 if(/birbank|kapital/.test(p))return 'kapital';if(p.includes('leo'))return 'leo';if(p.includes('abb'))return 'abb';if(p.includes('m10'))return 'm10';
 return '';
}
let active=0;
export async function normalizeBankBackground(bytes,mime){
 if(!['image/png','image/jpeg','image/webp'].includes(String(mime).split(';')[0]))throw failure(415,'PNG, JPG və ya WebP şəkli seçin.');
 if(!bytes.length||bytes.length>5242880)throw failure(413,'Şəkil maksimum 5 MB ola bilər.');
 if(active>=2)throw failure(429,'Şəkil emal olunur. Bir az sonra yenidən cəhd edin.');active++;
 try{return await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('./bank-background-job.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore']});
  let out='',done=false;const end=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else{const b=Buffer.from(out,'base64');b.length&&b.length<=2097152?resolve(b):reject(failure(503,'Şəkil emalı tamamlanmadı.'));}};
  const timer=setTimeout(()=>{child.kill();end(failure(503,'Şəkil emalı vaxtında tamamlanmadı. Yenidən cəhd edin.'));},10000);
  child.on('error',()=>end(failure(503,'Şəkil xidməti əlçatan deyil.')));child.stdin.on('error',()=>{});
  child.stdout.on('data',c=>{out+=c;if(out.length>2800000){child.kill();end(failure(413,'Emal edilmiş şəkil çox böyükdür.'));}});
  child.on('close',code=>end(code===0?null:failure(code===2?422:503,code===2?'Şəkil təhlükəsiz açılmadı. PNG, JPG və ya WebP seçin.':'Şəkil xidməti əlçatan deyil.')));
  child.stdin.end(bytes.toString('base64'));
 });}finally{active--;}
}
// A dedicated namespace in the existing media bucket. Not card/receipt data;
// no new database table, public bucket, signed URL, or retention rule is needed.
export function createBankBackgrounds(client,bucket='mirpanel-stories'){
 let cache=null,until=0,loading=null;const pending=new Set(),objects=new Map();
 const storage=()=>client.storage.from(bucket),path=k=>'payment-bank-backgrounds/'+k+'.webp';
 const check=k=>{if(!Object.hasOwn(DECORATIONS,k))throw failure(400,'Fon növü düzgün deyil.');};
 async function list(fresh=false){
  if(!fresh&&cache&&until>Date.now())return cache;if(loading){if(!fresh)return loading;await loading.catch(()=>{});}
  loading=(async()=>{const{data,error}=await storage().list('payment-bank-backgrounds',{limit:20});if(error)throw failure(503,'Bank fonları oxunmadı. Yenidən cəhd edin.');
   const result={};for(const k of Object.keys(DECORATIONS)){const row=(data||[]).find(r=>r.name===k+'.webp');if(row)result[k]='/api/payments/'+(Object.hasOwn(BANKS,k)?'bank-backgrounds/':'backgrounds/')+k+'?v='+encodeURIComponent(row.updated_at||row.id);}
   cache=result;until=Date.now()+30000;return result;})();try{return await loading;}finally{loading=null;}
 }
 return {list,async decorate(method){const backgrounds=await list();return {...method,backgroundUrl:backgrounds[bankKey(method)]||''};},
  async write(k,bytes,mime){check(k);if(pending.has(k))throw failure(409,'Bu bankın fonu hazırda yenilənir.');pending.add(k);
   try{const normalized=await normalizeBankBackground(bytes,mime);const{error}=await storage().upload(path(k),normalized,{contentType:'image/webp',upsert:true,cacheControl:'0'});if(error)throw failure(503,'Fon saxlanmadı. Yenidən cəhd edin.');objects.delete(k);cache=null;return await list(true);}finally{pending.delete(k);}},
  async remove(k){check(k);if(pending.has(k))throw failure(409,'Bu bankın fonu hazırda yenilənir.');pending.add(k);try{const{error}=await storage().remove([path(k)]);if(error)throw failure(503,'Fon silinmədi. Yenidən cəhd edin.');objects.delete(k);cache=null;return await list(true);}finally{pending.delete(k);}},
  async image(k){check(k);const hit=objects.get(k);if(hit&&hit.until>Date.now())return hit;const{data,error}=await storage().download(path(k));if(error)throw failure(String(error.statusCode||error.status)==='404'?404:503,'Bank fonu əlçatan deyil.');const bytes=Buffer.from(await data.arrayBuffer());if(bytes.length>2097152)throw failure(503,'Bank fonu əlçatan deyil.');const value={bytes,etag:'"'+crypto.createHash('sha256').update(bytes).digest('hex')+'"',until:Date.now()+30000};objects.set(k,value);return value;}
 };
}
