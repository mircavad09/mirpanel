import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {receiptShape,SHAPE_ERROR} from './receipt-shape.mjs';
let active=0;
export function localReceiptAnalysis(receipt){
 if(active>=1)throw Object.assign(Error('Çek yoxlama xidməti məşğuldur. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_BUSY'});
 active++;
 return new Promise((resolve,reject)=>{
  let done=false,output='';const child=spawn(process.execPath,['--max-old-space-size=192',fileURLToPath(new URL('../receipt-worker/job.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,RECEIPT_MODEL_PATH:fileURLToPath(new URL('../receipt-worker/models/',import.meta.url)),OMP_THREAD_LIMIT:'1',UV_THREADPOOL_SIZE:'1',NODE_ENV:'production'}});
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);active--;error?reject(error):resolve(value);};
  const unavailable=()=>Object.assign(Error('Çek yoxlama xidməti cavab vermədi. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(unavailable());},40000);
  child.on('error',()=>finish(unavailable()));child.stdout.on('data',c=>{output+=c;if(output.length>600000){child.kill('SIGKILL');finish(unavailable());}});
  child.on('close',()=>{if(done)return;try{const v=JSON.parse(output);if(!v.ok){finish(Object.assign(Error(SHAPE_ERROR),{status:422,code:'RECEIPT_UNSAFE'}));return;}finish(null,v.analysis);}catch{finish(unavailable());}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({mime:receipt.mimeType,base64:receipt.buffer.toString('base64')}));
 });
}
export function createReceiptShapeInspector({analyze=localReceiptAnalysis}={}){
 return {async inspect(receipt){const a=await analyze(receipt);
  if(!a||!Array.isArray(a.pages)||a.pages.length<1||a.pages.length>2||a.pages.some(p=>!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width*p.height>20_000_000)||!['ok','unavailable'].includes(a.ocrStatus))throw Object.assign(Error('Çek yoxlanılmadı. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
  if(!receiptShape(a).accepted)throw Object.assign(Error(SHAPE_ERROR),{status:422,code:'RECEIPT_NOT_RECOGNIZED'});
  return {accepted:true,version:1};
 }};
}
