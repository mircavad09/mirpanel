import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
const failure=()=>Object.assign(Error('Faylı yükləmək mümkün olmadı. Zəhmət olmasa, yenidən cəhd edin.'),{status:503,code:'RECEIPT_SAFETY_UNAVAILABLE'});
let active=0;
export function validateReceiptFile(receipt){
 if(active>=2)throw Object.assign(failure(),{code:'RECEIPT_SAFETY_BUSY'});
 active++;
 return new Promise((resolve,reject)=>{let done=false,out='';const c=spawn(process.execPath,['--max-old-space-size=192',fileURLToPath(new URL('../receipt-worker/safety-job.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,OMP_THREAD_LIMIT:'1',UV_THREADPOOL_SIZE:'1',NODE_ENV:'production'}});
  const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);active--;e?reject(e):resolve(v);},timer=setTimeout(()=>{c.kill('SIGKILL');finish(failure());},25000);
  c.on('error',()=>finish(failure()));c.stdout.on('data',b=>{out+=b;if(out.length>4096){c.kill('SIGKILL');finish(failure());}});c.stdin.on('error',()=>{});
  c.on('close',()=>{if(done)return;try{const v=JSON.parse(out);if(v.ok&&v.safetyVersion===1)return finish(null,{safetyVersion:1});if(/^RECEIPT_(?:TOO_LARGE|POLYGLOT|DECODE_FAILED|DIMENSIONS_INVALID|PDF_[A-Z_]+|IMAGE_INVALID|TYPE)$/.test(v.code||''))return finish(Object.assign(Error('Fayl zədələnib və ya təhlükəsiz deyil. Başqa fayl seçin.'),{status:422,code:'RECEIPT_UNSAFE'}));finish(failure());}catch{finish(failure());}});c.stdin.end(JSON.stringify({mime:receipt.mimeType,base64:receipt.buffer.toString('base64')}));
 });
}
