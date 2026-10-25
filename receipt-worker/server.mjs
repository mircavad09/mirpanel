import http from 'node:http';import crypto from 'node:crypto';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import fs from 'node:fs';import path from 'node:path';
const token=process.env.RECEIPT_OCR_TOKEN||'';if(Buffer.byteLength(token)<32)throw Error('RECEIPT_OCR_TOKEN minimum 32 bytes required');let active=0;
const server=http.createServer(async(req,res)=>{const reply=(s,v)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(s,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(v));};
 if(req.url==='/health'&&req.method==='GET')return reply(200,{ok:true,version:1,modelsReady:['eng','aze'].every(lang=>fs.existsSync(path.join(process.env.RECEIPT_MODEL_PATH||'/app/models',lang+'.traineddata')))});
 const incoming=String(req.headers.authorization||'').replace(/^Bearer /,'');if(!crypto.timingSafeEqual(crypto.createHash('sha256').update(token).digest(),crypto.createHash('sha256').update(incoming).digest()))return reply(401,{code:'DENIED'});
 if(req.url!=='/inspect'||req.method!=='POST')return reply(404,{code:'NOT_FOUND'});if(active>=1)return reply(503,{code:'WORKER_BUSY'});active++;
 try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024)return reply(413,{code:'RECEIPT_TOO_LARGE'});chunks.push(chunk);}const mime=String(req.headers['content-type']||'');if(!['image/jpeg','image/png','application/pdf'].includes(mime))return reply(415,{code:'RECEIPT_TYPE'});
  const child=spawn(process.execPath,['--max-old-space-size=256',fileURLToPath(new URL('./job.mjs',import.meta.url))],{stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH,RECEIPT_MODEL_PATH:process.env.RECEIPT_MODEL_PATH||'/app/models',OMP_THREAD_LIMIT:'1',UV_THREADPOOL_SIZE:'1',NODE_ENV:'production'}});let output='',done=false;const timer=setTimeout(()=>child.kill('SIGKILL'),40000);req.on('aborted',()=>child.kill('SIGKILL'));
  res.once('close',()=>{if(!done)child.kill('SIGKILL');});
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>600000)child.kill('SIGKILL');});child.on('error',()=>{if(!done){done=true;clearTimeout(timer);reply(503,{code:'WORKER_UNAVAILABLE'});}});child.on('close',()=>{if(done)return;done=true;clearTimeout(timer);try{const body=JSON.parse(output);reply(body.ok?200:422,body);}catch{reply(503,{code:'WORKER_TIMEOUT'});}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({mime,base64:Buffer.concat(chunks).toString('base64')}));await new Promise(r=>child.on('close',r));
 }catch{if(!res.headersSent)reply(503,{code:'WORKER_UNAVAILABLE'});}finally{active--;}
});
server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxConnections=16;
server.listen(Number(process.env.PORT||8891),'0.0.0.0');
