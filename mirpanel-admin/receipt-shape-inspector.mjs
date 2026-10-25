import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import crypto from 'node:crypto';
import {receiptShape,SHAPE_ERROR} from './receipt-shape.mjs';
let child=null,ready=null,current=null,output='',warmed=false;const queue=[];
export const receiptAnalysisState=()=>({runtime:'warm-pool-v1',warm:warmed});
const idle=()=>{if(!current&&!queue.length){child?.unref();child?.stdin.unref?.();child?.stdout.unref?.();}};
const unavailable=()=>Object.assign(Error('Çek yoxlama xidməti cavab vermədi. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_UNAVAILABLE'});
function reset(){const old=child;child=null;ready=null;output='';warmed=false;old?.kill('SIGKILL');if(current){const task=current;current=null;clearTimeout(task.timer);task.reject(unavailable());}for(const task of queue.splice(0)){clearTimeout(task.timer);task.reject(unavailable());}}
export function closeReceiptAnalysis(){reset();}
export function warmReceiptAnalysis(){
 if(ready)return ready;
 ready=new Promise((resolve,reject)=>{
  const worker=child=spawn(process.execPath,['--max-old-space-size=192',fileURLToPath(new URL('../receipt-worker/presence-job.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,RECEIPT_MODEL_PATH:fileURLToPath(new URL('../receipt-worker/models/',import.meta.url)),OMP_THREAD_LIMIT:'1',UV_THREADPOOL_SIZE:'1',NODE_ENV:'production'}});
  const timer=setTimeout(()=>{reject(unavailable());if(child===worker)reset();},15000);
  worker.on('error',()=>{clearTimeout(timer);reject(unavailable());if(child===worker)reset();});worker.on('close',()=>{clearTimeout(timer);reject(unavailable());if(child===worker)reset();});worker.stdin.on('error',()=>{});
  worker.stdout.on('data',chunk=>{if(child!==worker)return;output+=chunk;if(output.length>600000){if(child===worker)reset();return;}let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end);output=output.slice(end+1);let v;try{v=JSON.parse(line);}catch{reset();return;}if(v.ready){warmed=true;clearTimeout(timer);resolve();pump();continue;}if(!current){reset();return;}const task=current;current=null;clearTimeout(task.timer);v.ok?task.resolve({...v.analysis,timings:{...v.analysis.timings,queueMs:task.began-task.queued}}):task.reject(Object.assign(Error(SHAPE_ERROR),{status:422,code:'RECEIPT_UNSAFE'}));pump();}});
 });return ready;
}
function pump(){if(current||!child)return;if(!queue.length){idle();return;}child.ref();child.stdin.ref?.();child.stdout.ref?.();current=queue.shift();current.began=performance.now();child.stdin.write(JSON.stringify({mime:current.receipt.mimeType,base64:current.receipt.buffer.toString('base64')})+'\n');}
export async function localReceiptAnalysis(receipt){
 if(queue.length+(current?1:0)>=4)throw Object.assign(Error('Çek yoxlama xidməti məşğuldur. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_BUSY'});
 // Await readiness before enqueueing: no task is sent to an uninitialised engine.
 const started=performance.now();await warmReceiptAnalysis();
 if(queue.length+(current?1:0)>=4)throw Object.assign(Error('Çek yoxlama xidməti məşğuldur. Yenidən cəhd edin.'),{status:503,code:'RECEIPT_VALIDATOR_BUSY'});
 return new Promise((resolve,reject)=>{const task={receipt,queued:started,resolve,reject};task.timer=setTimeout(()=>{if(current===task)reset();else{const i=queue.indexOf(task);if(i>=0)queue.splice(i,1);reject(unavailable());}},25000);queue.push(task);pump();});
}
export function createReceiptShapeInspector({analyze=localReceiptAnalysis,prewarm=true}={}){
 if(prewarm&&analyze===localReceiptAnalysis)void warmReceiptAnalysis().catch(()=>{});
 const cache=new Map(),pending=new Map();
 return {async inspect(receipt){const key=crypto.createHash('sha256').update(receipt.buffer).update(receipt.mimeType).digest('hex'),saved=cache.get(key);if(saved&&saved.until>Date.now())return saved.result;if(pending.has(key))return pending.get(key);
  const work=(async()=>{const a=await analyze(receipt);
   if(!a||!Array.isArray(a.pages)||a.pages.length<1||a.pages.length>2||a.pages.some(p=>!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width*p.height>20_000_000)||!['ok','unavailable'].includes(a.ocrStatus))throw unavailable();
   if(!receiptShape(a).accepted)throw Object.assign(Error(SHAPE_ERROR),{status:422,code:'RECEIPT_NOT_RECOGNIZED'});
   const result={accepted:true,version:1};cache.set(key,{until:Date.now()+90000,result});if(cache.size>32)cache.delete(cache.keys().next().value);return result;
  })();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
 }};
}
