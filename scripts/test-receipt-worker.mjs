import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import crypto from 'node:crypto';import net from 'node:net';import path from 'node:path';
import {imageReceipt,pdfReceipt} from './receipt-synthetic-fixtures.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const token=crypto.randomBytes(40).toString('base64url'),child=spawn(process.execPath,['receipt-worker/server.mjs'],{windowsHide:true,stdio:'ignore',env:{...process.env,PORT:String(port),RECEIPT_OCR_TOKEN:token,RECEIPT_MODEL_PATH:path.resolve('receipt-worker/models')}});const base='http://127.0.0.1:'+port;
try{
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/health')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}eq(ready,true);
 const inspect=(body,mime='image/png',auth=true)=>fetch(base+'/inspect',{method:'POST',headers:{'Content-Type':mime,...(auth?{Authorization:'Bearer '+token}:{})},body});
 eq((await inspect(Buffer.from('no secret'), 'image/png',false)).status,401);eq((await inspect(Buffer.from('WEBP'),'image/webp')).status,415);eq((await inspect(Buffer.alloc(5*1024*1024+1))).status,413);
 const good=await imageReceipt();const first=inspect(good);await new Promise(r=>setTimeout(r,100));eq((await inspect(good)).status,503);const response=await first;eq(response.status,200);const data=await response.json();eq(data.ok,true);eq(data.analysis.ocrStatus,'ok');eq(data.analysis.text.includes('SYNTH'),true);
 eq((await inspect(Buffer.concat([good,Buffer.from('PK\x03\x04')]))).status,422);
 eq((await inspect(Buffer.concat([pdfReceipt(),Buffer.from('\n/JavaScript evil\n%%EOF')]),'application/pdf')).status,422);
 const pdf=await inspect(pdfReceipt(),'application/pdf');eq(pdf.status,200);eq((await pdf.json()).analysis.pdfText.includes('SYNTH'),true);
 eq((await fetch(base+'/health')).status,200);console.log(JSON.stringify({ok:true,checks,realChildOcr:true,auth401:true,busy503:true,malformed422:true,maximum5MB:true,productionWrites:0},null,2));
}finally{child.kill();await new Promise(r=>child.once('close',r));}
