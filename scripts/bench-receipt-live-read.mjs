// GET only. Never uploads a receipt or creates business records.
import fs from 'node:fs';
const label=process.argv[2]||'before-deploy',rows=[];
for(let i=0;i<3;i++){const startedAt=new Date().toISOString(),t=performance.now();try{const r=await fetch('https://mirpanel.onrender.com/api/payments/health',{signal:AbortSignal.timeout(90000)}),text=await r.text();let b;try{b=JSON.parse(text);}catch{}const row={startedAt,ms:performance.now()-t,status:r.status,ok:b?.ok,runtime:b?.runtime,warm:b?.warm,receiptCheck:b?.receiptCheck,receiptRuntimeReady:b?.receiptRuntimeReady};rows.push(row);console.log(JSON.stringify(row));}catch(e){rows.push({startedAt,ms:performance.now()-t,error:e.name});}await new Promise(r=>setTimeout(r,1000));}
fs.mkdirSync('payment-test-artifacts/receipt-speed',{recursive:true});fs.writeFileSync('payment-test-artifacts/receipt-speed/live-read-'+label+'.json',JSON.stringify({label,rows,provenPlatformColdStart:false,productionWrites:0},null,2));
