// Persistent, secret-free OCR process. One document at a time; parent enforces deadline.
import readline from 'node:readline';import {createWorker} from 'tesseract.js';
import {inspectDocument} from './engine.mjs';import {receiptShape} from '../mirpanel-admin/receipt-shape.mjs';
const worker=await createWorker(['eng','aze'],1,{langPath:process.env.RECEIPT_MODEL_PATH,gzip:false,cacheMethod:'none',logger:()=>{}});
await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});
process.stdout.write(JSON.stringify({ready:true})+'\n');
try{for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 if(line.length>7_100_000)process.exit(2);
 try{const input=JSON.parse(line),analysis=await inspectDocument(Buffer.from(input.base64,'base64'),input.mime,{presenceOnly:true,skipTextOcr:a=>receiptShape(a).accepted,recognize:async image=>(await worker.recognize(image,{}, {text:true,blocks:false,tsv:false})).data});process.stdout.write(JSON.stringify({ok:true,analysis})+'\n');}
 catch(e){process.stdout.write(JSON.stringify({ok:false,code:/^RECEIPT_[A-Z_]+$/.test(e.code||'')?e.code:'RECEIPT_PROCESSING_FAILED'})+'\n');}
}}finally{await worker.terminate();}
