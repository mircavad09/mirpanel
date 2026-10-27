import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import crypto from 'node:crypto';
export const FILE_SAFETY_ENGINE='isolated-decoder-v3-sef';
const failure=(code='RECEIPT_SAFETY_UNAVAILABLE')=>Object.assign(Error('Faylı yoxlamaq mümkün olmadı. Zəhmət olmasa, yenidən cəhd edin.'),{status:503,code,diagnostic:'file_safety:'+code});
// Isolated tests can exercise a failed/stalled process. No public or environment
// option changes the production job or disables resource limits.
export function createReceiptFileValidator({job=fileURLToPath(new URL('../receipt-worker/safety-job.mjs',import.meta.url)),timeoutMs=25000}={}){
 let active=0;
 return function validate(receipt){
  if(active>=2)throw failure('RECEIPT_SAFETY_BUSY');active++;
  return new Promise((resolve,reject)=>{let done=false,out='',timer,c;
   const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);active--;e?reject(e):resolve(v);};
   try{c=spawn(process.execPath,['--max-old-space-size=192',job],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,OMP_THREAD_LIMIT:'1',UV_THREADPOOL_SIZE:'1',NODE_ENV:'production'}});}catch{return finish(failure('RECEIPT_SAFETY_SPAWN'));}
   timer=setTimeout(()=>{c.kill('SIGKILL');finish(failure('RECEIPT_SAFETY_TIMEOUT'));},timeoutMs);
   c.on('error',()=>finish(failure('RECEIPT_SAFETY_SPAWN')));c.stdout.on('data',b=>{out+=b;if(out.length>4096){c.kill('SIGKILL');finish(failure('RECEIPT_SAFETY_PROTOCOL'));}});c.stdin.on('error',()=>{});
   c.on('close',exitCode=>{if(done)return;if(exitCode!==0)return finish(failure('RECEIPT_SAFETY_PROCESS_EXIT'));try{
    const v=JSON.parse(out);
    if(v.ok&&v.safetyVersion===2&&Number.isInteger(v.canonicalSize)&&v.canonicalSize>=12&&v.canonicalSize<=receipt.buffer.length){
     const normalized=v.canonicalSize<receipt.buffer.length;
     if(normalized){receipt.buffer=receipt.buffer.subarray(0,v.canonicalSize);receipt.sha256=crypto.createHash('sha256').update(receipt.buffer).digest('hex');}
     return finish(null,{safetyVersion:2,normalized});
    }
    if(/^RECEIPT_(?:TOO_LARGE|POLYGLOT|DECODE_FAILED|DIMENSIONS_INVALID|PDF_[A-Z_]+|IMAGE_INVALID|TYPE)$/.test(v.code||''))return finish(Object.assign(Error(v.code==='RECEIPT_DIMENSIONS_INVALID'?'Şəklin ölçüləri təhlükəsiz emal həddini keçir. Daha kiçik JPG və ya PNG seçin.':'Fayl təhlükəsiz açılmadı. Başqa JPG, PNG və ya PDF faylı seçin.'),{status:422,code:'RECEIPT_UNSAFE',diagnostic:'file_safety:'+v.code}));
    finish(failure(v.code==='RECEIPT_PROCESSING_UNAVAILABLE'?'RECEIPT_SAFETY_RESOURCE':'RECEIPT_SAFETY_PROTOCOL'));
   }catch{finish(failure('RECEIPT_SAFETY_PROTOCOL'));}});
   c.stdin.end(JSON.stringify({mime:receipt.mimeType,base64:receipt.buffer.toString('base64')}));
  });
 };
}
export const validateReceiptFile=createReceiptFileValidator();
