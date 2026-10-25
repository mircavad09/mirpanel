// Runs only disposable local fixtures/databases. Never reads a production URL/key.
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const files=['test-receipt-shape','test-receipt-speed','test-receipt-worker','test-receipt-confirmation-gate','test-payment-system','test-payment-method-selection','test-payment-orders-admin','test-payment-orders-browser','test-employee-orders-http','test-employee-orders-browser','test-employee-review-postgres','test-inventory-authority-postgres'];
const dir='payment-test-artifacts/receipt-shape/release';fs.mkdirSync(dir,{recursive:true});const results=[];
for(const name of files){const r=spawnSync(process.execPath,['scripts/'+name+'.mjs'],{env:process.env,encoding:'utf8',timeout:240000,maxBuffer:16*1024*1024,windowsHide:true});const log=(r.stdout||'')+'\n'+(r.stderr||'');fs.writeFileSync(dir+'/'+name+'.log',log);let summary;
 const positions=[...(r.stdout||'').matchAll(/^\{/gm)].map(m=>m.index).reverse();for(const p of positions){try{summary=JSON.parse(r.stdout.slice(p).trim());break;}catch{}}
 results.push({name,ok:r.status===0&&!r.error,summary,error:r.error?.code});console.log((r.status===0&&!r.error?'PASS ':'FAIL ')+name);if(r.status!==0||r.error)console.log(log.slice(-3500));
}
const report={ok:results.every(r=>r.ok),packages:results.length,failed:results.filter(r=>!r.ok).length,receiptShapeChecks:results.find(r=>r.name==='test-receipt-shape')?.summary?.checks||0,results,productionWrites:0};fs.writeFileSync(dir+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,packages:report.packages,failed:report.failed,receiptShapeChecks:report.receiptShapeChecks,productionWrites:0},null,2));if(!report.ok)process.exitCode=1;
